import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const source = readFileSync(join(process.cwd(), 'src/renderer/src/engine/directionalGestureEngine.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { DirectionalGestureEngine } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const point = (x, y, confidence = 1) => ({ x, y, confidence });

test('head right advances once and requires neutral rearm', () => {
  const engine = new DirectionalGestureEngine();
  assert.equal(engine.observe('head', point(.5, .5), 0), null);
  assert.deepEqual(engine.observe('head', point(.6, .5), 100), { source: 'head', direction: 'right' });
  assert.equal(engine.observe('head', point(.7, .5), 900), null);
  assert.equal(engine.observe('head', point(.5, .5), 1000), null);
  assert.equal(engine.observe('head', point(.5, .5), 1200), null);
  assert.deepEqual(engine.observe('head', point(.4, .5), 1800), { source: 'head', direction: 'left' });
});

test('hand up and down do not become slide navigation', () => {
  const engine = new DirectionalGestureEngine();
  engine.observe('hand', point(.5, .5), 0);
  assert.deepEqual(engine.observe('hand', point(.5, .31), 100), { source: 'hand', direction: 'up' });
  engine.observe('hand', point(.5, .5), 1000);
  engine.observe('hand', point(.5, .5), 1250);
  assert.deepEqual(engine.observe('hand', point(.5, .7), 2000), { source: 'hand', direction: 'down' });
});

test('inactivity does not end the gesture session', () => {
  const engine = new DirectionalGestureEngine();
  engine.observe('head', point(.5, .5), 0);
  assert.deepEqual(engine.observe('head', point(.6, .5), 100), { source: 'head', direction: 'right' });
  engine.observe('head', point(.5, .5), 300000);
  engine.observe('head', point(.5, .5), 300200);
  assert.deepEqual(engine.observe('head', point(.4, .5), 300900), { source: 'head', direction: 'left' });
});

test('low confidence, diagonal motion and pause do not fire', () => {
  const engine = new DirectionalGestureEngine();
  engine.observe('head', point(.5, .5), 0);
  assert.equal(engine.observe('head', point(.7, .7), 100), null);
  assert.equal(engine.observe('head', point(.9, .5, .2), 200), null);
  engine.setPaused(true);
  assert.equal(engine.observe('head', point(.9, .5), 300), null);
});

test('default open-hand left/right swipes give one slide per deliberate move', () => {
  const engine = new DirectionalGestureEngine();
  assert.equal(engine.observe('hand', point(.5, .5), 0), null);
  assert.deepEqual(engine.observe('hand', point(.65, .5), 120), { source: 'hand', direction: 'right' });
  assert.equal(engine.observe('hand', point(.8, .5), 700), null, 'holding a swipe must not change another slide');
  engine.observe('hand', point(.5, .5), 1100);
  engine.observe('hand', point(.5, .5), 1350);
  assert.deepEqual(engine.observe('hand', point(.33, .5), 1900), { source: 'hand', direction: 'left' });
});

test('head nod up/down produces vertical commands without slide navigation', () => {
  const engine = new DirectionalGestureEngine();
  assert.equal(engine.observe('head', point(.5, .5), 0), null);
  assert.deepEqual(engine.observe('head', point(.5, .44), 100), { source: 'head', direction: 'up' });
  assert.equal(engine.observe('head', point(.5, .38), 800), null);
  engine.observe('head', point(.5, .5), 1200);
  engine.observe('head', point(.5, .5), 1450);
  assert.deepEqual(engine.observe('head', point(.5, .57), 2000), { source: 'head', direction: 'down' });
});

test('farther faces require only small natural head displacement', () => {
  const engine = new DirectionalGestureEngine();
  const head = (x, y) => ({ x, y, confidence: 1, faceWidth: .12 });
  assert.equal(engine.observe('head', head(.5, .5), 0), null);
  assert.deepEqual(engine.observe('head', head(.532, .5), 200), { source: 'head', direction: 'right' });
  assert.equal(engine.observe('head', head(.58, .5), 600), null, 'holding a pose must not repeat the command');
  engine.observe('head', head(.5, .5), 850);
  engine.observe('head', head(.5, .5), 1100);
  assert.deepEqual(engine.observe('head', head(.46, .5), 1400), { source: 'head', direction: 'left' });
});

test('natural small head nod scrolls the PDF and does not create a slide command', () => {
  const engine = new DirectionalGestureEngine();
  const head = (x, y) => ({ x, y, confidence: 1, faceWidth: .16 });
  assert.equal(engine.observe('head', head(.5, .5), 0), null);
  assert.deepEqual(engine.observe('head', head(.5, .53), 180), { source: 'head', direction: 'down' });
});

test('no head navigation is triggered by tiny landmark jitter', () => {
  const engine = new DirectionalGestureEngine();
  const head = (x, y) => ({ x, y, confidence: 1, faceWidth: .18 });
  assert.equal(engine.observe('head', head(.5, .5), 0), null);
  for (let time = 150; time <= 3000; time += 150) {
    assert.equal(engine.observe('head', head(.5 + (time % 300 ? .006 : -.006), .5), time), null);
  }
});

test('head can rearm after a relaxed return without matching the exact old pixel position', () => {
  const engine = new DirectionalGestureEngine();
  const head = x => ({ x, y: .5, confidence: 1, faceWidth: .12 });
  engine.observe('head', head(.5), 0);
  assert.deepEqual(engine.observe('head', head(.536), 200),
    { source: 'head', direction: 'right' });
  assert.equal(engine.observe('head', head(.536), 800), null, 'holding a turn cannot repeat');
  // Return naturally to .52, close to center but not the exact .50 baseline.
  // Old engine stayed permanently disarmed here (its radius was only .012).
  assert.equal(engine.observe('head', head(.520), 1000), null);
  assert.equal(engine.observe('head', head(.520), 1250), null);
  assert.deepEqual(engine.observe('head', head(.553), 1550),
    { source: 'head', direction: 'right' });
});

test('head does not rearm or repeat when the presenter keeps holding a turn', () => {
  const engine = new DirectionalGestureEngine();
  const head = x => ({ x, y: .5, confidence: 1, faceWidth: .12 });
  engine.observe('head', head(.5), 0);
  assert.deepEqual(engine.observe('head', head(.54), 200),
    { source: 'head', direction: 'right' });
  for (let now = 400; now <= 5000; now += 200) {
    assert.equal(engine.observe('head', head(.54), now), null);
  }
});
