type GestureEngineConfig = {
  minIntentionalBlinkMs: number;
  maxIntentionalBlinkMs: number;
  refractoryCooldownMs: number;
};
import type { GestureFeedback } from '../types';

export type GestureControlMode = 'head' | 'eyes';
type NativeEvent = {
  type?: string;
  state?: string;
  source?: string;
  direction?: string;
  label?: string;
  code?: number | string;
  hint?: string;
  message?: string;
  validLandmarkSamples?: number;
  blinkStableSamples?: number;
  durationMs?: number;
  tracked?: boolean;
  reason?: string;
};

export interface PresageCallbacks {
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onScroll: (direction: 'up' | 'down') => void;
  onStatusChange: (status: 'idle' | 'initializing' | 'tracking' | 'paused' | 'error') => void;
  onValidationChange: (message: string, tracked: boolean) => void;
  onGestureDetected: (feedback: GestureFeedback) => void;
  onCalibrationSample: (durationMs: number) => void;
  onError: (code: number, message: string) => void;
  onSensorReady: () => void;
  onSensorLost: (reason: string) => void;
}

/**
 * Thin renderer adapter. No webcam access and no facial tracking libraries.
 * All automatic commands originate in @smartspectra/node-sdk's native child.
 */
export class PresageNativeController {
  private callbacks: PresageCallbacks;
  private detach: (() => void) | null = null;
  private active = false;
  private paused = false;
  private mode: GestureControlMode = 'head';
  private stableSeen = false;
  private latestBlinkTiming: Partial<GestureEngineConfig> | null = null;

  constructor(callbacks: PresageCallbacks) { this.callbacks = callbacks; }

  public setBlinkNavigationEnabled(enabled: boolean): void {
    this.mode = enabled ? 'eyes' : 'head';
    if (this.active) void window.glimraDesktop?.controlPresage('mode', this.mode);
  }

  public setPaused(paused: boolean): void {
    if (!this.active) return;
    this.paused = paused;
    void window.glimraDesktop?.controlPresage('pause', paused);
    this.callbacks.onStatusChange(paused ? 'paused' : 'tracking');
    this.callbacks.onValidationChange(paused
      ? 'Presentation gestures paused'
      : 'Presage native camera active', !paused && this.stableSeen);
  }

  public async recenter(): Promise<boolean> {
    if (!this.active || this.mode !== 'head') return false;
    this.stableSeen = false;
    this.callbacks.onSensorLost('Finding the presenter’s new resting position…');
    this.callbacks.onValidationChange('Finding the presenter’s new resting position…', false);
    return await window.glimraDesktop?.controlPresage('recenter', true) ?? false;
  }

  public setCalibrationMode(enabled: boolean): void {
    if (!this.active || this.mode !== 'eyes') return;
    void window.glimraDesktop?.controlPresage('calibration', enabled);
    this.callbacks.onChargeProgress(0);
  }

  public updateGestureConfig(config: Partial<GestureEngineConfig>): void {
    this.latestBlinkTiming = { ...this.latestBlinkTiming, ...config };
    if (!this.active) return;
    void window.glimraDesktop?.controlPresage('timing', {
      minIntentionalBlinkMs: this.latestBlinkTiming.minIntentionalBlinkMs,
      maxIntentionalBlinkMs: this.latestBlinkTiming.maxIntentionalBlinkMs,
      refractoryCooldownMs: this.latestBlinkTiming.refractoryCooldownMs,
    });
  }

  public async start(key: string): Promise<void> {
    if (this.active) return;
    const desktop = window.glimraDesktop;
    if (!desktop) throw new Error('Glimra desktop bridge is unavailable');
    if (!key.trim()) throw new Error('A Presage SmartSpectra API key is required.');
    this.stableSeen = false;
    this.paused = false;
    this.callbacks.onStatusChange('initializing');
    this.callbacks.onValidationChange('Starting native Presage SmartSpectra camera…', false);
    this.detach?.();
    this.detach = desktop.onPresageEvent(event => this.handle(event as NativeEvent));
    try {
      const started = await desktop.startPresage(key.trim(), this.mode);
      if (!started) throw new Error('Native Presage camera was not started.');
      this.active = true;
      if (this.latestBlinkTiming) this.updateGestureConfig(this.latestBlinkTiming);
    } catch (error) {
      this.detach?.();
      this.detach = null;
      this.active = false;
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.active = false;
    this.stableSeen = false;
    this.paused = false;
    // Stop native capture before detaching events.
    try { await window.glimraDesktop?.stopPresage(); }
    finally {
      this.detach?.();
      this.detach = null;
      this.callbacks.onStatusChange('idle');
      this.callbacks.onValidationChange('Camera disconnected', false);
    }
  }

  private handle(event: NativeEvent): void {
    if (!event || typeof event !== 'object') return;
    switch (event.type) {
      case 'state':
        if (event.state === 'tracking') {
          this.active = true;
          this.callbacks.onStatusChange(this.paused ? 'paused' : 'tracking');
          this.callbacks.onValidationChange('Presage SmartSpectra native processing running', false);
        } else if (event.state === 'initializing') {
          this.callbacks.onStatusChange('initializing');
        }
        break;
      case 'signal':
        // Metric count is cumulative. It does NOT prove the latest frame is
        // valid or that this presenter is still in camera view.
        if (typeof event.validLandmarkSamples === 'number' && event.validLandmarkSamples > 0 && this.stableSeen) {
          this.stableSeen = true;
          this.callbacks.onSensorReady();
          this.callbacks.onValidationChange(
            'Live Presage facial landmarks • ' + event.validLandmarkSamples + ' stable samples',
            !this.paused,
          );
        }
        break;
      case 'face-status':
        if (event.tracked === true) {
          this.stableSeen = true;
          this.callbacks.onSensorReady();
          this.callbacks.onValidationChange('Presage facial landmarks ready', !this.paused);
        } else {
          this.stableSeen = false;
          this.callbacks.onSensorLost(event.reason || 'Waiting for one face in camera view');
          this.callbacks.onValidationChange(event.reason || 'Waiting for one face in camera view', false);
        }
        break;
      case 'recentered':
        this.stableSeen = false;
        this.callbacks.onSensorLost('Finding the new resting position…');
        this.callbacks.onValidationChange('Finding the new resting position…', false);
        break;
      case 'validation':
        // Presage also validates pulse/breathing measurement quality.
        // Code 12 says "hold still" and code 7 concerns the chest. Both
        // conflict with an application intentionally controlled by gentle
        // head movement, so do not show those as gesture failures.
        if (event.code === 7 || event.code === 12) break;
        if (event.code !== 0 && event.hint) {
          this.callbacks.onValidationChange('Presage: ' + event.hint, this.stableSeen && !this.paused);
        }
        break;
      case 'gesture':
        if (this.paused || !this.active) return;
        if (event.source !== 'head' && event.source !== 'blink') return;
        if (!['left', 'right', 'up', 'down'].includes(event.direction || '')) return;
        if (this.mode === 'head' && event.source !== 'head') return;
        if (this.mode === 'eyes' && event.source !== 'blink') return;
        const feedback: GestureFeedback = {
          type: event.source === 'head' ? 'head-motion'
            : event.label === 'Double blink' ? 'double-blink' : 'prolonged-blink',
          timestamp: Date.now(),
          label: event.label || (event.source + ' ' + event.direction),
        };
        this.callbacks.onGestureDetected(feedback);
        if (event.direction === 'right') this.callbacks.onNextSlide();
        else if (event.direction === 'left') this.callbacks.onPrevSlide();
        else if (event.direction === 'up' || event.direction === 'down') this.callbacks.onScroll(event.direction);
        break;
      case 'calibration':
        if (typeof event.durationMs === 'number') this.callbacks.onCalibrationSample(event.durationMs);
        break;
      case 'error':
        this.callbacks.onSensorLost('Presage capture stopped');
        this.active = false;
        this.stableSeen = false;
        this.callbacks.onStatusChange('error');
        this.callbacks.onError(typeof event.code === 'number' ? event.code : 500,
          event.message || 'Presage native capture stopped');
        break;
      default:
        break;
    }
  }
}
