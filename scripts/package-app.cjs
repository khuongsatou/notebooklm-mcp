'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const electronBinary = require('electron');
const electronDist = resolveElectronDist(electronBinary);
const appName = pkg.productName || 'NotebookLM MCP Desktop';
const safeName = appName.replace(/[^\w.-]+/g, '-');
const outRoot = path.join(root, 'release');
const outDir = path.join(outRoot, `${safeName}-${pkg.version}-${process.platform}-${process.arch}`);

const appFiles = [
  'assets',
  'dist',
  'docs',
  'lib',
  'renderer',
  'scripts',
  'src',
  'electron.cjs',
  'preload.cjs',
  'package.json',
  'package-lock.json',
  'README.md',
  'LICENSE',
];

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  if (process.platform === 'darwin' && electronDist.endsWith('.app')) {
    const appBundle = path.join(outDir, `${appName}.app`);
    fs.cpSync(electronDist, appBundle, { recursive: true });
    const resources = path.join(appBundle, 'Contents', 'Resources');
    const appTarget = path.join(resources, 'app');
    fs.rmSync(appTarget, { recursive: true, force: true });
    copyApp(appTarget);
    patchMacInfoPlist(path.join(appBundle, 'Contents', 'Info.plist'));
    console.log(`Packaged macOS app: ${appBundle}`);
    return;
  }

  fs.cpSync(electronDist, path.join(outDir, 'electron'), { recursive: true });
  copyApp(path.join(outDir, 'resources', 'app'));
  writeLauncher(outDir);
  console.log(`Packaged desktop app: ${outDir}`);
}

function resolveElectronDist(binaryPath) {
  let current = path.resolve(binaryPath);
  if (process.platform === 'darwin') {
    while (current !== path.dirname(current)) {
      if (current.endsWith('.app')) return current;
      current = path.dirname(current);
    }
  }
  return path.dirname(path.resolve(binaryPath));
}

function copyApp(target) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of appFiles) {
    const from = path.join(root, file);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(target, file), { recursive: true });
  }
  const nodeModules = path.join(root, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    fs.cpSync(nodeModules, path.join(target, 'node_modules'), {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(nodeModules, src);
        return rel !== 'electron' && !rel.startsWith(`electron${path.sep}`);
      },
    });
  }
}

function patchMacInfoPlist(file) {
  try {
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace(/<string>Electron<\/string>/g, `<string>${escapePlist(appName)}</string>`);
    text = text.replace(/<key>CFBundleName<\/key>\s*<string>[^<]+<\/string>/, `<key>CFBundleName</key>\n\t<string>${escapePlist(appName)}</string>`);
    text = text.replace(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]+<\/string>/, `<key>CFBundleDisplayName</key>\n\t<string>${escapePlist(appName)}</string>`);
    fs.writeFileSync(file, text);
  } catch {
    // Best effort only.
  }
}

function escapePlist(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function writeLauncher(dir) {
  const launcher = process.platform === 'win32' ? 'run.bat' : 'run.sh';
  const content = process.platform === 'win32'
    ? '@echo off\r\n.\\electron\\electron.exe .\\resources\\app\r\n'
    : '#!/usr/bin/env bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\n"$DIR/electron/electron" "$DIR/resources/app"\n';
  const file = path.join(dir, launcher);
  fs.writeFileSync(file, content);
  if (process.platform !== 'win32') fs.chmodSync(file, 0o755);
}

main();
