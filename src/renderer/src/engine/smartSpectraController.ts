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
  /** SmartSpectra may fail without disabling the local head/hand camera. */
  onSdkUnavailable?: (code: number, message: string) => void;
  onCalibrationSample: (durationMs: number) => void;
}

export class SmartSpectraController {
  private sdk: SmartSpectraSDK | null = null;
  private gestureEngine: GestureEngine;
  private callbacks: SmartSpectraControllerCallbacks;
  private isRunning: boolean = false;
  private stopPromise: Promise<void> | null = null;
  private sdkShutdownPromise: Promise<void> | null = null;
  // A stop must not destroy the SDK while its native start is still pending.
  private sdkStartSettled: Promise<void> | null = null;
  private hasSdkError = false;
  private isPaused = false;
  private blinkNavigationEnabled = false;
  private isValidated = false;
  private isSdkRunning = false;
  private firstStreamReport = false;
  private lastValidationWarningCode: number | null = null;
  private lastValidationWarningAt = 0;
  private lastValidationHint = '';
  private sessionGeneration = 0;
  private ownedCameraStream: MediaStream | null = null;
  // Separate browser track for the SDK, so SDK stop/destroy cannot directly
  // end the original track that feeds MediaPipe head/hand navigation.
  private sdkInputStream: MediaStream | null = null;
  private starting = false;
  private cameraRequestPending: Promise<MediaStream> | null = null;
  private calibrating = false;
  private calibrationBlinkStartUs: number | null = null;
  private calibrationLastTimestampUs = 0;
  private metricsWindowStartMs = 0;
  private metricsCount = 0;
  private lastMetricsAtMs = 0;
  private lastChargeReportAtMs = 0;
  private lastChargeRatio = 0;
  private lastReportedValidation = '';
  private lastReportedFaceTracked = false;

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
    // Pausing the presentation must work even if SmartSpectra has stopped.
    if (!this.ownedCameraStream?.getVideoTracks().some(track => track.readyState === 'live')) return;
    this.isPaused = paused;
    this.gestureEngine.setPaused(paused);
    this.callbacks.onStatusChange(paused ? 'paused' : 'tracking');
    this.callbacks.onValidationChange(
      paused ? 'Paused by presenter' : this.hasSdkError ? 'Head and hand controls ready — SmartSpectra signal unavailable' : 'Waiting for a valid face signal',
      !paused && this.isValidated,
    );
  }

  public setBlinkNavigationEnabled(enabled: boolean): void {
    this.blinkNavigationEnabled = enabled;
    this.gestureEngine.reset();
    this.callbacks.onChargeProgress(0);
  }

  public updateGestureConfig(config: Partial<GestureEngineConfig>): void {
    this.gestureEngine.updateConfig(config);
  }

  public async start(apiKey: string): Promise<void> {
    // Never report a successful start when the previous session is still
    // tearing down. Wait for native cleanup before constructing a new SDK.
    if (this.stopPromise) await this.stopPromise;
    if (this.sdkShutdownPromise) await this.sdkShutdownPromise;
    if (this.ownedCameraStream || this.isRunning || this.sdk || this.starting) return;
    this.starting = true;
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
    this.lastChargeReportAtMs = 0;
    this.lastChargeRatio = 0;
    this.lastReportedValidation = '';
    this.lastReportedFaceTracked = false;
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
          // Local head/hand tracking continues when only SDK processing fails.
          if (this.ownedCameraStream) this.callbacks.onStatusChange(this.isPaused ? 'paused' : 'tracking');
          else this.callbacks.onStatusChange('initializing');
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
        // Always give the local tracker our original host-owned stream.
        // The SDK may report a different MediaStream wrapper or clone.
        this.callbacks.onStreamAvailable(this.ownedCameraStream ?? stream);
      });

      this.sdk.on('validationStatus', (code: ValidationCodeValue, _ts: number, hint: string) => {
        if (this.hasSdkError || generation !== this.sessionGeneration) return;
        if (code === ValidationCode.kOk) this.lastValidationHint = '';
        else if (hint) this.lastValidationHint = hint;
        // Do not retry automatically after SDK frame-rate validation failure.
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
        // FPS and lighting warnings are not proof that the face disappeared.
        // Only explicit face-loss validation should disarm a previously valid face.
        const isOk = code === ValidationCode.kOk;
        if (isOk) this.isValidated = true;
        else if (code === ValidationCode.kNoFaceFound || code === ValidationCode.kMultipleFacesFound) this.isValidated = false;
        this.gestureEngine.setFaceValidation(this.isValidated);

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

        const faceTracked = this.isValidated && !this.isPaused && this.isSdkRunning;
        // Do not trigger a React state update for every repeated SDK warning.
        if (statusText !== this.lastReportedValidation || faceTracked !== this.lastReportedFaceTracked) {
          this.lastReportedValidation = statusText;
          this.lastReportedFaceTracked = faceTracked;
          this.callbacks.onValidationChange(statusText, faceTracked);
        }
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
              // SmartSpectra still observes genuine live data in all modes.
              // Blink slide commands only run when the user selects Eyes.
              if (!this.blinkNavigationEnabled) continue;
              const result = this.gestureEngine.processSample(detected, stable, tsUs);

              // Update visual charge feedback on HUD
              // Limit HUD React updates to 10Hz, preserving the final reset.
              const chargeNow = performance.now();
              if (result.chargeRatio === 0 && this.lastChargeRatio !== 0 ||
                  chargeNow - this.lastChargeReportAtMs >= 100) {
                this.lastChargeReportAtMs = chargeNow;
                this.lastChargeRatio = result.chargeRatio;
                this.callbacks.onChargeProgress(result.chargeRatio);
              }

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
        this.isSdkRunning = false;
        this.isValidated = false;
        console.error(`[Glimra] SmartSpectra error (${code}, retryable=${retryable}): ${message}`, {
          millisecondsSinceLastMetrics: this.lastMetricsAtMs ? Math.round(performance.now() - this.lastMetricsAtMs) : null,
          lastValidationHint: this.lastValidationHint,
          cameraMode: '640x480',
        });
        this.gestureEngine.reset();
        this.callbacks.onChargeProgress(0);
        const creditFailure = code === 4;
        const sdkMessage = creditFailure
          ? 'SmartSpectra credits unavailable; blink control is off'
          : `SmartSpectra unavailable: ${message}`;
        if (this.ownedCameraStream?.getVideoTracks().some(track => track.readyState === 'live')) {
          // SDK error 8 must not stop the owned MediaStream or the independent
          // MediaPipe gesture tracker. Do not silently retry and spend credits.
          this.callbacks.onStatusChange(this.isPaused ? 'paused' : 'tracking');
          this.callbacks.onValidationChange('Head and hand controls remain available. ' + sdkMessage, false);
          this.callbacks.onSdkUnavailable?.(code, sdkMessage);
          window.setTimeout(() => {
            if (generation === this.sessionGeneration) void this.disableSdkWithoutStoppingCamera();
          }, 0);
        } else {
          // Camera capture itself failed; local gesture control cannot work.
          this.callbacks.onStatusChange('error');
          this.callbacks.onError(code, sdkMessage);
          window.setTimeout(() => {
            if (generation === this.sessionGeneration) void this.stop(true);
          }, 0);
        }
      });

      const sdk = this.sdk;
      // Own capture explicitly rather than relying on SDK defaults.
      // Use the lower-bandwidth mode from the first attempt. 720p adds
      // processing pressure without improving the SDK's >=25 FPS requirement.
      const cameraMode = { width: 640, height: 480, frameRate: 30 };
      const cameraRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: cameraMode.width },
          height: { ideal: cameraMode.height },
          // Do not reject a usable camera just because it cannot meet the
          // SDK's 25 FPS measurement requirement. MediaPipe needs fewer frames.
          frameRate: { ideal: cameraMode.frameRate },
        },
      });
      this.cameraRequestPending = cameraRequest;
      let stream: MediaStream;
      try {
        stream = await cameraRequest;
      } finally {
        if (this.cameraRequestPending === cameraRequest) this.cameraRequestPending = null;
      }
      if (this.sdk !== sdk || generation !== this.sessionGeneration) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.ownedCameraStream = stream;
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') {
        throw new Error('Camera stopped before SmartSpectra could start.');
      }
      // Publish the actual captured stream immediately: some SDK failures
      // occur before its later streamAvailable event is emitted.
      this.callbacks.onStreamAvailable(stream);
      track.addEventListener('ended', () => {
        if (generation !== this.sessionGeneration) return;
        console.error('[Glimra/Camera] Camera track ended unexpectedly');
        this.hasSdkError = true;
        this.callbacks.onError(500, 'Camera disconnected or stopped. Check camera access before reconnecting.');
        void this.stop(true);
      }, { once: true });
      const settings = stream.getVideoTracks()[0]?.getSettings();
      console.info('[Glimra/Camera] explicit capture mode', {
        requested: cameraMode,
        actual: settings && { width: settings.width, height: settings.height, frameRate: settings.frameRate },
        mode: 'low-bandwidth',
      });
      // Give SmartSpectra its own clone, NOT the presenter-controlled track.
      // If the SDK's renderer frame pump fails, its stop/destroy lifecycle
      // must not own the MediaStreamTrack used by the gesture detector.
      const sdkInput = new MediaStream([track.clone()]);
      this.sdkInputStream = sdkInput;
      sdk.useMediaStream(sdkInput);
      const startOperation = sdk.start();
      // A rejection must not prevent stop() from completing its cleanup.
      const startSettled = startOperation.then(() => undefined, () => undefined);
      this.sdkStartSettled = startSettled;
      try {
        await startOperation;
      } finally {
        if (this.sdkStartSettled === startSettled) this.sdkStartSettled = null;
      }
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
      if (this.ownedCameraStream?.getVideoTracks().some(track => track.readyState === 'live')) {
        const message = err?.message || 'SmartSpectra failed to start';
        this.callbacks.onStatusChange(this.isPaused ? 'paused' : 'tracking');
        this.callbacks.onValidationChange('Head and hand controls remain available. SmartSpectra unavailable.', false);
        this.callbacks.onSdkUnavailable?.(500, message);
        void this.disableSdkWithoutStoppingCamera();
      } else {
        this.callbacks.onStatusChange('error');
        this.callbacks.onError(500, err?.message || 'Failed to start camera controller');
        await this.stop(true);
      }
    } finally {
      this.starting = false;
    }
  }

  /**
   * Stop only SmartSpectra's native processing/renderer frame pump.
   * The host-owned MediaStream stays live for head and hand navigation.
   */
  private disableSdkWithoutStoppingCamera(): Promise<void> {
    if (this.sdkShutdownPromise) return this.sdkShutdownPromise;
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve();
    this.sdk = null;
    this.isRunning = false;
    this.isSdkRunning = false;
    this.isValidated = false;
    const pendingStart = this.sdkStartSettled;
    const sdkInputStream = this.sdkInputStream;
    this.sdkInputStream = null;
    const cleanup = (async () => {
      try {
        if (pendingStart) await pendingStart;
        await sdk.stop();
      } catch (error) {
        console.warn('[Glimra/SmartSpectra] SDK-only shutdown warning:', error);
      } finally {
        // Releasing SDK's cloned track must not release the original track.
        sdkInputStream?.getTracks().forEach(track => track.stop());
        try { sdk.destroy(); }
        catch (error) { console.warn('[Glimra/SmartSpectra] SDK destroy warning:', error); }
        const original = this.ownedCameraStream?.getVideoTracks()[0];
        console.info('[Glimra/Camera] after SDK-only shutdown', {
          originalReadyState: original?.readyState,
          originalMuted: original?.muted,
          originalEnabled: original?.enabled,
          sdkTrackReleased: sdkInputStream?.getVideoTracks()[0]?.readyState,
        });
      }
    })();
    this.sdkShutdownPromise = cleanup;
    void cleanup.finally(() => {
      if (this.sdkShutdownPromise === cleanup) this.sdkShutdownPromise = null;
    });
    return cleanup;
  }

  public async stop(preserveError = false): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    const sdk = this.sdk;
    if (!sdk && !this.ownedCameraStream && !this.cameraRequestPending) return;

    // Detach this instance first so another event cannot start a second teardown.
    this.sdk = null;
    ++this.sessionGeneration;
    const ownedStream = this.ownedCameraStream;
    this.ownedCameraStream = null;
    const sdkInputStream = this.sdkInputStream;
    this.sdkInputStream = null;
    const pendingStart = this.sdkStartSettled;
    const pendingSdkShutdown = this.sdkShutdownPromise;
    const pendingCameraRequest = this.cameraRequestPending;
    this.isRunning = false;
    this.calibrating = false;
    this.calibrationBlinkStartUs = null;
    this.isSdkRunning = false;
    this.isValidated = false;
    this.isPaused = false;
    this.gestureEngine.reset();

    const cleanup = async () => {
      try {
        // Never block disconnect on an unanswered browser camera permission
        // prompt. If permission is granted after disconnect, release the
        // late stream immediately; the generation check in start() also
        // prevents it from being attached to the SDK.
        if (pendingCameraRequest) {
          void pendingCameraRequest.then(
            lateStream => lateStream.getTracks().forEach(track => track.stop()),
            () => undefined,
          );
        }
        // Avoid racing native SDK initialization against SDK shutdown.
        if (pendingSdkShutdown) await pendingSdkShutdown;
        if (pendingStart) await pendingStart;
        if (sdk) await sdk.stop();
      } catch (err) {
        console.warn('[Glimra] Error during SDK stop:', err);
      } finally {
        // Release the SDK clone first; only explicit Disconnect stops the
        // original camera tracks used by local head/hand tracking.
        sdkInputStream?.getTracks().forEach(track => track.stop());
        ownedStream?.getTracks().forEach(track => track.stop());
        try {
          // The renderer bridge documents destroy() as synchronous.
          sdk?.destroy();
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
