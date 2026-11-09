import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const source = readFileSync(join(process.cwd(), 'src/renderer/src/engine/headPoseGestureEngine.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { HeadPoseGestureEngine, readFacePose } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);

// Synthetic landmarks test mathematical behavior only, never masquerade
// as real hardware/SmartSpectra measurements.
function face({ x = .5, y = .5, width = .2, turn = 0, roll = 0, nod = 0 } = {}) {
  const points = Array.from({ length: 264 }, () => ({ x: .5, y: .5 }));
  points[33] = { x: x - width / 2, y: y - .025 + roll * width / 2 };
  points[263] = { x: x + width / 2, y: y - .025 - roll * width / 2 };
  points[1] = { x: x - turn * width, y: y + .03 + nod * width };
  return points;
}

test('small natural turn advances once, then the opposite turn goes back', () => {
  const engine = new HeadPoseGestureEngine();
  engine.observe(face({ x: .72 }), 0);
  assert.equal(engine.observe(face({ x: .72, turn: .10 }), 150), null);
  assert.equal(engine.observe(face({ x: .72, turn: .10 }), 300), null);
  assert.deepEqual(engine.observe(face({ x: .72, turn: .10 }), 450),
    { source: 'head', direction: 'right' });
  assert.equal(engine.observe(face({ x: .72, turn: .10 }), 1500), null, 'held pose must not repeat');
  engine.observe(face({ x: .72 }), 1650);
  engine.observe(face({ x: .72 }), 1800);
  engine.observe(face({ x: .72 }), 2050);
  engine.observe(face({ x: .72, turn: -.10 }), 2200);
  engine.observe(face({ x: .72, turn: -.10 }), 2350);
  assert.deepEqual(engine.observe(face({ x: .72, turn: -.10 }), 2500),
    { source: 'head', direction: 'left' });
});

test('small head nods issue up and down scroll commands', () => {
  const engine = new HeadPoseGestureEngine();
  engine.observe(face(), 0);
  engine.observe(face({ nod: -.10 }), 150);
  assert.deepEqual(engine.observe(face({ nod: -.10 }), 300),
    { source: 'head', direction: 'up' });
  engine.observe(face(), 600);
  engine.observe(face(), 850);
  engine.observe(face(), 1100);
  engine.observe(face({ nod: .10 }), 1250);
  assert.deepEqual(engine.observe(face({ nod: .10 }), 1400),
    { source: 'head', direction: 'down' });
});

test('person off-center at start and still posture do not trigger commands', () => {
  const engine = new HeadPoseGestureEngine();
  assert.equal(engine.observe(face({ x: .8, y: .72, turn: .16, nod: -.15 }), 0), null);
  for (let t = 150; t < 5000; t += 150) {
    assert.equal(engine.observe(face({ x: .8, y: .72, turn: .16, nod: -.15 }), t), null);
  }
  const pose = readFacePose(face({ x: .8, y: .72, turn: .16, nod: -.15 }));
  assert.ok(pose && Number.isFinite(pose.turn) && Number.isFinite(pose.nod));
});

test('one jittery sample, pause and face loss never issue a command', () => {
  const engine = new HeadPoseGestureEngine();
  engine.observe(face(), 0);
  assert.equal(engine.observe(face({ turn: .18 }), 150), null);
  assert.equal(engine.observe(face(), 300), null);
  engine.setPaused(true);
  assert.equal(engine.observe(face({ turn: .5 }), 450), null);
  engine.setPaused(false);
  engine.observe(face(), 600);
  engine.observe(null, 1500);
  assert.equal(engine.observe(face({ turn: .18 }), 1600), null);
});

test('facial geometry rejects missing keypoints and implausibly small faces', () => {
  assert.equal(readFacePose([]), null);
  assert.equal(readFacePose(face({ width: .02 })), null);
});

test('gentle side tilt is accepted without shifting the whole head on screen', () => {
  const engine = new HeadPoseGestureEngine();
  engine.observe(face(), 0);
  engine.observe(face({ roll: .12 }), 150);
  engine.observe(face({ roll: .12 }), 300);
  assert.deepEqual(engine.observe(face({ roll: .12 }), 450),
    { source: 'head', direction: 'right' });
});

test('remaining still for several minutes does not disconnect head gestures', () => {
  const engine = new HeadPoseGestureEngine();
  for (let time = 0; time < 5 * 60_000; time += 150) {
    assert.equal(engine.observe(face(), time), null);
  }
  engine.observe(face({ turn: .12 }), 300_000);
  const first = engine.observe(face({ turn: .12 }), 300_150);
  const second = engine.observe(face({ turn: .12 }), 300_300);
  assert.ok(first?.direction === 'right' || second?.direction === 'right');
});
