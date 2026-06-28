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
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
    child.on('error', reject);
  });
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
