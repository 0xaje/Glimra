export interface GestureFeedback {
  type: 'none' | 'prolonged-blink' | 'double-blink';
  timestamp: number;
  label: string;
}

export interface GestureEngineConfig {
  minIntentionalBlinkMs: number; // Intentional dwell threshold (e.g., 350ms)
  maxIntentionalBlinkMs: number; // Cap on dwell (e.g., 850ms, longer is resting/looking away)
  refractoryCooldownMs: number;  // Cooldown lockout window after any command (e.g., 1200ms)
  minDoubleBlinkDurationMs: number; // Min duration for a valid sub-blink in double-blink (100ms)
  maxDoubleBlinkDurationMs: number; // Max duration for a valid sub-blink in double-blink (280ms)
  minInterBlinkGapMs: number;    // Min gap between blinks to prevent flutter (80ms)
  maxInterBlinkGapMs: number;    // Max gap between blinks for double-blink sequence (450ms)
}

export const DEFAULT_GESTURE_CONFIG: GestureEngineConfig = {
  minIntentionalBlinkMs: 350,
  maxIntentionalBlinkMs: 850,
  refractoryCooldownMs: 1200,
  minDoubleBlinkDurationMs: 100,
  maxDoubleBlinkDurationMs: 280,
  minInterBlinkGapMs: 80,
  maxInterBlinkGapMs: 450,
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
  private lastBlinkDurationMs: number = 0;
  private recentBlinkCount: number = 0;
  private isPaused: boolean = false;
  private isValidFaceTrack: boolean = false;
  private lastTimestampUs: number = 0;

  constructor(config: Partial<GestureEngineConfig> = {}) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.resetTransientState();
  }

  public setFaceValidation(isValid: boolean): void {
    this.isValidFaceTrack = isValid;
    if (!isValid) {
      this.resetTransientState();
    }
  }

  public reset(): void {
    this.resetTransientState();
    this.lastTriggerMs = 0;
    this.lastTimestampUs = 0;
  }

  private resetTransientState(): void {
    this.isBlinking = false;
    this.blinkStartMs = 0;
    this.recentBlinkCount = 0;
    this.lastBlinkCompletionMs = 0;
    this.lastBlinkDurationMs = 0;
  }

  /**
   * Process a single detection sample from SmartSpectra face.blinking stream.
   *
   * @param detected Whether eyes are detected as closed/blinking.
   * @param stable Whether detection status is stable (unstable samples ignored).
   * @param timestampUs Linux epoch timestamp in microseconds.
   */
  public processSample(
    detected: boolean,
    stable: boolean,
    timestampUs: number,
  ): GestureEvaluationResult {
    // 1. Guard against non-monotonic or invalid timestamps
    if (timestampUs <= 0) {
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    if (this.lastTimestampUs > 0) {
      const deltaUs = timestampUs - this.lastTimestampUs;
      if (deltaUs <= 0) {
        // Discard duplicate or backwards timestamp
        return { command: 'none', feedback: null, chargeRatio: 0 };
      }
      if (deltaUs > 2_000_000) {
        // Timestamp gap > 2 seconds (e.g. frame drop / system stall) -> reset state
        this.resetTransientState();
      }
    }
    this.lastTimestampUs = timestampUs;

    const nowMs = timestampUs / 1000;

    // 2. Guard: If paused or face tracking is lost, immediately disarm
    if (this.isPaused || !this.isValidFaceTrack) {
      this.resetTransientState();
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    // 3. Guard: Stability check. If detection is unstable/noisy, do not start or commit gestures
    if (!stable) {
      if (this.isBlinking) {
        // Abort in-progress blink to prevent false dwell trigger
        this.isBlinking = false;
        this.blinkStartMs = 0;
      }
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    // 4. Guard: Refractory cooldown period following any executed command
    const timeSinceLastTrigger = nowMs - this.lastTriggerMs;
    if (timeSinceLastTrigger < this.config.refractoryCooldownMs) {
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    // 5. Rising edge: Presenter closed eyes
    if (detected && !this.isBlinking) {
      this.isBlinking = true;
      this.blinkStartMs = nowMs;
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    // 6. Sustained closure: Calculate charge ratio for HUD feedback
    if (detected && this.isBlinking) {
      const elapsed = nowMs - this.blinkStartMs;
      const chargeRatio = Math.min(1.0, elapsed / this.config.minIntentionalBlinkMs);
      return { command: 'none', feedback: null, chargeRatio };
    }

    // 7. Falling edge: Presenter reopened eyes
    if (!detected && this.isBlinking) {
      const durationMs = nowMs - this.blinkStartMs;
      this.isBlinking = false;
      this.blinkStartMs = 0;

      // Scenario A: Candidate for rapid double-blink
      const isQuickBlink =
        durationMs >= this.config.minDoubleBlinkDurationMs &&
        durationMs <= this.config.maxDoubleBlinkDurationMs;

      if (isQuickBlink) {
        const gapSinceLastBlink = nowMs - this.lastBlinkCompletionMs;

        if (
          this.recentBlinkCount === 1 &&
          gapSinceLastBlink >= this.config.minInterBlinkGapMs &&
          gapSinceLastBlink <= this.config.maxInterBlinkGapMs &&
          this.lastBlinkDurationMs <= this.config.maxDoubleBlinkDurationMs
        ) {
          // Verified intentional double-blink
          this.lastTriggerMs = nowMs;
          this.resetTransientState();
          return {
            command: 'prev',
            feedback: {
              type: 'double-blink',
              timestamp: nowMs,
              label: 'Double blink: Previous slide',
            },
            chargeRatio: 0,
          };
        } else {
          // First quick blink recorded
          this.recentBlinkCount = 1;
          this.lastBlinkCompletionMs = nowMs;
          this.lastBlinkDurationMs = durationMs;
          return { command: 'none', feedback: null, chargeRatio: 0 };
        }
      }

      // If duration was too short (<100ms) or too long for double blink, clear double-blink state
      this.recentBlinkCount = 0;
      this.lastBlinkCompletionMs = 0;

      // Scenario B: Involuntary spontaneous blink (<350ms) -> Discard
      if (durationMs < this.config.minIntentionalBlinkMs) {
        return { command: 'none', feedback: null, chargeRatio: 0 };
      }

      // Scenario C: Intentional prolonged dwell blink [350ms, 850ms] -> Advance slide
      if (
        durationMs >= this.config.minIntentionalBlinkMs &&
        durationMs <= this.config.maxIntentionalBlinkMs
      ) {
        this.lastTriggerMs = nowMs;
        this.resetTransientState();
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

      // Scenario D: Prolonged closure > 850ms (resting eyes, reading notes) -> Discard without action
      return { command: 'none', feedback: null, chargeRatio: 0 };
    }

    return { command: 'none', feedback: null, chargeRatio: 0 };
  }
}
