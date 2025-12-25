const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, shell, session, protocol } = require('electron');

const envStartUrl = process.env.ELECTRON_START_URL;
const APP_PROTOCOL = 'app';
const APP_PROTOCOL_HOST = 'local';
const APP_PROTOCOL_URL = `${APP_PROTOCOL}://${APP_PROTOCOL_HOST}`;
const staticRoot = path.join(__dirname, '..', 'web-build');
const staticIndex = path.join(staticRoot, 'index.html');
const appConfig = require(path.join(__dirname, '..', 'app.json'));
const expoConfig = appConfig?.expo ?? appConfig ?? {};
const appName = expoConfig?.name || app.getName();
const appVersion = expoConfig?.version || app.getVersion();
const appId = expoConfig?.android?.package || expoConfig?.ios?.bundleIdentifier || expoConfig?.slug || appName;
const rawIconPath = expoConfig?.icon ? path.join(__dirname, '..', expoConfig.icon) : null;
const appIconPath = rawIconPath && fs.existsSync(rawIconPath) ? rawIconPath : null;
const userDataPath = path.join(app.getPath('appData'), appName);

app.setPath('userData', userDataPath);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let runtimeStartUrl = envStartUrl || APP_PROTOCOL_URL;

function isTrustedOrigin(targetUrl) {
  if (!targetUrl) {
    return false;
  }
  try {
    return new URL(targetUrl).origin === new URL(runtimeStartUrl).origin;
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

function resolveStaticFilePath(requestUrl) {
  const parsedUrl = new URL(requestUrl, 'http://localhost');
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const resolvedPath = path.resolve(staticRoot, `.${pathname}`);
  if (!resolvedPath.startsWith(staticRoot)) {
    return null;
  }
  if (fs.existsSync(resolvedPath)) {
    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      const indexPath = path.join(resolvedPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    } else {
      return resolvedPath;
    }
  }
  if (!path.extname(resolvedPath)) {
    const htmlPath = `${resolvedPath}.html`;
    if (fs.existsSync(htmlPath)) {
      return htmlPath;
    }
  }
  return staticIndex;
}

function registerAppProtocol() {
  if (!fs.existsSync(staticIndex)) {
    throw new Error('Missing web build. Run `npm run desktop:build` first.');
  }
  protocol.registerFileProtocol(APP_PROTOCOL, (request, callback) => {
    try {
      const filePath = resolveStaticFilePath(request.url);
      if (!filePath) {
        callback({ error: -6 });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      callback({ path: filePath, mimeType: mimeTypes[ext] || 'application/octet-stream' });
    } catch (error) {
      callback({ error: -6 });
    }
  });
}

function createMainWindow(startUrl) {
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
    Boolean(envStartUrl) || process.env.ELECTRON_OPEN_DEVTOOLS === '1';
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
    if (runtimeStartUrl && url.startsWith(runtimeStartUrl)) {
      return;
    }
    if (!runtimeStartUrl && url.startsWith('file://')) {
      return;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(async () => {
  applyAppMetadata();
  configurePermissions();
  try {
    if (!envStartUrl) {
      registerAppProtocol();
    }
    createMainWindow(runtimeStartUrl);
  } catch (error) {
    console.error('[electron] Failed to start renderer', error);
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow(runtimeStartUrl);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
