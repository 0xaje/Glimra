export interface GestureFeedback {
  type: 'none' | 'prolonged-blink' | 'double-blink';
  timestamp: number;
  label: string;
}

export interface GestureEngineConfig {
  minIntentionalBlinkMs: number; // e.g., 350ms
  maxIntentionalBlinkMs: number; // e.g., 850ms
  refractoryCooldownMs: number;  // e.g., 1200ms
  doubleBlinkWindowMs: number;   // e.g., 600ms
}

export const DEFAULT_GESTURE_CONFIG: GestureEngineConfig = {
  minIntentionalBlinkMs: 350,
  maxIntentionalBlinkMs: 850,
  refractoryCooldownMs: 1200,
  doubleBlinkWindowMs: 650,
};

export type GestureCommand = 'next' | 'prev' | 'none';

export interface GestureEvaluationResult {
  command: GestureCommand;
  feedback: GestureFeedback | null;
  chargeRatio: number; // 0.0 to 1.0 for visual dwell feedback in HUD
}

export class GestureEngine {
  private config: GestureEngineConfig;
  private isBlinking: boolean = false;
  private blinkStartMs: number = 0;
  private lastTriggerMs: number = 0;
  private lastBlinkCompletionMs: number = 0;
  private recentBlinkCount: number = 0;
  private isPaused: boolean = false;
  private isValidFaceTrack: boolean = false;

  constructor(config: Partial<GestureEngineConfig> = {}) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      this.isBlinking = false;
      this.blinkStartMs = 0;
    }
  }

  public setFaceValidation(isValid: boolean): void {
    this.isValidFaceTrack = isValid;
    if (!isValid) {
      this.isBlinking = false;
      this.blinkStartMs = 0;
    }
  }

  public reset(): void {
    this.isBlinking = false;
    this.blinkStartMs = 0;
    this.lastTriggerMs = 0;
    this.lastBlinkCompletionMs = 0;
    this.recentBlinkCount = 0;
  }

  /**
   * Process a single detection sample from SmartSpectra face.blinking stream.
   *
   * @param detected Whether eyes are detected as closed/blinking.
   * @param stable Whether detection status is stable.
   * @param timestampUs Linux epoch timestamp in microseconds.
   */
  public processSample(
    detected: boolean,
    _stable: boolean,
    timestampUs: number,
  ): GestureEvaluationResult {
    const nowMs = timestampUs / 1000;

    // Guard: If paused or face tracking is invalid, ignore
    if (this.isPaused || !this.isValidFaceTrack) {
      this.isBlinking = false;
      this.blinkStartMs = 0;
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    // Guard: Refractory cooldown period
    const timeSinceLastTrigger = nowMs - this.lastTriggerMs;
    if (timeSinceLastTrigger < this.config.refractoryCooldownMs) {
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    // Rising edge: Presenter closed eyes
    if (detected && !this.isBlinking) {
      this.isBlinking = true;
      this.blinkStartMs = nowMs;
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    // Sustained closure: Calculate charge ratio for HUD
    if (detected && this.isBlinking) {
      const elapsed = nowMs - this.blinkStartMs;
      const chargeRatio = Math.min(1.0, elapsed / this.config.minIntentionalBlinkMs);
      return { command: 'none', feedback: null, chargeRatio };
    }

    // Falling edge: Presenter reopened eyes
    if (!detected && this.isBlinking) {
      const durationMs = nowMs - this.blinkStartMs;
      this.isBlinking = false;
      this.blinkStartMs = 0;

      // 1. Involuntary blink: Ignore (< 350ms)
      if (durationMs < this.config.minIntentionalBlinkMs) {
        // Record for potential rapid double-blink detection
        const timeSincePreviousBlink = nowMs - this.lastBlinkCompletionMs;
        if (timeSincePreviousBlink < this.config.doubleBlinkWindowMs && durationMs > 100) {
          this.recentBlinkCount++;
          if (this.recentBlinkCount >= 2) {
            this.lastTriggerMs = nowMs;
            this.recentBlinkCount = 0;
            return {
              command: 'prev',
              feedback: {
                type: 'double-blink',
                timestamp: nowMs,
                label: 'Double blink: Previous slide',
              },
              chargeRatio: 0,
            };
          }
        } else {
          this.recentBlinkCount = 1;
        }

        this.lastBlinkCompletionMs = nowMs;
        return { command: 'none', feedback: null, chargeRatio: 0 };
      }

      // 2. Intentional prolonged blink: [350ms, 850ms] -> Advance slide
      if (
        durationMs >= this.config.minIntentionalBlinkMs &&
        durationMs <= this.config.maxIntentionalBlinkMs
      ) {
        this.lastTriggerMs = nowMs;
        this.recentBlinkCount = 0;
        return {
          command: 'next',
          feedback: {
            type: 'prolonged-blink',
            timestamp: nowMs,
            label: `Intentional blink (${Math.round(durationMs)}ms): Next slide`,
          },
          chargeRatio: 0,
        };
      }

      // 3. Excessively long closure (> 850ms, e.g. resting eyes or looking down): Discard
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    return { command: 'none', feedback: null, chargeRatio: 0 };
  }
}
