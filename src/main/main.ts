import path from 'node:path';
import { app, BrowserWindow, session, ipcMain } from 'electron';
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Glimra',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false, // Required for node-sdk FFI IPC integration
      nodeIntegration: false,
    },
    show: false,
  });

  // Wire up SmartSpectra IPC bindings
  try {
    bindSmartSpectraIpc(mainWindow);
  } catch (err) {
    console.error('[Glimra] Failed to bind SmartSpectra IPC:', err);
  }

  // Handle camera permission requests explicitly
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      // In production, this can also check presenter preference
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
  });
}

// Handle fullscreen presentation toggles from renderer
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
