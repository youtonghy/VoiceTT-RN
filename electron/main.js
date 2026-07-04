const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, desktopCapturer, shell, session, protocol } = require('electron');

if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'MacCatapLoopbackAudioForScreenShare');
}

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

function resolveRendererBuildId() {
  try {
    const indexHtml = fs.readFileSync(staticIndex, 'utf8');
    const scriptMatch = indexHtml.match(/\/_expo\/static\/js\/web\/index-([a-f0-9]+)\.js/);
    if (scriptMatch?.[1]) {
      return scriptMatch[1];
    }
    const stats = fs.statSync(staticIndex);
    return String(Math.round(stats.mtimeMs));
  } catch (error) {
    return appVersion;
  }
}

function addRendererCacheBust(targetUrl) {
  const parsedUrl = new URL(targetUrl);
  parsedUrl.searchParams.set('v', resolveRendererBuildId());
  return parsedUrl.toString();
}

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

let runtimeStartUrl = envStartUrl || addRendererCacheBust(APP_PROTOCOL_URL);

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

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function isExternalHttpUrl(targetUrl) {
  try {
    const protocol = new URL(targetUrl).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function configurePermissions() {
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (
      permission !== 'media' &&
      permission !== 'microphone' &&
      permission !== 'display-capture'
    ) {
      return false;
    }
    if (permission === 'display-capture') {
      const targetUrl = details?.requestingUrl || requestingOrigin || webContents.getURL();
      return isTrustedOrigin(targetUrl);
    }
    const mediaTypes = details?.mediaTypes ?? [];
    if (permission === 'media' && !mediaTypes.includes('audio')) {
      return false;
    }
    const targetUrl = details?.requestingUrl || webContents.getURL();
    return isTrustedOrigin(targetUrl);
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (
      permission !== 'media' &&
      permission !== 'microphone' &&
      permission !== 'display-capture'
    ) {
      callback(false);
      return;
    }
    if (permission === 'display-capture') {
      const targetUrl = details?.requestingUrl || webContents.getURL();
      callback(isTrustedOrigin(targetUrl));
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

function configureDisplayMediaCapture() {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const targetUrl = request?.requestingUrl || request?.frame?.url || request?.securityOrigin;
    const securityOrigin = request?.securityOrigin;
    const trusted = isTrustedOrigin(targetUrl) || isTrustedOrigin(securityOrigin);
    console.info('[electron] Display media request', {
      securityOrigin,
      targetUrl,
      audioRequested: request?.audioRequested,
      videoRequested: request?.videoRequested,
      userGesture: request?.userGesture,
      trusted,
    });
    if (!trusted) {
      console.warn('[electron] Display media request denied for untrusted origin', {
        securityOrigin,
        targetUrl,
      });
      callback({});
      return;
    }
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        console.info('[electron] Display media screen sources resolved', {
          count: sources.length,
        });
        const [screen] = sources;
        if (!screen) {
          console.warn('[electron] Display media request denied because no screen source was available');
          callback({});
          return;
        }
        callback({ video: screen, audio: 'loopback' });
      })
      .catch((error) => {
        console.warn('[electron] Failed to resolve display media source', error);
        callback({});
      });
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
  if (resolvedPath !== staticRoot && !isPathInside(staticRoot, resolvedPath)) {
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
    throw new Error('Missing web build. Run `bun run desktop:build` first.');
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

async function clearRendererHttpCache() {
  if (envStartUrl) {
    return;
  }
  try {
    await session.defaultSession.clearCache();
  } catch (error) {
    console.warn('[electron] Failed to clear renderer cache', error);
  }
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
    !app.isPackaged && (Boolean(envStartUrl) || process.env.ELECTRON_OPEN_DEVTOOLS === '1');
  if (shouldOpenDevTools) {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  window.webContents.on('before-input-event', (event, input) => {
    const isToggleShortcut =
      input.key === 'F12' || (input.key === 'I' && input.control && input.shift);
    if (isToggleShortcut) {
      if (shouldOpenDevTools) {
        window.webContents.openDevTools({ mode: 'detach' });
      }
      event.preventDefault();
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedOrigin(url)) {
      return;
    }
    event.preventDefault();
    if (isExternalHttpUrl(url)) {
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(async () => {
  applyAppMetadata();
  configurePermissions();
  configureDisplayMediaCapture();
  try {
    if (!envStartUrl) {
      await clearRendererHttpCache();
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
