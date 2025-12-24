const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const useShell = process.platform === 'win32';

const stubDir = path.join(rootDir, 'node_modules', 'fsevents');
let createdStub = false;

function ensureFseventsStub() {
  if (process.platform !== 'win32') {
    return;
  }
  if (fs.existsSync(stubDir)) {
    return;
  }
  const nodeModulesDir = path.join(rootDir, 'node_modules');
  if (!fs.existsSync(nodeModulesDir)) {
    return;
  }
  fs.mkdirSync(stubDir, { recursive: true });
  const pkgJson = {
    name: 'fsevents',
    version: '0.0.0',
    main: 'unsupported.js',
    private: true,
  };
  fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  fs.writeFileSync(
    path.join(stubDir, 'unsupported.js'),
    "throw new Error('fsevents is not supported on this platform.');\n"
  );
  createdStub = true;
}

function cleanupFseventsStub() {
  if (!createdStub) {
    return;
  }
  fs.rmSync(stubDir, { recursive: true, force: true });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: useShell,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
      }
    });
  });
}

async function main() {
  ensureFseventsStub();
  try {
    await runCommand(npxCommand, ['expo', 'export', '--platform', 'web', '--output-dir', 'web-build'], {
      cwd: rootDir,
    });

    const env = { ...process.env };
    if (process.platform === 'win32') {
      env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';
    }

    await runCommand(npxCommand, ['electron-builder'], {
      cwd: rootDir,
      env,
    });
  } finally {
    cleanupFseventsStub();
  }
}

main().catch((error) => {
  console.error('[desktop-build] ' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
