import {
  SmartSpectraSDK,
  faceMetrics,
  ValidationCode,
  ProcessingStatus,
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
  onCalibrationSample: (durationMs: number) => void;
}

export class SmartSpectraController {
  private sdk: SmartSpectraSDK | null = null;
  private gestureEngine: GestureEngine;
  private callbacks: SmartSpectraControllerCallbacks;
  private isRunning: boolean = false;
  private stopPromise: Promise<void> | null = null;
  private hasSdkError = false;
  private isPaused = false;
  private isValidated = false;
  private isSdkRunning = false;
  private firstStreamReport = false;
  private lastValidationWarningCode: number | null = null;
  private lastValidationWarningAt = 0;
  private lastValidationHint = '';
  private sessionGeneration = 0;
  private ownedCameraStream: MediaStream | null = null;
  private preferLowBandwidthMode = false;
  private calibrating = false;
  private calibrationBlinkStartUs: number | null = null;
  private calibrationLastTimestampUs = 0;
  private metricsWindowStartMs = 0;
  private metricsCount = 0;
  private lastMetricsAtMs = 0;

  constructor(callbacks: SmartSpectraControllerCallbacks) {
    this.callbacks = callbacks;
    this.gestureEngine = new GestureEngine();
  }

  public setCalibrationMode(enabled: boolean): void {
    this.calibrating = enabled;
    this.calibrationBlinkStartUs = null;
    this.calibrationLastTimestampUs = 0;
    this.gestureEngine.reset();
    this.callbacks.onChargeProgress(0);
  }

  public setPaused(paused: boolean): void {
    if (!this.sdk || this.hasSdkError || !this.isSdkRunning) return;
    this.isPaused = paused;
    this.gestureEngine.setPaused(paused);
    this.callbacks.onStatusChange(paused ? 'paused' : 'tracking');
    this.callbacks.onValidationChange(paused ? 'Paused by presenter' : 'Waiting for a valid face signal', !paused && this.isValidated);
  }

  public updateGestureConfig(config: Partial<GestureEngineConfig>): void {
    this.gestureEngine.updateConfig(config);
  }

  public async start(apiKey: string): Promise<void> {
    // Never report a successful start when the previous session is still
    // tearing down. Wait for native cleanup before constructing a new SDK.
    if (this.stopPromise) await this.stopPromise;
    if (this.isRunning || this.sdk) return;
    this.hasSdkError = false;
    this.isPaused = false;
    this.isValidated = false;
    this.isSdkRunning = false;
    this.firstStreamReport = false;
    this.lastValidationWarningCode = null;
    this.lastValidationWarningAt = 0;
    this.lastValidationHint = '';
    this.metricsWindowStartMs = 0;
    this.metricsCount = 0;
    this.lastMetricsAtMs = 0;
    const generation = ++this.sessionGeneration;

    try {
      this.callbacks.onStatusChange('initializing');
      this.callbacks.onValidationChange('Starting SmartSpectra…', false);

      this.gestureEngine.reset();

      this.sdk = new SmartSpectraSDK({
        apiKey: apiKey.trim(),
        requestedMetrics: [...faceMetrics],
        enableAccumulatedOutput: false,
      });

      this.sdk.on('processingStatus', (status: number) => {
        console.info('[Glimra/SmartSpectra] processingStatus', status, Object.entries(ProcessingStatus).find(([, value]) => value === status)?.[0] ?? 'unknown');
        if (this.hasSdkError || generation !== this.sessionGeneration) return;
        if (status === ProcessingStatus.kRunning) {
          this.isSdkRunning = true;
          this.callbacks.onStatusChange(this.isPaused ? 'paused' : 'tracking');
        } else if (status === ProcessingStatus.kStarting) {
          this.isSdkRunning = false;
          this.callbacks.onStatusChange('initializing');
        } else if (status === ProcessingStatus.kStopping || status === ProcessingStatus.kIdle || status === ProcessingStatus.kUninitialized) {
          this.isSdkRunning = false;
          this.isValidated = false;
          this.gestureEngine.setFaceValidation(false);
          this.callbacks.onValidationChange('Camera not tracking', false);
          this.callbacks.onStatusChange('idle');
        } else if (status === ProcessingStatus.kError) {
          this.isSdkRunning = false;
          this.isValidated = false;
          this.gestureEngine.setFaceValidation(false);
          this.callbacks.onStatusChange('error');
        }
      });

      this.sdk.on('streamAvailable', (stream: MediaStream) => {
        if (generation !== this.sessionGeneration || this.hasSdkError) return;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings();
          console.info('[Glimra/Camera] negotiated settings', { width: settings.width, height: settings.height, frameRate: settings.frameRate, deviceIdPresent: !!settings.deviceId, readyState: track.readyState });
          if (!this.firstStreamReport) {
            this.firstStreamReport = true;
            // Measure frames rendered by the preview separately from the
            // requested/negotiated camera frameRate when available.
            console.info('[Glimra/Camera] Note: negotiated frameRate is not a measured processing FPS');
          }
          track.addEventListener('ended', () => console.warn('[Glimra/Camera] video track ended'), { once: true });
        } else {
          console.warn('[Glimra/Camera] SDK stream has no video track');
        }
        this.callbacks.onStreamAvailable(stream);
      });

      this.sdk.on('validationStatus', (code: ValidationCodeValue, _ts: number, hint: string) => {
        if (this.hasSdkError || generation !== this.sessionGeneration) return;
        if (code === ValidationCode.kOk) this.lastValidationHint = '';
        else if (hint) this.lastValidationHint = hint;
        // Do not retry automatically: a manual restart may select a lower
        // bandwidth camera mode after a sustained FPS validation failure.
        if (code === ValidationCode.kFrameRateTooLow) this.preferLowBandwidthMode = true;
        if (code !== ValidationCode.kOk) {
          const now = Date.now();
          if (code !== this.lastValidationWarningCode || now - this.lastValidationWarningAt >= 2000) {
            console.warn('[Glimra/SmartSpectra] validationStatus', { code, hint, timestampUs: _ts });
            this.lastValidationWarningCode = code;
            this.lastValidationWarningAt = now;
          }
        } else {
          this.lastValidationWarningCode = null;
        }
        const isOk = code === ValidationCode.kOk;
        this.isValidated = isOk;
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

        this.callbacks.onValidationChange(statusText, isOk && !this.isPaused && this.isSdkRunning);
      });

      this.sdk.on('metrics', (buf: Uint8Array, _timestampUs: number) => {
        if (this.hasSdkError || generation !== this.sessionGeneration || !this.isSdkRunning) return;
        try {
          // Diagnostic only: SDK metrics callbacks are NOT equivalent to camera FPS.
          // A missing callback stream can nevertheless reveal a processing stall.
          const nowMs = performance.now();
          if (this.metricsWindowStartMs === 0) this.metricsWindowStartMs = nowMs;
          this.metricsCount += 1;
          this.lastMetricsAtMs = nowMs;
          if (nowMs - this.metricsWindowStartMs >= 5000) {
            const elapsedSeconds = (nowMs - this.metricsWindowStartMs) / 1000;
            console.info('[Glimra/SmartSpectra] metrics delivery', {
              callbacksPerSecond: Number((this.metricsCount / elapsedSeconds).toFixed(1)),
              callbacks: this.metricsCount,
              seconds: Number(elapsedSeconds.toFixed(1)),
              note: 'SDK metrics callbacks, not measured camera FPS',
            });
            this.metricsWindowStartMs = nowMs;
            this.metricsCount = 0;
          }
          const decoded = decodeMetrics(buf);
          const blinkingSamples = decoded.face?.blinking;

          if (Array.isArray(blinkingSamples) && blinkingSamples.length > 0) {
            for (const sample of blinkingSamples) {
              const detected = !!sample.detected;
              const stable = !!sample.stable;
              const tsUs = Number(sample.timestamp || 0);

              if (this.calibrating) {
                // Calibration observes real SmartSpectra blink samples but
                // never executes slide commands. Unstable/lost tracking
                // cancels an incomplete sample rather than fabricating it.
                if (!this.isValidated || !stable || !Number.isFinite(tsUs) || tsUs <= this.calibrationLastTimestampUs) {
                  this.calibrationBlinkStartUs = null;
                  continue;
                }
                this.calibrationLastTimestampUs = tsUs;
                if (detected && this.calibrationBlinkStartUs === null) this.calibrationBlinkStartUs = tsUs;
                else if (!detected && this.calibrationBlinkStartUs !== null) {
                  const durationMs = (tsUs - this.calibrationBlinkStartUs) / 1000;
                  this.calibrationBlinkStartUs = null;
                  if (durationMs >= 250 && durationMs <= 2500) this.callbacks.onCalibrationSample(Math.round(durationMs));
                }
                continue;
              }
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
        if (this.hasSdkError || generation !== this.sessionGeneration) return;
        this.hasSdkError = true;
        console.error(`[Glimra] SmartSpectra error (${code}, retryable=${retryable}): ${message}`, {
          millisecondsSinceLastMetrics: this.lastMetricsAtMs ? Math.round(performance.now() - this.lastMetricsAtMs) : null,
          lastValidationHint: this.lastValidationHint,
          cameraMode: this.preferLowBandwidthMode ? '640x480' : '1280x720',
        });
        this.gestureEngine.reset();
        this.callbacks.onStatusChange('error');
        this.callbacks.onValidationChange('Camera processing stopped — disconnect and reconnect to retry', false);
        this.callbacks.onChargeProgress(0);
        this.callbacks.onError(code, this.lastValidationHint ? `${message} ${this.lastValidationHint}` : message);
        // Stop the frame pump after the SDK callback has returned.
        // Do not destroy native resources synchronously inside the callback.
        window.setTimeout(() => {
          if (generation === this.sessionGeneration) void this.stop(true);
        }, 0);
      });

      const sdk = this.sdk;
      // Own capture explicitly so camera FPS and dimensions are not left to
      // the SDK's default getUserMedia request. A lower-bandwidth mode is
      // selected only on a subsequent user-initiated attempt after code 11.
      const cameraMode = this.preferLowBandwidthMode
        ? { width: 640, height: 480, frameRate: 30 }
        : { width: 1280, height: 720, frameRate: 30 };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: cameraMode.width },
          height: { ideal: cameraMode.height },
          frameRate: { ideal: cameraMode.frameRate, min: 25 },
        },
      });
      if (this.sdk !== sdk || generation !== this.sessionGeneration) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.ownedCameraStream = stream;
      const settings = stream.getVideoTracks()[0]?.getSettings();
      console.info('[Glimra/Camera] explicit capture mode', {
        requested: cameraMode,
        actual: settings && { width: settings.width, height: settings.height, frameRate: settings.frameRate },
        fallbackAfterPreviousFpsFailure: this.preferLowBandwidthMode,
      });
      sdk.useMediaStream(stream);
      await sdk.start();
      if (this.sdk === sdk && !this.hasSdkError) {
        this.isRunning = true;
        // processingStatus is authoritative; start() resolving alone
        // does not prove the native engine is processing frames.
        if (!this.isSdkRunning) this.callbacks.onValidationChange('Waiting for SmartSpectra to start', false);
      }
    } catch (err: any) {
      // A user may have stopped the session while getUserMedia/start was
      // pending. Do not turn that intentional cancellation into an error.
      if (generation !== this.sessionGeneration) return;
      console.error('[Glimra] Failed to start SmartSpectra controller:', err);
      this.hasSdkError = true;
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
    ++this.sessionGeneration;
    const ownedStream = this.ownedCameraStream;
    this.ownedCameraStream = null;
    this.isRunning = false;
    this.calibrating = false;
    this.calibrationBlinkStartUs = null;
    this.isSdkRunning = false;
    this.isValidated = false;
    this.isPaused = false;
    this.gestureEngine.reset();

    const cleanup = async () => {
      try {
        await sdk.stop();
      } catch (err) {
        console.warn('[Glimra] Error during SDK stop:', err);
      } finally {
        // Host-owned streams passed to useMediaStream are not released by
        // SmartSpectra; stop our tracks after the SDK frame pump has stopped.
        ownedStream?.getTracks().forEach(track => track.stop());
        try {
          // The renderer bridge documents destroy() as synchronous.
          sdk.destroy();
        } catch (err) {
          console.warn('[Glimra] Error during SDK destroy:', err);
        }
        this.callbacks.onChargeProgress(0);
        if (!preserveError) {
          this.hasSdkError = false;
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
