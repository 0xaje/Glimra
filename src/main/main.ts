import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow, session, ipcMain, safeStorage } from 'electron';
import { bindSmartSpectraIpc } from '@smartspectra/node-sdk/main';

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

const getSecureStoragePath = () => path.join(app.getPath('userData'), 'glimra_auth.bin');

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
      // sandbox: false is required because @smartspectra/node-sdk/preload uses Node environment
      // variables (SMARTSPECTRA_DIAGNOSTICS) and direct MessageChannel transfer to main process.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // Wire up SmartSpectra IPC bindings
  try {
    bindSmartSpectraIpc(mainWindow);
  } catch (err) {
    console.error('[Glimra] Failed to bind SmartSpectra IPC:', err);
  }

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
  });
}

// IPC: Record explicit presenter consent for camera capture
ipcMain.handle('glimra:set-camera-consent', (_event, consent: boolean) => {
  hasUserCameraConsent = !!consent;
  return hasUserCameraConsent;
});

// IPC: Secure API Key Storage using Electron safeStorage (OS Keychain / DPAPI / libsecret)
ipcMain.handle('glimra:store-api-key', async (_event, apiKey: string) => {
  if (typeof apiKey !== 'string') return false;
  const cleanKey = apiKey.trim();
  const filePath = getSecureStoragePath();

  try {
    if (!cleanKey) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    }

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(cleanKey);
      fs.writeFileSync(filePath, encrypted);
      return true;
    } else {
      // In headless environments where OS safeStorage is unavailable, store in local restricted file
      const buffer = Buffer.from(cleanKey, 'utf8');
      fs.writeFileSync(filePath, buffer, { mode: 0o600 });
      return true;
    }
  } catch (err) {
    console.error('[Glimra Security] Error saving encrypted credential:', err);
    return false;
  }
});

ipcMain.handle('glimra:retrieve-api-key', async () => {
  const filePath = getSecureStoragePath();
  if (!fs.existsSync(filePath)) return '';

  try {
    const buffer = fs.readFileSync(filePath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buffer);
    } else {
      return buffer.toString('utf8');
    }
  } catch (err) {
    console.error('[Glimra Security] Error decrypting credential:', err);
    return '';
  }
});

ipcMain.handle('glimra:has-api-key', async () => {
  const filePath = getSecureStoragePath();
  return fs.existsSync(filePath);
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

ipcMain.handle('glimra:is-fullscreen', () => {
  return mainWindow?.isFullScreen() ?? false;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
