import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('face loss pauses commands, return resumes, and manual pause remains', async () => {
  const statuses = [];
  let receive;
  let advances = 0;
  const source = readFileSync('src/renderer/src/engine/presageNativeController.ts', 'utf8');
  const exports = {};
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports,
    window: { glimraDesktop: {
      onPresageEvent(callback) { receive = callback; return () => {}; },
      startPresage: async () => true,
      controlPresage: async () => true,
    } },
  });
  const controller = new exports.PresageNativeController({
    onStatusChange: status => statuses.push(status),
    onValidationChange() {}, onSensorReady() {}, onSensorLost() {},
    onGestureDetected() {}, onCalibrationSample() {}, onError() { assert.fail('Unexpected error'); },
    onNextSlide() { advances++; }, onPrevSlide() {}, onScroll() {},
  });
  await controller.start('test-placeholder');
  receive({ type: 'state', state: 'tracking' });
  receive({ type: 'face-status', tracked: true });
  assert.equal(statuses.at(-1), 'tracking');
  receive({ type: 'face-status', tracked: false });
  assert.equal(statuses.at(-1), 'paused');
  receive({ type: 'gesture', source: 'head', direction: 'right' });
  assert.equal(advances, 0);
  receive({ type: 'face-status', tracked: true });
  receive({ type: 'gesture', source: 'head', direction: 'right' });
  assert.equal(advances, 1);
  controller.setPaused(true);
  receive({ type: 'face-status', tracked: false });
  receive({ type: 'face-status', tracked: true });
  assert.equal(statuses.at(-1), 'paused');
  receive({ type: 'gesture', source: 'head', direction: 'right' });
  assert.equal(advances, 1);
});

test('transient SDK fault restarts capture while stop cancels pending recovery', async () => {
  const handlers = new Map();
  const messages = [];
  const timers = [];
  let processMessage;
  let starts = 0;
  let resets = 0;
  class SDK {
    static availableCameras() { return [{}]; }
    on(name, callback) { handlers.set(name, callback); }
    useCamera() {}
    start() { starts++; handlers.get('processingStatus')(2); }
    async stopAsync() {}
    reset() { resets++; }
    async destroy() {}
  }
  runInNewContext(readFileSync('src/main/presageNativeWorker.cjs', 'utf8'), {
    require(name) {
      if (name === './presageHeadMotion.cjs') return { PresageHeadMotion: class { reset() {} } };
      return {
        SmartSpectraSDK: SDK, CameraSelection: { default: 0 }, faceMetrics: [],
        ProcessingStatus: { kRunning: 2, kStarting: 1, kError: 3 },
        ValidationCode: {}, decodeMetrics() {},
      };
    },
    process: {
      connected: true, send: message => messages.push(message), exit() {},
      on(name, callback) { if (name === 'message') processMessage = callback; },
    },
    setInterval: () => ({ unref() {} }),
    setTimeout(callback) { timers.push(callback); return callback; },
    clearTimeout(callback) { const i = timers.indexOf(callback); if (i >= 0) timers.splice(i, 1); },
    Buffer,
  });
  processMessage({ type: 'start', key: 'test-placeholder', mode: 'head' });
  await Promise.resolve();
  handlers.get('error')(8, 'transient processing failure', true);
  assert.equal(messages.at(-1).state, 'waiting');
  assert.equal(messages.some(message => message.type === 'error'), false);
  await timers.shift()();
  assert.equal(starts, 2);
  assert.equal(resets, 1);
  handlers.get('error')(8, 'transient processing failure', true);
  processMessage({ type: 'stop' });
  await Promise.resolve();
  assert.equal(timers.length, 0);
});
