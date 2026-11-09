import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
);

async function loadCameraHandlers() {
  const handlers = new Map();
  const workers = [];
  const window = new EventEmitter();
  window.webContents = { id: 1 };
  window.isDestroyed = () => false;
  window.loadURL = window.loadFile = () => {};
  const app = Object.assign(new EventEmitter(), {
    getAppPath: () => process.cwd(),
    whenReady: () => Promise.resolve(),
  });

  // Exercise the real IPC handlers with process test doubles. No camera or SDK data is simulated.
  runInNewContext(outputText, {
    __dirname: process.cwd(),
    exports: {},
    process,
    setTimeout,
    clearTimeout,
    require(name) {
      if (name === 'electron') return {
        app,
        BrowserWindow: class { constructor() { return window; } },
        ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
        session: { defaultSession: { setPermissionRequestHandler() {} } },
      };
      if (name === 'node:child_process') return {
        fork() {
          const worker = Object.assign(new EventEmitter(), {
            connected: true,
            exitCode: null,
            signalCode: null,
            send() {},
            kill() {},
          });
          workers.push(worker);
          return worker;
        },
      };
      return require(name);
    },
  });
  await app.whenReady();
  const invoke = (command, ...args) => handlers.get('glimra:' + command)({ sender: { id: 1 } }, ...args);
  invoke('set-camera-consent', true);
  const start = () => invoke('presage-start', 'test-only-placeholder', 'head');
  assert.equal(await start(), true);
  return { invoke, start, workers, window };
}

test('revoking consent cancels a waiting start even if consent is granted again', async () => {
  const { invoke, start, workers } = await loadCameraHandlers();
  const pending = start();
  invoke('set-camera-consent', false);
  invoke('set-camera-consent', true);
  workers[0].emit('close');
  assert.equal(await pending, false);
  assert.equal(workers.length, 1);
  assert.equal(await start(), true);
  assert.equal(workers.length, 2);
});

test('only the latest start can launch a worker after shutdown', async () => {
  const { start, workers } = await loadCameraHandlers();
  const earlier = start();
  const latest = start();
  assert.equal(workers.length, 1);
  workers[0].emit('close');
  assert.deepEqual(await Promise.all([earlier, latest]), [false, true]);
  assert.equal(workers.length, 2);
});

test('explicit stop cancels a waiting start even with consent still granted', async () => {
  const { invoke, start, workers } = await loadCameraHandlers();
  const pending = start();
  const stopped = invoke('presage-stop');
  workers[0].emit('close');
  assert.deepEqual(await Promise.all([pending, stopped]), [false, true]);
  assert.equal(workers.length, 1);
});

test('closing the window cancels a waiting start', async () => {
  const { start, workers, window } = await loadCameraHandlers();
  const pending = start();
  window.emit('closed');
  workers[0].emit('close');
  assert.equal(await pending, false);
  assert.equal(workers.length, 1);
});
