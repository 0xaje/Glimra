import {
  SmartSpectraSDK,
  faceMetrics,
  ValidationCode,
  ValidationCodeValue,
  SmartSpectraErrorCodeValue,
} from '@smartspectra/node-sdk/renderer';
import { decodeMetrics } from '@smartspectra/node-sdk/messages';
import { GestureEngine, GestureEngineConfig } from './gestureEngine';
import { GestureFeedback } from '../types';

export interface SmartSpectraControllerCallbacks {
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onStreamAvailable: (stream: MediaStream) => void;
  onStatusChange: (status: 'idle' | 'initializing' | 'tracking' | 'paused' | 'error') => void;
  onValidationChange: (message: string, isFaceTracked: boolean) => void;
  onGestureDetected: (feedback: GestureFeedback) => void;
  onChargeProgress: (chargeRatio: number) => void;
  onError: (code: number, message: string) => void;
}

export class SmartSpectraController {
  private sdk: SmartSpectraSDK | null = null;
  private gestureEngine: GestureEngine;
  private callbacks: SmartSpectraControllerCallbacks;
  private isRunning: boolean = false;
  private stopPromise: Promise<void> | null = null;
  private hasSdkError = false;

  constructor(callbacks: SmartSpectraControllerCallbacks) {
    this.callbacks = callbacks;
    this.gestureEngine = new GestureEngine();
  }

  public setPaused(paused: boolean): void {
    this.gestureEngine.setPaused(paused);
    if (!this.sdk || this.hasSdkError) return;
    this.callbacks.onStatusChange(paused ? 'paused' : 'tracking');
    this.callbacks.onValidationChange(
      paused ? 'Paused by presenter' : 'Tracking active',
      !paused,
    );
  }

  public updateGestureConfig(config: Partial<GestureEngineConfig>): void {
    this.gestureEngine.updateConfig(config);
  }

  public async start(apiKey: string): Promise<void> {
    if (this.isRunning || this.sdk || this.stopPromise) return;
    this.hasSdkError = false;

    try {
      this.callbacks.onStatusChange('initializing');
      this.callbacks.onValidationChange('Starting SmartSpectra…', false);

      this.gestureEngine.reset();

      this.sdk = new SmartSpectraSDK({
        apiKey: apiKey.trim(),
        requestedMetrics: [...faceMetrics],
        enableAccumulatedOutput: false,
      });

      this.sdk.on('streamAvailable', (stream: MediaStream) => {
        this.callbacks.onStreamAvailable(stream);
      });

      this.sdk.on('validationStatus', (code: ValidationCodeValue, _ts: number, hint: string) => {
        if (this.hasSdkError) return;
        const isOk = code === ValidationCode.kOk;
        this.gestureEngine.setFaceValidation(isOk);

        let statusText = 'Tracking active';
        if (code === ValidationCode.kNoFaceFound) {
          statusText = 'No face detected — center your camera';
        } else if (code === ValidationCode.kMultipleFacesFound) {
          statusText = 'Multiple faces detected';
        } else if (code === ValidationCode.kTooDark) {
          statusText = 'Lighting too low';
        } else if (code === ValidationCode.kExcessiveMotion) {
          statusText = 'Excessive head movement';
        } else if (hint) {
          statusText = hint;
        }

        this.callbacks.onValidationChange(statusText, isOk);
      });

      this.sdk.on('metrics', (buf: Uint8Array, _timestampUs: number) => {
        if (this.hasSdkError) return;
        try {
          const decoded = decodeMetrics(buf);
          const blinkingSamples = decoded.face?.blinking;

          if (Array.isArray(blinkingSamples) && blinkingSamples.length > 0) {
            for (const sample of blinkingSamples) {
              const detected = !!sample.detected;
              const stable = !!sample.stable;
              const tsUs = Number(sample.timestamp || 0);

              const result = this.gestureEngine.processSample(detected, stable, tsUs);

              // Update visual charge feedback on HUD
              this.callbacks.onChargeProgress(result.chargeRatio);

              if (result.command === 'next') {
                if (result.feedback) this.callbacks.onGestureDetected(result.feedback);
                this.callbacks.onNextSlide();
              } else if (result.command === 'prev') {
                if (result.feedback) this.callbacks.onGestureDetected(result.feedback);
                this.callbacks.onPrevSlide();
              }
            }
          }
        } catch (decodeErr) {
          console.error('[Glimra] Metrics decoding error:', decodeErr);
        }
      });

      this.sdk.on('error', (code: SmartSpectraErrorCodeValue, message: string, retryable: boolean) => {
        if (this.hasSdkError) return;
        this.hasSdkError = true;
        console.error(`[Glimra] SmartSpectra error (${code}, retryable=${retryable}): ${message}`);
        this.gestureEngine.reset();
        this.callbacks.onStatusChange('error');
        this.callbacks.onValidationChange('Camera tracking stopped — restart to try again', false);
        this.callbacks.onChargeProgress(0);
        this.callbacks.onError(code, message);
        // Do not tear down the native SDK inside its own event callback.
        // Schedule cleanup after the callback returns to the SDK bridge.
        queueMicrotask(() => { void this.stop(true); });
      });

      const sdk = this.sdk;
      await sdk.start();
      if (this.sdk === sdk && !this.hasSdkError) {
        this.isRunning = true;
        this.callbacks.onStatusChange('tracking');
        this.callbacks.onValidationChange('Waiting for a valid face signal', false);
      }
    } catch (err: any) {
      console.error('[Glimra] Failed to start SmartSpectra controller:', err);
      this.callbacks.onStatusChange('error');
      this.callbacks.onError(500, err?.message || 'Failed to start camera controller');
      await this.stop(true);
    }
  }

  public async stop(preserveError = false): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    const sdk = this.sdk;
    if (!sdk) return;

    // Detach this instance first so another event cannot start a second teardown.
    this.sdk = null;
    this.isRunning = false;
    this.gestureEngine.reset();

    const cleanup = async () => {
      try {
        await sdk.stop();
      } catch (err) {
        console.warn('[Glimra] Error during SDK stop:', err);
      } finally {
        try {
          // The renderer bridge documents destroy() as synchronous.
          sdk.destroy();
        } catch (err) {
          console.warn('[Glimra] Error during SDK destroy:', err);
        }
        this.callbacks.onChargeProgress(0);
        if (!preserveError && !this.hasSdkError) {
          this.callbacks.onStatusChange('idle');
          this.callbacks.onValidationChange('Camera idle', false);
        }
      }
    };

    this.stopPromise = cleanup();
    try {
      await this.stopPromise;
    } finally {
      this.stopPromise = null;
    }
  }
}
