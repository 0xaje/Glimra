import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow, session, ipcMain, safeStorage } from 'electron';
import { fork, type ChildProcess } from 'node:child_process';

// Set up native runtime library path for packaged distributions
if (app.isPackaged && !process.env.SMARTSPECTRA_CAPI_PATH) {
  const LIB_MAP: Record<string, string> = {
    darwin: 'libsmartspectra_capi.dylib',
    win32: 'smartspectra_capi.dll',
    linux: 'libsmartspectra_capi.so',
  };
  const libName = LIB_MAP[process.platform];
  if (libName) {
    process.env.SMARTSPECTRA_CAPI_PATH = path.join(process.resourcesPath, 'smartspectra', libName);
  }
}

let mainWindow: BrowserWindow | null = null;
let hasUserCameraConsent = false;
let presageChild: ChildProcess | null = null;
let presageGeneration = 0;
let presageStopping: Promise<void> | null = null;

const getSecureStoragePath = () => path.join(app.getPath('userData'), 'glimra_auth.bin');
const safeKeychainAvailable = () => safeStorage.isEncryptionAvailable() &&
  (typeof safeStorage.getSelectedStorageBackend !== 'function' ||
    safeStorage.getSelectedStorageBackend() !== 'basic_text');
const isMainWindowSender = (event: Electron.IpcMainInvokeEvent): boolean =>
  !!mainWindow && !mainWindow.isDestroyed() && event.sender.id === mainWindow.webContents.id;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Glimra',
    backgroundColor: '#0c0e12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security Architecture:
      // contextIsolation is strictly enforced: renderer main world cannot access preload world.
      // nodeIntegration is disabled: renderer cannot access Node require(), fs, or child_process.
      // Validate sandboxed preload and IPC on Windows before changing this setting.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // Native SmartSpectra runs in a dedicated Node child, not an Electron
  // renderer frame pump. No raw camera frames enter renderer IPC.

  // Restrict camera permissions to verified application origin and explicit presenter consent
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      const url = webContents.getURL();
      const isTrustedOrigin =
        url.startsWith('file://') ||
        (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) ||
        url.startsWith('http://localhost:5173') ||
        url.startsWith('http://127.0.0.1:5173');

      if (!isTrustedOrigin) {
        console.warn(`[Glimra Security] Denied camera request from untrusted origin: ${url}`);
        callback(false);
        return;
      }

      if (!hasUserCameraConsent) {
        console.warn('[Glimra Security] Denied camera request: Presenter has not granted explicit consent');
        callback(false);
        return;
      }

      callback(true);
      return;
    }
    callback(false);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // In development, load from Vite dev server. In production, load dist index.html.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    hasUserCameraConsent = false;
    void stopPresageWorker();
  });
}


/**
 * Single real Presage-native capture session.
 * A Node child reproduces the working SmartSpectraSDK.useCamera() path.
 * Only derived commands and status cross IPC; raw frames/landmarks never do.
 */
function authorized(event: Electron.IpcMainInvokeEvent): boolean {
  return hasUserCameraConsent &&
    !!mainWindow && !mainWindow.isDestroyed() &&
    event.sender.id === mainWindow.webContents.id;
}

async function stopPresageWorker(): Promise<void> {
  // Invalidate waiting starts even when another request is already stopping the worker.
  presageGeneration++;
  if (presageStopping) return presageStopping;
  const child = presageChild;
  presageChild = null;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const stop = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => child.kill(), 3000);
    // A kill request is asynchronous. Wait for the old process to actually close.
    child.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
    try {
      if (child.connected) child.send({ type: 'stop' });
      else child.kill();
    } catch {
      child.kill();
    }
  });
  presageStopping = stop;
  try { await stop; } finally { presageStopping = null; }
}

ipcMain.handle('glimra:presage-start', async (event, apiKey: string, mode: string) => {
  if (!authorized(event)) throw new Error('Camera consent is required for Presage capture.');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('SmartSpectra API key is required.');
  const stopping = stopPresageWorker();
  const generation = presageGeneration;
  await stopping;
  if (generation !== presageGeneration || !authorized(event)) return false;

  // Worker is included as a plain .cjs file inside app.asar in production.
  // Running Electron as Node avoids the renderer's frame-transfer bottleneck.
  const workerPath = path.join(app.getAppPath(), 'src', 'main', 'presageNativeWorker.cjs');
  if (!fs.existsSync(workerPath)) throw new Error('Native Presage worker is missing from this build.');
  const child = fork(workerPath, [], {
    execPath: process.execPath,
    cwd: app.isPackaged ? path.dirname(app.getAppPath()) : app.getAppPath(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    silent: true,
  });
  presageChild = child;
  child.stdout?.on('data', data => {
    // SDK native logs may be verbose. Never dump metrics or credentials.
    const message = String(data).trim();
    if (message) console.info('[Glimra/Presage native]', message.slice(0, 500));
  });
  child.stderr?.on('data', data => {
    const message = String(data).trim();
    if (message) console.warn('[Glimra/Presage native]', message.slice(0, 500));
  });
  child.on('message', message => {
    if (generation !== presageGeneration || child !== presageChild) return;
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Worker emits only validated derived events and non-biometric counts.
    mainWindow.webContents.send('glimra:presage-event', message);
  });
  child.on('error', error => {
    if (generation !== presageGeneration) return;
    mainWindow?.webContents.send('glimra:presage-event', {
      type: 'error', code: 'process', message: error.message,
    });
  });
  child.on('close', (code, signal) => {
    if (generation !== presageGeneration) return;
    presageChild = null;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('glimra:presage-event', {
      type: 'error', code: 'process-exit',
      message: 'Presage native capture exited (' + (signal ?? code ?? 'unknown') + ').',
    });
  });
  // Send the key through IPC, not command-line arguments or the environment.
  // Never log it; it exists only for this consented SDK session.
  child.send({ type: 'start', key: apiKey.trim(), mode: mode === 'eyes' ? 'eyes' : 'head' });
  return true;
});

ipcMain.handle('glimra:presage-stop', async event => {
  // The current window may intentionally revoke consent before stopping.
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) return false;
  await stopPresageWorker();
  return true;
});

ipcMain.handle('glimra:presage-control', (event, command: string, value: unknown) => {
  if (!authorized(event) || !presageChild?.connected) return false;
  if (command === 'mode') {
    if (value !== 'head' && value !== 'eyes') return false;
    presageChild.send({ type: 'mode', mode: value });
  } else if (command === 'pause') {
    if (typeof value !== 'boolean') return false;
    presageChild.send({ type: 'pause', paused: value });
  } else if (command === 'calibration') {
    if (typeof value !== 'boolean') return false;
    presageChild.send({ type: 'calibration', enabled: value });
  } else if (command === 'recenter') {
    if (value !== true) return false;
    presageChild.send({ type: 'recenter' });
  } else if (command === 'timing') {
    if (!value || typeof value !== 'object') return false;
    const v = value as { minIntentionalBlinkMs?: number; maxIntentionalBlinkMs?: number; refractoryCooldownMs?: number };
    const min = Number(v.minIntentionalBlinkMs);
    const max = Number(v.maxIntentionalBlinkMs);
    const cooldown = Number(v.refractoryCooldownMs);
    if (![min, max, cooldown].every(Number.isFinite) || min < 300 || min > 1200 || max < min + 100 || max > 2500 || cooldown < 500 || cooldown > 3000) return false;
    presageChild.send({ type: 'timing', min, max, cooldown });
  } else return false;
  return true;
});

// IPC: Record explicit presenter consent for camera capture
ipcMain.handle('glimra:set-camera-consent', (event, consent: boolean) => {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) return false;
  hasUserCameraConsent = !!consent;
  if (!hasUserCameraConsent) void stopPresageWorker();
  return hasUserCameraConsent;
});

// API keys require real OS-backed safeStorage. Never write plaintext.
ipcMain.handle('glimra:store-api-key', async (event, apiKey: string) => {
  if (!isMainWindowSender(event) || typeof apiKey !== 'string') return false;
  const cleanKey = apiKey.trim();
  const filePath = getSecureStoragePath();
  try {
    if (!cleanKey) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    }
    if (!safeKeychainAvailable()) {
      console.warn('[Glimra Security] No OS encryption: refusing to store an API key.');
      return false;
    }
    fs.writeFileSync(filePath, safeStorage.encryptString(cleanKey), { mode: 0o600 });
    return true;
  } catch (error) {
    console.error('[Glimra Security] Could not save encrypted API key:', error);
    return false;
  }
});

ipcMain.handle('glimra:retrieve-api-key', async event => {
  if (!isMainWindowSender(event) || !safeKeychainAvailable()) return '';
  const filePath = getSecureStoragePath();
  if (!fs.existsSync(filePath)) return '';
  try {
    return safeStorage.decryptString(fs.readFileSync(filePath));
  } catch {
    // Older versions could write unencrypted fallback files on unsupported
    // keychains. Fail closed and do not attempt to treat plaintext as a key.
    console.warn('[Glimra Security] Existing credential is not decryptable; replace it in Settings.');
    return '';
  }
});

// IPC: Fullscreen presentation controls
ipcMain.handle('glimra:toggle-fullscreen', () => {
  if (mainWindow) {
    const isFull = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFull);
    return !isFull;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  hasUserCameraConsent = false;
  void stopPresageWorker();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
