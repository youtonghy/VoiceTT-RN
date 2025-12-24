const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, shell, session } = require('electron');

const startUrl = process.env.ELECTRON_START_URL;
const staticIndex = path.join(__dirname, '..', 'web-build', 'index.html');
const appConfig = require(path.join(__dirname, '..', 'app.json'));
const expoConfig = appConfig?.expo ?? appConfig ?? {};
const appName = expoConfig?.name || app.getName();
const appVersion = expoConfig?.version || app.getVersion();
const appId = expoConfig?.android?.package || expoConfig?.ios?.bundleIdentifier || expoConfig?.slug || appName;
const rawIconPath = expoConfig?.icon ? path.join(__dirname, '..', expoConfig.icon) : null;
const appIconPath = rawIconPath && fs.existsSync(rawIconPath) ? rawIconPath : null;

function isTrustedOrigin(targetUrl) {
  if (!targetUrl) {
    return false;
  }
  if (!startUrl) {
    return targetUrl.startsWith('file://');
  }
  try {
    return new URL(targetUrl).origin === new URL(startUrl).origin;
  } catch (error) {
    return false;
  }
}

function configurePermissions() {
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission !== 'media' && permission !== 'microphone') {
      return false;
    }
    const mediaTypes = details?.mediaTypes ?? [];
    if (permission === 'media' && !mediaTypes.includes('audio')) {
      return false;
    }
    const targetUrl = details?.requestingUrl || webContents.getURL();
    return isTrustedOrigin(targetUrl);
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission !== 'media' && permission !== 'microphone') {
      callback(false);
      return;
    }
    const mediaTypes = details?.mediaTypes ?? [];
    if (permission === 'media' && !mediaTypes.includes('audio')) {
      callback(false);
      return;
    }
    const targetUrl = details?.requestingUrl || webContents.getURL();
    callback(isTrustedOrigin(targetUrl));
  });
}

function applyAppMetadata() {
  if (appName) {
    app.setName(appName);
  }
  if (appId && typeof app.setAppUserModelId === 'function') {
    app.setAppUserModelId(appId);
  }
  if (appName && appVersion && typeof app.setAboutPanelOptions === 'function') {
    app.setAboutPanelOptions({
      applicationName: appName,
      version: appVersion,
    });
  }
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: appName,
    ...(appIconPath ? { icon: appIconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  window.removeMenu();

  if (startUrl) {
    window.loadURL(startUrl);
  } else {
    window.loadFile(staticIndex);
  }

  const shouldOpenDevTools =
    Boolean(startUrl) || process.env.ELECTRON_OPEN_DEVTOOLS === '1';
  if (shouldOpenDevTools) {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  window.webContents.on('before-input-event', (event, input) => {
    const isToggleShortcut =
      input.key === 'F12' || (input.key === 'I' && input.control && input.shift);
    if (isToggleShortcut) {
      window.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (startUrl && url.startsWith(startUrl)) {
      return;
    }
    if (!startUrl && url.startsWith('file://')) {
      return;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  applyAppMetadata();
  configurePermissions();
  createMainWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
