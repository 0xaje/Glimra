import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PresageHeadMotion } = require('../src/main/presageHeadMotion.cjs');

// Pure mathematical unit fixtures; these are NOT camera recordings, SDK
// measurements, demo data, or fake runtime signals. Runtime accepts only
// real stable Presage face.landmarks from the native capture process.
function pose(x = 300, y = 240, timestampMs = 0, stable = true, reset = false) {
  const points = Array.from({ length: 478 }, (_, index) => {
    const radians = 2 * Math.PI * index / 478;
    return { x: x + 95 * Math.cos(radians), y: y + 66 * Math.sin(radians) };
  });
  return { stable, reset, timestamp: 1700000000000000 + timestampMs * 1000, value: points };
}

test('gentle real-coordinate head movement produces one slide direction', () => {
  const engine = new PresageHeadMotion();
  assert.equal(engine.observe(pose(300, 240, 0), 0), null);
  assert.equal(engine.observe(pose(274, 240, 80), 80), null);
  assert.equal(engine.observe(pose(274, 240, 160), 160), 'right');
  for (let now = 200; now <= 700; now += 50) {
    assert.equal(engine.observe(pose(274, 240, now), now), null, 'held turn must not repeat');
  }
});

test('vertical head movement produces a PDF scroll direction', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  engine.observe(pose(300, 260, 80), 80);
  assert.equal(engine.observe(pose(300, 260, 160), 160), 'down');
});

test('unstable or reset frames never create commands', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  assert.equal(engine.observe(pose(270, 240, 80, false), 80), null);
  assert.equal(engine.observe(pose(270, 240, 160, true, true), 160), null);
  assert.equal(engine.observe(pose(270, 240, 240), 240), null, 'first fresh frame sets baseline');
});

test('repeated timestamps are ignored', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  assert.equal(engine.observe(pose(275, 240, 0), 60), null);
});

test('a second gesture is possible after relaxing toward center', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  engine.observe(pose(270, 240, 80), 80);
  assert.equal(engine.observe(pose(270, 240, 160), 160), 'right');
  engine.observe(pose(298, 240, 240), 240);
  engine.observe(pose(298, 240, 410), 410);
  engine.observe(pose(325, 240, 800), 800);
  assert.equal(engine.observe(pose(325, 240, 870), 870), 'left');
});
