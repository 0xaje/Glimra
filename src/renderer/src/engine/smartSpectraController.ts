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

  constructor(callbacks: SmartSpectraControllerCallbacks) {
    this.callbacks = callbacks;
    this.gestureEngine = new GestureEngine();
  }

  public setPaused(paused: boolean): void {
    this.gestureEngine.setPaused(paused);
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
    if (this.isRunning) return;

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

      this.sdk.on('error', (code: SmartSpectraErrorCodeValue, message: string, _retryable: boolean) => {
        console.error(`[Glimra] SmartSpectra error (${code}): ${message}`);
        this.callbacks.onStatusChange('error');
        this.callbacks.onError(code, message);
      });

      await this.sdk.start();
      this.isRunning = true;
      this.callbacks.onStatusChange('tracking');
    } catch (err: any) {
      console.error('[Glimra] Failed to start SmartSpectra controller:', err);
      this.callbacks.onStatusChange('error');
      this.callbacks.onError(500, err?.message || 'Failed to start camera controller');
      await this.stop();
    }
  }

  public async stop(): Promise<void> {
    if (!this.sdk) return;

    try {
      this.gestureEngine.reset();
      await this.sdk.stop();
    } catch (err) {
      console.warn('[Glimra] Error during SDK stop:', err);
    } finally {
      this.sdk.destroy();
      this.sdk = null;
      this.isRunning = false;
      this.callbacks.onStatusChange('idle');
      this.callbacks.onValidationChange('Camera idle', false);
      this.callbacks.onChargeProgress(0);
    }
  }
}
