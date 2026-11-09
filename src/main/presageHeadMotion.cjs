'use strict';

/**
 * Interprets REAL SmartSpectra face.landmarks samples.
 * The coordinates are native camera pixels, never MediaPipe observations.
 * No image, raw landmark set or biometric data is emitted to the renderer.
 */
class PresageHeadMotion {
  constructor() { this.reset(); }
  reset() {
    this.origin = null;
    this.prev = null;
    this.armed = true;
    this.neutralSince = null;
    this.candidate = null;
    this.lastCommand = -Infinity;
    this.lastInput = -Infinity;
    this.lastSampleAt = -Infinity;
    this.stillSince = null;
    this.lastRecenterReason = 'initial';
  }

  observe(sample, now) {
    if (!sample || sample.stable !== true || sample.reset === true) {
      this.reset();
      return null;
    }
    const points = sample.value;
    if (!Array.isArray(points) || points.length < 100 || !Number.isFinite(now)) return null;
    const timestamp = Number(sample.timestamp || 0);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      if (timestamp <= this.lastSampleAt) return null;
      this.lastSampleAt = timestamp;
    }
    if (now < this.lastInput || now - this.lastInput > 1100) {
      this.reset();
      this.lastSampleAt = timestamp;
    }
    this.lastInput = now;
    let sumX = 0, sumY = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, found = 0;
    for (const p of points) {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      sumX += p.x; sumY += p.y; found++;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (found < 100 || maxX - minX < 12 || maxY - minY < 12) return null;
    const current = { x: sumX / found, y: sumY / found, width: maxX - minX };
    if (this.prev) {
      // The Presage SDK documents reset() on tracking handoff, but a new
      // person can sometimes be acquired with no visible no-face gap.
      // Ignore an abrupt face position/scale change rather than interpreting
      // that person's first position as a giant slide-swipe.
      const displacement = Math.hypot(current.x - this.prev.x, current.y - this.prev.y) /
        Math.max(20, current.width, this.prev.width);
      const scaleRatio = current.width / Math.max(20, this.prev.width);
      if (displacement > 0.42 || scaleRatio > 1.55 || scaleRatio < 0.64) {
        this.reset();
        this.lastSampleAt = timestamp;
        this.lastInput = now;
        this.origin = { ...current };
        this.prev = { ...current };
        this.lastRecenterReason = 'face-reacquired';
        return null;
      }
    }
    const previous = this.prev ?? current;
    // A limited filter suppresses subpixel jitter without requiring large nods.
    const filtered = {
      x: previous.x * 0.4 + current.x * 0.6,
      y: previous.y * 0.4 + current.y * 0.6,
      width: previous.width * 0.4 + current.width * 0.6,
    };
    const frameMovement = Math.hypot(filtered.x - previous.x, filtered.y - previous.y) /
      Math.max(20, filtered.width);
    this.prev = filtered;
    if (!this.origin) {
      this.origin = { ...filtered };
      this.lastRecenterReason = 'new-face';
      return null;
    }

    // Staying in a new, comfortable position means the presenter has
    // stopped moving. This is important when people take turns presenting:
    // never require matching the first person's exact camera coordinates.
    if (frameMovement <= 0.011) {
      if (this.stillSince === null) this.stillSince = now;
    } else {
      this.stillSince = null;
    }

    // Screen-relative position / apparent face width: insensitive to distance.
    const dx = (filtered.x - this.origin.x) / Math.max(20, filtered.width);
    const dy = (filtered.y - this.origin.y) / Math.max(20, filtered.width);
    const hx = Math.abs(dx), vy = Math.abs(dy);
    // These values need real comfort tuning. Trigger only on a real stable
    // sequence; never create a command from camera silence.
    // Retain the previously working recognition method, with slightly
    // gentler travel needed. Two consistent samples remain necessary.
    const horizontalThreshold = 0.075;
    const verticalThreshold = 0.058;
    const neutralX = 0.045, neutralY = 0.045;

    if (!this.armed) {
      const returned = hx <= neutralX && vy <= neutralY;
      if (returned) {
        if (this.neutralSince === null) this.neutralSince = now;
        if (now - this.neutralSince >= 140) {
          this.armed = true;
          this.origin = { ...filtered };
          this.candidate = null;
          this.neutralSince = null;
        }
      } else this.neutralSince = null;

      // A presenter can naturally hold the end of a nod or sit somewhere
      // different. Re-arm from that STILL position, without issuing another
      // command. They must initiate a new movement to fire again.
      if (!this.armed && this.stillSince !== null &&
          now - this.stillSince >= 1100 && now - this.lastCommand >= 1050) {
        this.armed = true;
        this.origin = { ...filtered };
        this.neutralSince = null;
        this.candidate = null;
        this.lastRecenterReason = 'settled-pose';
      }
      return null;
    }

    const horizontal = hx >= horizontalThreshold && hx > vy * 1.2;
    const vertical = vy >= verticalThreshold && vy > hx * 1.2;
    const dir = horizontal ? (dx < 0 ? 'right' : 'left') : vertical ? (dy < 0 ? 'up' : 'down') : null;
    if (!dir) { this.candidate = null; return null; }
    if (this.candidate?.direction === dir && now - this.candidate.since <= 350) {
      this.candidate.count += 1;
    } else {
      this.candidate = { direction: dir, since: now, count: 1 };
    }
    if (this.candidate.count < 2 || now - this.lastCommand < 550) return null;
    this.armed = false;
    this.neutralSince = null;
    this.candidate = null;
    this.lastCommand = now;
    return dir;
  }
}

module.exports = { PresageHeadMotion };
