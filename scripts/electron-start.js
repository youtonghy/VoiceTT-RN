const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const electronEntry = path.join(rootDir, 'electron', 'main.js');
const webBuildIndex = path.join(rootDir, 'web-build', 'index.html');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function spawnCommand(command, args, options = {}) {
  return spawn(command, args, {
    ...options,
    shell: process.platform === 'win32',
  });
}

if (!fs.existsSync(webBuildIndex)) {
  console.error('[electron-start] Missing web build. Run `npm run desktop:build` first.');
  process.exit(1);
}

const localElectron = path.join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

const useLocal = fs.existsSync(localElectron);
const command = useLocal ? localElectron : npxCommand;
const args = useLocal ? [electronEntry] : ['electron', electronEntry];

const electronProcess = spawnCommand(command, args, {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

electronProcess.on('exit', (code) => {
  process.exit(code ?? 0);
});
