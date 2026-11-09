import type { GestureEngineConfig } from './gestureEngine';
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
};

export interface PresageCallbacks {
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onScroll: (direction: 'up' | 'down') => void;
  onStatusChange: (status: 'idle' | 'initializing' | 'tracking' | 'paused' | 'error') => void;
  onValidationChange: (message: string, tracked: boolean) => void;
  onGestureDetected: (feedback: GestureFeedback) => void;
  onChargeProgress: (chargeRatio: number) => void;
  onCalibrationSample: (durationMs: number) => void;
  onError: (code: number, message: string) => void;
  onSensorReady: () => void;
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

  constructor(callbacks: PresageCallbacks) { this.callbacks = callbacks; }

  public setBlinkNavigationEnabled(enabled: boolean): void {
    this.mode = enabled ? 'eyes' : 'head';
    this.callbacks.onChargeProgress(0);
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

  public setCalibrationMode(enabled: boolean): void {
    if (!this.active || this.mode !== 'eyes') return;
    void window.glimraDesktop?.controlPresage('calibration', enabled);
    this.callbacks.onChargeProgress(0);
  }

  public updateGestureConfig(config: Partial<GestureEngineConfig>): void {
    if (!this.active) return;
    void window.glimraDesktop?.controlPresage('timing', {
      minIntentionalBlinkMs: config.minIntentionalBlinkMs,
      maxIntentionalBlinkMs: config.maxIntentionalBlinkMs,
      refractoryCooldownMs: config.refractoryCooldownMs,
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
        if (typeof event.validLandmarkSamples === 'number' && event.validLandmarkSamples > 0) {
          this.stableSeen = true;
          this.callbacks.onSensorReady();
          this.callbacks.onValidationChange(
            'Live Presage facial landmarks • ' + event.validLandmarkSamples + ' stable samples',
            !this.paused,
          );
        }
        break;
      case 'validation':
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
