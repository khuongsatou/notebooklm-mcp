'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_SETTINGS = {
  bridgeHost: '127.0.0.1',
  bridgePort: 18931,
  mcpHost: '127.0.0.1',
  mcpPort: 33131,
  mcpTransport: 'http',
  mcpProfile: 'full',
  defaultNotebookId: '',
  defaultSourceFormat: 'none',
  browserMode: 'visible',
  browserChannel: 'chrome',
  connectMode: 'systemChrome',
  systemChromeApp: 'Google Chrome',
  systemChromeProfileDirectory: '',
  notebookLmUrl: 'https://notebooklm.google.com/',
  providerBaseUrl: 'http://127.0.0.1:20128/v1',
  providerModel: 'cx/gpt-5.5',
  agentMaxLoops: 6,
  agentMaxToolCalls: 4,
  agentContextLimit: 128000,
  agentSearchEnabled: true,
  logRetention: 500,
  socketEnabled: true,
  updateSource: 'github',
  updateRepo: '',
};

function defaultUserDataDir(appName = 'NotebookLM MCP Desktop') {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
  }
  return path.join(os.homedir(), '.config', appName);
}

class DesktopSettings {
  constructor({ userDataDir } = {}) {
    this.userDataDir = userDataDir || defaultUserDataDir();
    this.file = path.join(this.userDataDir, 'notebooklm_desktop_settings.json');
    fs.mkdirSync(this.userDataDir, { recursive: true });
  }

  get defaults() {
    return { ...DEFAULT_SETTINGS };
  }

  read() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return this.normalize(raw);
    } catch {
      return this.normalize({});
    }
  }

  write(patch = {}) {
    const next = this.normalize({ ...this.read(), ...patch });
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  }

  normalize(input = {}) {
    const merged = { ...DEFAULT_SETTINGS, ...(input || {}) };
    return {
      ...merged,
      bridgePort: clampNumber(merged.bridgePort, 1024, 65535, DEFAULT_SETTINGS.bridgePort),
      mcpPort: clampNumber(merged.mcpPort, 1024, 65535, DEFAULT_SETTINGS.mcpPort),
      agentMaxLoops: clampNumber(merged.agentMaxLoops, 1, 12, DEFAULT_SETTINGS.agentMaxLoops),
      agentMaxToolCalls: clampNumber(merged.agentMaxToolCalls, 1, 8, DEFAULT_SETTINGS.agentMaxToolCalls),
      agentContextLimit: clampNumber(merged.agentContextLimit, 2000, 200000, DEFAULT_SETTINGS.agentContextLimit),
      logRetention: clampNumber(merged.logRetention, 50, 5000, DEFAULT_SETTINGS.logRetention),
      socketEnabled: Boolean(merged.socketEnabled),
      agentSearchEnabled: Boolean(merged.agentSearchEnabled),
      browserMode: ['visible', 'headless'].includes(merged.browserMode) ? merged.browserMode : DEFAULT_SETTINGS.browserMode,
      connectMode: ['systemChrome', 'mcpAuth'].includes(merged.connectMode) ? merged.connectMode : DEFAULT_SETTINGS.connectMode,
      systemChromeApp: String(merged.systemChromeApp || DEFAULT_SETTINGS.systemChromeApp),
      systemChromeProfileDirectory: String(merged.systemChromeProfileDirectory || ''),
      notebookLmUrl: normalizeNotebookUrl(merged.notebookLmUrl || DEFAULT_SETTINGS.notebookLmUrl),
      defaultSourceFormat: ['none', 'inline', 'footnotes', 'json'].includes(merged.defaultSourceFormat)
        ? merged.defaultSourceFormat
        : DEFAULT_SETTINGS.defaultSourceFormat,
    };
  }
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeNotebookUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'https:' && url.hostname === 'notebooklm.google.com') return url.toString();
  } catch {
    // Fall through to the safe default.
  }
  return DEFAULT_SETTINGS.notebookLmUrl;
}

module.exports = {
  DEFAULT_SETTINGS,
  DesktopSettings,
  defaultUserDataDir,
};
