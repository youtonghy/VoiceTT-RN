const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const electronEntry = path.join(rootDir, 'electron', 'main.js');
const port = Number(process.env.EXPO_WEB_PORT || 19006);
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function spawnCommand(command, args, options = {}) {
  return spawn(command, args, {
    ...options,
    shell: process.platform === 'win32',
  });
}

const expoArgs = ['expo', 'start', '--web', '--port', String(port)];
const expoProcess = spawnCommand(npxCommand, expoArgs, {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

let electronProcess;
let shuttingDown = false;

function resolveElectronCommand() {
  const localElectron = path.join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron'
  );
  if (fs.existsSync(localElectron)) {
    return { command: localElectron, args: [electronEntry] };
  }
  return { command: npxCommand, args: ['electron', electronEntry] };
}

function waitForServer({ retries = 240, delayMs = 500 } = {}) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = () => {
      if (shuttingDown) {
        reject(new Error('shutdown'));
        return;
      }
      const request = http.get(
        {
          host: '127.0.0.1',
          port,
          path: '/',
          timeout: 1000,
        },
        (response) => {
          response.resume();
          resolve();
        }
      );
      request.on('timeout', () => {
        request.destroy();
      });
      request.on('error', () => {
        attempts += 1;
        if (attempts >= retries) {
          reject(new Error('Expo web server did not start in time.'));
          return;
        }
        setTimeout(tick, delayMs);
      });
    };
    tick();
  });
}

async function startElectron() {
  try {
    await waitForServer();
  } catch (error) {
    if (!shuttingDown) {
      console.error('[electron-dev] ' + (error instanceof Error ? error.message : String(error)));
      shutdown(1);
    }
    return;
  }

  const { command, args } = resolveElectronCommand();
  electronProcess = spawnCommand(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_START_URL: `http://localhost:${port}`,
    },
  });

  electronProcess.on('exit', (code) => {
    if (!shuttingDown) {
      shutdown(code ?? 0);
    }
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  if (expoProcess && !expoProcess.killed) {
    expoProcess.kill();
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

expoProcess.on('exit', (code) => {
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});

startElectron();
