'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { _electron } = require('patchright');
const { DesktopSettings } = require('../lib/desktop-settings.cjs');

const rootDir = path.resolve(__dirname, '..');
const electronExecutable = require('electron');

async function main() {
  const userDataDir = process.env.NOTEBOOK_DESKTOP_USER_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'nb-electron-connect-'));
  const bridgePort = Number(process.env.BRIDGE_PORT || await getFreePort());
  const mcpPort = Number(process.env.MCP_PORT || await getFreePort());
  const chromeApp = process.env.CHROME_APP || 'Google Chrome';
  const profileDirectory = process.env.CHROME_PROFILE_DIRECTORY || '';
  const timeout = Number(process.env.ELECTRON_CONNECT_TIMEOUT_MS || 45000);

  const settings = new DesktopSettings({ userDataDir });
  settings.write({
    bridgePort,
    mcpPort,
    connectMode: 'systemChrome',
    systemChromeApp: chromeApp,
    systemChromeProfileDirectory: profileDirectory,
    browserMode: 'visible',
    updateRepo: '',
  });

  const electronApp = await launchElectron({
    userDataDir,
    timeout,
  });

  try {
    const page = await electronApp.firstWindow({ timeout });
    await page.waitForSelector('#loading[hidden]', { timeout });
    await page.locator('#connectBtn').click({ timeout });

    await page.waitForFunction(() => {
      const status = document.querySelector('#connectStatusLabel')?.textContent || '';
      const diagnostics = window.__notebookDesktopSmoke?.diagnostics || {};
      return Boolean(diagnostics.systemProfile) || /Chrome opened|Open failed|Connected|Failed/.test(status);
    }, null, { timeout });

    const result = await page.evaluate(() => {
      const diagnostics = window.__notebookDesktopSmoke?.diagnostics || {};
      return {
        status: document.querySelector('#connectStatusLabel')?.textContent || '',
        authStatus: document.querySelector('#authStatus')?.textContent || '',
        answer: document.querySelector('#answerBox')?.textContent || '',
        systemProfile: diagnostics.systemProfile || null,
      };
    });

    assert(result.systemProfile, 'Connect did not call the system Chrome profile bridge endpoint');
    assert(result.systemProfile.command?.cmd, 'Connect result is missing launch command');
    assert(
      !profileDirectory || result.systemProfile.profileDirectory === profileDirectory,
      `Expected profile ${profileDirectory}, got ${result.systemProfile.profileDirectory || '(empty)'}`
    );

    if (result.systemProfile.ok !== true) {
      throw new Error(`Chrome profile launch failed: ${result.systemProfile.error || result.status}`);
    }

    console.log(JSON.stringify({
      ok: true,
      status: result.status,
      authStatus: result.authStatus,
      profileDirectory: result.systemProfile.profileDirectory,
      command: result.systemProfile.command,
      userDataDir,
    }, null, 2));
  } finally {
    await electronApp.close().catch(() => {});
  }
}

async function launchElectron({ userDataDir, timeout }) {
  try {
    return await _electron.launch({
      executablePath: electronExecutable,
      args: ['.'],
      cwd: rootDir,
      timeout,
      env: {
        ...process.env,
        NOTEBOOK_DESKTOP_USER_DATA_DIR: userDataDir,
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });
  } catch (error) {
    const message = error?.message || String(error);
    if (process.platform === 'darwin' && /Process failed to launch|SIGABRT|AppKit|LaunchServices|_RegisterApplication|Abort trap/i.test(message)) {
      throw new Error([
        'Electron GUI could not launch in this session before the app code started.',
        'macOS AppKit/LaunchServices is unavailable in the current sandbox.',
        'Run this smoke test from a normal Terminal or Finder-launched app session.',
        `Original error: ${message}`,
      ].join('\n'));
    }
    throw error;
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
