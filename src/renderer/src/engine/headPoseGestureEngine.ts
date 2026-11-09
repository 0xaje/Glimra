import type { MotionCommand } from './directionalGestureEngine';

/**
 * Head movement is measured against facial features, not the camera edges.
 * The initial natural pose becomes neutral, even if the presenter is
 * seated off-center or looking slightly to one side.
 */
export type FacePoint = { x: number; y: number };
export type FacePose = { turn: number; tilt: number; nod: number };

const finite = (point: FacePoint | undefined): point is FacePoint =>
  !!point && Number.isFinite(point.x) && Number.isFinite(point.y);

export function readFacePose(points: readonly FacePoint[]): FacePose | null {
  const nose = points[1];
  const eyeA = points[33];
  const eyeB = points[263];
  if (!finite(nose) || !finite(eyeA) || !finite(eyeB)) return null;

  // Sort by image x, avoiding assumptions about flipped camera previews.
  const left = eyeA.x < eyeB.x ? eyeA : eyeB;
  const right = eyeA.x < eyeB.x ? eyeB : eyeA;
  const width = Math.hypot(right.x - left.x, right.y - left.y);
  if (width < 0.035 || width > 0.85) return null;
  const middleX = (left.x + right.x) / 2;
  const middleY = (left.y + right.y) / 2;

  const pose = {
    // Positive turn means the nose moved towards the camera image's left
    // relative to the eyes (presenter's right with an unmirrored camera).
    turn: (middleX - nose.x) / width,
    // Right-ear lean lowers the left side of the unmirrored image.
    tilt: (left.y - right.y) / width,
    // Up is a smaller nose-to-eye vertical separation.
    nod: (nose.y - middleY) / width,
  };
  return Object.values(pose).every(Number.isFinite) ? pose : null;
}

type Candidate = { direction: MotionCommand['direction']; since: number; count: number };

export class HeadPoseGestureEngine {
  private neutral: FacePose | null = null;
  private filtered: FacePose | null = null;
  private previousAt = -Infinity;
  private lastCommandAt = -Infinity;
  private armed = true;
  private neutralSince: number | null = null;
  private candidate: Candidate | null = null;
  private paused = false;

  public setPaused(paused: boolean): void {
    if (this.paused !== paused) {
      this.paused = paused;
      this.reset();
    }
  }

  public reset(): void {
    this.neutral = null;
    this.filtered = null;
    this.previousAt = -Infinity;
    this.lastCommandAt = -Infinity;
    this.armed = true;
    this.neutralSince = null;
    this.candidate = null;
  }

  public observe(points: readonly FacePoint[] | null, now: number): MotionCommand | null {
    if (this.paused || !Number.isFinite(now)) return null;
    const pose = points ? readFacePose(points) : null;
    if (!pose) {
      // A brief loss must not fire anything. Reacquire a natural baseline
      // if the presenter has moved somewhere else.
      if (now - this.previousAt > 650) this.reset();
      return null;
    }

    if (this.previousAt !== -Infinity && (now < this.previousAt || now - this.previousAt > 850)) {
      this.reset();
    }
    this.previousAt = now;
    if (!this.neutral) {
      this.neutral = { ...pose };
      this.filtered = { ...pose };
      return null;
    }

    const prior = this.filtered!;
    const alpha = 0.58; // two real samples smooth camera landmark jitter
    const next: FacePose = {
      turn: prior.turn * (1 - alpha) + pose.turn * alpha,
      tilt: prior.tilt * (1 - alpha) + pose.tilt * alpha,
      nod: prior.nod * (1 - alpha) + pose.nod * alpha,
    };
    this.filtered = next;

    const dx = next.turn - this.neutral.turn + 0.85 * (next.tilt - this.neutral.tilt);
    const dy = next.nod - this.neutral.nod;
    const x = Math.abs(dx);
    const y = Math.abs(dy);

    if (!this.armed) {
      // A held turn/nod is one command, not an endless sequence.
      if (x < 0.035 && y < 0.035) {
        if (this.neutralSince === null) this.neutralSince = now;
        if (now - this.neutralSince >= 180) {
          this.armed = true;
          this.candidate = null;
          this.neutralSince = null;
          this.neutral = { ...next };
        }
      } else {
        this.neutralSince = null;
      }
      return null;
    }

    // Slowly track comfortable posture drift while essentially still.
    if (x < 0.025 && y < 0.025) {
      this.neutral = {
        turn: this.neutral.turn * 0.985 + next.turn * 0.015,
        tilt: this.neutral.tilt * 0.985 + next.tilt * 0.015,
        nod: this.neutral.nod * 0.985 + next.nod * 0.015,
      };
    }

    // Smaller than the old 8.5%-of-camera-width threshold. These scores
    // are *relative to the person's face width*, not their screen position.
    const horizontal = x >= 0.065 && x >= y * 1.22;
    const vertical = y >= 0.055 && y >= x * 1.22;
    const direction = horizontal ? (dx > 0 ? 'right' : 'left')
      : vertical ? (dy > 0 ? 'down' : 'up') : null;

    if (!direction) {
      this.candidate = null;
      return null;
    }

    if (this.candidate?.direction === direction && now - this.candidate.since <= 500) {
      this.candidate.count += 1;
    } else {
      this.candidate = { direction, since: now, count: 1 };
    }

    // At a 5-8 Hz detector rate, two consecutive samples are a quick
    // deliberate movement without firing on one noisy face estimate.
    if (this.candidate.count < 2 || now - this.lastCommandAt < 650) return null;
    this.armed = false;
    this.neutralSince = null;
    this.candidate = null;
    this.lastCommandAt = now;
    return { source: 'head', direction };
  }
}
