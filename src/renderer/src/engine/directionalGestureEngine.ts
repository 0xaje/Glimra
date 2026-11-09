/**
 * Converts real tracked head/hand movement into one presentation command.
 * This module never reads a timer for session expiry: inactivity is allowed.
 * Coordinates must be normalized to the presenter's own left/right, not
 * the mirrored preview's direction.
 */
export type Direction = 'left' | 'right' | 'up' | 'down';
export type GestureSource = 'head' | 'hand';
export type MotionCommand = { source: GestureSource; direction: Direction };
export type TrackedPoint = { x: number; y: number; confidence: number };

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
    if (track.last && nowMs - track.lastSeenAt > 450) this.tracks[source] = makeTrack();
    const current = this.tracks[source];
    current.lastSeenAt = nowMs;
    current.last = point;
    if (!current.origin) {
      current.origin = point;
      return null;
    }
    const dx = point.x - current.origin.x;
    const dy = point.y - current.origin.y;
    const threshold = source === 'head' ? 0.085 : 0.16;
    const neutral = source === 'head' ? 0.035 : 0.065;
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
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.35;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.35;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold || (!horizontal && !vertical)) return null;
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
