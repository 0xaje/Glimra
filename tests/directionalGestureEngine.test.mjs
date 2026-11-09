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
