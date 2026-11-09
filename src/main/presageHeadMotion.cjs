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
    if (!this.prev) this.prev = current;
    // A limited filter suppresses subpixel jitter without requiring large nods.
    const filtered = {
      x: this.prev.x * 0.4 + current.x * 0.6,
      y: this.prev.y * 0.4 + current.y * 0.6,
      width: this.prev.width * 0.4 + current.width * 0.6,
    };
    this.prev = filtered;
    if (!this.origin) { this.origin = { ...filtered }; return null; }

    // Screen-relative position / apparent face width: insensitive to distance.
    const dx = (filtered.x - this.origin.x) / Math.max(20, filtered.width);
    const dy = (filtered.y - this.origin.y) / Math.max(20, filtered.width);
    const hx = Math.abs(dx), vy = Math.abs(dy);
    // These values need real comfort tuning. Trigger only on a real stable
    // sequence; never create a command from camera silence.
    const horizontalThreshold = 0.085;
    const verticalThreshold = 0.065;
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
