'use strict';

const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(formatRunFailure(cmd, args, code, signal)));
    });
    child.on('error', reject);
  });
}

function formatRunFailure(cmd, args, code, signal) {
  const suffix = signal ? `signal ${signal}` : `exit ${code}`;
  const message = `${cmd} ${args.join(' ')} failed with ${suffix}`;
  if (process.platform === 'darwin' && String(cmd).includes('Electron.app') && (signal === 'SIGABRT' || code === 134)) {
    return [
      message,
      'Electron aborted while registering with macOS AppKit before the desktop app code started.',
      'This usually means the command is running in a non-GUI or sandboxed session where LaunchServices/AppKit is unavailable.',
      'Open the app from a normal Terminal/Finder session, or run the bridge smoke test with npm run smoke:desktop.',
    ].join('\n');
  }
  return message;
}

async function main() {
  if (!process.argv.includes('--no-build')) {
    await run('npm', ['run', 'build']);
  }
  const electronBin = require('electron');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  await run(electronBin, ['.'], { shell: false, env });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
