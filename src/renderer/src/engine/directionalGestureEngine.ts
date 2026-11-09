/**
 * Converts real tracked head/hand movement into one presentation command.
 * This module never reads a timer for session expiry: inactivity is allowed.
 * Coordinates must be normalized to the presenter's own left/right, not
 * the mirrored preview's direction.
 */
export type Direction = 'left' | 'right' | 'up' | 'down';
export type GestureSource = 'head' | 'hand';
export type MotionCommand = { source: GestureSource; direction: Direction };
export type TrackedPoint = { x: number; y: number; confidence: number; faceWidth?: number };

type TrackState = {
  origin: TrackedPoint | null;
  last: TrackedPoint | null;
  lastSeenAt: number;
  armed: boolean;
  neutralSince: number | null;
};

const makeTrack = (): TrackState => ({
  origin: null, last: null, lastSeenAt: 0, armed: true, neutralSince: null,
});

export class DirectionalGestureEngine {
  private tracks: Record<GestureSource, TrackState> = { head: makeTrack(), hand: makeTrack() };
  private lastCommandAt = -Infinity;
  private paused = false;

  public setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.reset();
  }

  public reset(): void {
    this.tracks = { head: makeTrack(), hand: makeTrack() };
    this.lastCommandAt = -Infinity;
  }

  /**
   * Call for each real face/hand landmark observation.
   * No action is emitted until a deliberate displacement is observed.
   * After a command, the presenter must return to neutral before rearming.
   */
  public observe(source: GestureSource, point: TrackedPoint | null, nowMs: number): MotionCommand | null {
    if (this.paused || !Number.isFinite(nowMs)) return null;
    const track = this.tracks[source];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.confidence < 0.65) {
      // Losing the subject must never trigger a command or leave a stale origin.
      if (nowMs - track.lastSeenAt > 450) this.tracks[source] = makeTrack();
      return null;
    }
    // A long period without movement is normal during a presentation.
    // Keep the neutral origin until tracking is actually lost.
    const current = this.tracks[source];
    current.lastSeenAt = nowMs;
    current.last = point;
    if (!current.origin) {
      current.origin = point;
      return null;
    }
    const dx = point.x - current.origin.x;
    const dy = point.y - current.origin.y;
    // Vertical nods are smaller than side-to-side head movements.
    // Hand swipes have a broader range but still need a deliberate move.
    // The original position tracker worked on the user's camera but had
    // fixed thresholds that made distant presenters move too far.
    // Adjust only HEAD thresholds based on real eye-to-eye image width.
    // Tests and callers without faceWidth retain the original values.
    const size = source === 'head' && Number.isFinite(point.faceWidth) && (point.faceWidth ?? 0) >= 0.05
      ? point.faceWidth!
      : null;
    const horizontalThreshold = source === 'head'
      ? (size === null ? 0.085 : Math.max(0.028, Math.min(0.07, size * 0.19)))
      : 0.12;
    const verticalThreshold = source === 'head'
      ? (size === null ? 0.045 : Math.max(0.022, Math.min(0.055, size * 0.155)))
      : 0.12;
    const neutral = source === 'head'
      ? (size === null ? 0.035 : Math.max(0.012, Math.min(0.03, size * 0.09)))
      : 0.055;
    if (!current.armed) {
      if (Math.hypot(dx, dy) <= neutral) {
        if (current.neutralSince === null) current.neutralSince = nowMs;
        if (nowMs - current.neutralSince >= 180) {
          current.armed = true;
          current.origin = point;
          current.neutralSince = null;
        }
      } else {
        current.neutralSince = null;
      }
      return null;
    }
    // Axis dominance suppresses ambiguous diagonal movements.
    const axisRatio = source === 'head' ? 1.18 : 1.35;
    const horizontal = Math.abs(dx) > Math.abs(dy) * axisRatio;
    const vertical = Math.abs(dy) > Math.abs(dx) * axisRatio;
    if ((!horizontal || Math.abs(dx) < horizontalThreshold) &&
        (!vertical || Math.abs(dy) < verticalThreshold)) return null;
    if (nowMs - this.lastCommandAt < 550) return null;
    current.armed = false;
    current.neutralSince = null;
    this.lastCommandAt = nowMs;
    return {
      source,
      direction: horizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'),
    };
  }
}
