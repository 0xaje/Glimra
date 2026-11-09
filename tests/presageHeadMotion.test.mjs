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
  assert.equal(engine.observe(pose(274, 240, 240), 240), null, 'holding the turn cannot fire twice');
  for (let now = 290; now <= 690; now += 50) {
    assert.equal(engine.observe(pose(274, 240, now), now), null, 'held turn must not repeat');
  }
});

test('vertical head movement produces a PDF scroll direction', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  engine.observe(pose(300, 260, 80), 80);
  assert.equal(engine.observe(pose(300, 260, 160), 160), 'down');
  assert.equal(engine.observe(pose(300, 260, 240), 240), null, 'holding a nod cannot scroll twice');
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
  assert.equal(engine.observe(pose(270, 240, 240), 240), null, 'held movement cannot repeat');
  engine.observe(pose(298, 240, 310), 310);
  engine.observe(pose(298, 240, 490), 490);
  engine.observe(pose(298, 240, 650), 650);
  engine.observe(pose(325, 240, 800), 800);
  assert.equal(engine.observe(pose(325, 240, 870), 870), 'left');
});

test('new presenter appearing far from the first face recalibrates without a false slide', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  engine.observe(pose(300, 240, 60), 60);
  assert.equal(engine.observe(pose(460, 240, 120), 120), null, 'handoff must never count as a right/left gesture');
  for (let now = 180; now <= 580; now += 80) {
    assert.equal(engine.observe(pose(460, 240, now), now), null, 'new presenter holding still must not navigate');
  }
  const commands = [];
  for (let now = 700; now <= 1180; now += 80) {
    const direction = engine.observe(pose(434, 240, now), now);
    if (direction) commands.push(direction);
  }
  assert.deepEqual(commands, ['right'], 'new face gets independent comfortable head control');
});

test('settling at the end of a head turn automatically rearms without repeating', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  const commands = [];
  for (let now = 80; now <= 2700; now += 80) {
    const direction = engine.observe(pose(270, 240, now), now);
    if (direction) commands.push(direction);
  }
  assert.deepEqual(commands, ['right'], 'holding a pose must not repeatedly advance');
  for (let now = 2800; now <= 3200; now += 80) {
    engine.observe(pose(270, 240, now), now);
  }
  // No exact return to the original first camera position is necessary.
  for (let now = 3300; now <= 3700; now += 80) {
    const direction = engine.observe(pose(296, 240, now), now);
    if (direction) commands.push(direction);
  }
  assert.ok(commands.includes('left'), 'new motion after resting should work again');
});

test('face-tracking reset clears the first presenter baseline', () => {
  const engine = new PresageHeadMotion();
  engine.observe(pose(300, 240, 0), 0);
  engine.observe(pose(300, 240, 80), 80);
  assert.equal(engine.observe(pose(450, 240, 160, true, true), 160), null);
  assert.equal(engine.observe(pose(450, 240, 240), 240), null);
});
