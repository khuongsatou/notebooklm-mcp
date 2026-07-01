'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, Menu, Tray, nativeImage } = require('electron');

const { buildAppInfo } = require('./lib/desktop-app-info.cjs');
const { DesktopSettings } = require('./lib/desktop-settings.cjs');
const { CredentialStore } = require('./lib/desktop-credential-store.cjs');
const { NotebookLogManager } = require('./lib/notebook-log-manager.cjs');
const { NotebookSocketHub } = require('./lib/notebook-socket-hub.cjs');
const { NotebookMcpAdapter } = require('./lib/notebook-mcp-adapter.cjs');
const { NotebookBridgeServer } = require('./lib/notebook-bridge-server.cjs');
const { NotebookUpdateClient } = require('./lib/notebook-update-client.cjs');
const { AgentChatService } = require('./lib/agent-chat.cjs');

const ROOT_DIR = __dirname;
const APP_INFO = buildAppInfo(ROOT_DIR);

let mainWindow = null;
let tray = null;
let settings;
let credentials;
let log;
let hub;
let mcp;
let update;
let agent;
let bridge;

function getUserDataDir() {
  return process.env.NOTEBOOK_DESKTOP_USER_DATA_DIR || app.getPath('userData');
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createServices() {
  const userDataDir = getUserDataDir();
  settings = new DesktopSettings({ userDataDir });
  credentials = new CredentialStore({ userDataDir, safeStorage });
  log = new NotebookLogManager({ userDataDir, retention: settings.read().logRetention });
  hub = new NotebookSocketHub();
  mcp = new NotebookMcpAdapter({ rootDir: ROOT_DIR, settings, log, hub });
  update = new NotebookUpdateClient({ appInfo: APP_INFO, settings, log });
  agent = new AgentChatService({ settings, credentials, mcp, log, hub, update });
  bridge = new NotebookBridgeServer({ settings, credentials, mcp, log, hub, agent, update, appInfo: APP_INFO, rootDir: ROOT_DIR });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: APP_INFO.productName,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(ROOT_DIR, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  await mainWindow.loadFile(path.join(ROOT_DIR, 'renderer', 'index.html'));
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(ROOT_DIR, 'assets', 'icon.png'));
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip(APP_INFO.productName);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show', click: () => mainWindow?.show() },
      { label: 'Open Bridge API', click: () => shell.openExternal(bridge.info().url) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  } catch {
    tray = null;
  }
}

function registerIpc() {
  ipcMain.handle('bridge:get-info', () => ({ ok: true, ...bridge.info() }));
  ipcMain.handle('bridge:open-api', () => shell.openExternal(bridge.info().url));
  ipcMain.handle('settings:get', () => ({ ok: true, settings: bridge.publicSettings() }));
  ipcMain.handle('settings:save', (_event, payload = {}) => {
    if (payload.providerApiKey) {
      credentials.set('providerApiKey', payload.providerApiKey);
      delete payload.providerApiKey;
    }
    const next = settings.write(payload);
    return { ok: true, settings: bridge.publicSettings(next) };
  });
  ipcMain.handle('notebook:health', () => bridgeRequest('/api/health'));
  ipcMain.handle('notebook:notebooks', () => bridgeRequest('/api/notebooks'));
  ipcMain.handle('notebook:add', (_event, payload) => bridgeRequest('/api/notebooks', 'POST', payload));
  ipcMain.handle('notebook:select', (_event, id) => bridgeRequest(`/api/notebooks/${encodeURIComponent(id)}/select`, 'POST'));
  ipcMain.handle('notebook:update', (_event, payload) => bridgeRequest(`/api/notebooks/${encodeURIComponent(payload.id)}`, 'PATCH', payload.patch || {}));
  ipcMain.handle('notebook:remove', (_event, id) => bridgeRequest(`/api/notebooks/${encodeURIComponent(id)}`, 'DELETE'));
  ipcMain.handle('notebook:sessions', () => bridgeRequest('/api/sessions'));
  ipcMain.handle('notebook:session-action', (_event, payload) => bridgeRequest(`/api/sessions/${encodeURIComponent(payload.session_id)}/${payload.action}`, 'POST'));
  ipcMain.handle('notebook:setup-auth', (_event, payload) => bridgeRequest('/api/auth/setup', 'POST', payload || {}));
  ipcMain.handle('notebook:reauth', (_event, payload) => bridgeRequest('/api/auth/reauth', 'POST', payload || {}));
  ipcMain.handle('notebook:open-system-profile', (_event, payload) => bridgeRequest('/api/auth/open-system-profile', 'POST', payload || {}));
  ipcMain.handle('notebook:ask', (_event, payload) => bridgeRequest('/api/ask', 'POST', payload || {}));
  ipcMain.handle('notebook:add-source', (_event, payload) => bridgeRequest('/api/sources', 'POST', payload || {}));
  ipcMain.handle('notebook:audio-generate', (_event, payload) => bridgeRequest('/api/audio/generate', 'POST', payload || {}));
  ipcMain.handle('notebook:audio-status', (_event, payload) => bridgeRequest('/api/audio/status', 'POST', payload || {}));
  ipcMain.handle('notebook:audio-download', (_event, payload) => bridgeRequest('/api/audio/download', 'POST', payload || {}));
  ipcMain.handle('logs:list', (_event, payload = {}) => ({ ok: true, entries: log.list(payload), stats: log.stats() }));
  ipcMain.handle('logs:clear', () => log.clear());
  ipcMain.handle('content:list', (_event, payload = {}) => bridgeRequest(`/api/content/list?space=${encodeURIComponent(payload.space || '')}`));
  ipcMain.handle('content:read', (_event, payload = {}) => bridgeRequest(`/api/content/read?space=${encodeURIComponent(payload.space || '')}&path=${encodeURIComponent(payload.path || '')}`));
  ipcMain.handle('updates:check', () => update.check());
  ipcMain.handle('agent:config', () => ({ ok: true, config: agent.config(), tools: agent.listTools() }));
  ipcMain.handle('agent:test', (_event, payload) => agent.testConnection(payload || {}));
  ipcMain.handle('agent:chat', (_event, payload) => agent.chat(payload || {}));
  ipcMain.handle('dialog:choose-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    return { ok: !result.canceled, path: result.filePaths?.[0] || '' };
  });
}

async function bridgeRequest(pathname, method = 'GET', body) {
  const info = bridge.info();
  const resp = await fetch(`${info.url}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { ok: false, status: resp.status, error: data.error || resp.statusText };
  return data;
}

function forwardEvents() {
  const originalEmit = hub.emit.bind(hub);
  hub.emit = (event, payload) => {
    originalEmit(event, payload);
    mainWindow?.webContents?.send?.('bridge-event', { event, payload });
  };
}

function formatStartupError(error) {
  if (error?.code === 'EADDRINUSE') {
    return [
      `Bridge port ${error.address || '127.0.0.1'}:${error.port} is already in use.`,
      '',
      'NotebookLM MCP Desktop may already be running. Close the existing app or change the Bridge Port in Settings before starting another instance.',
    ].join('\n');
  }
  return error?.message || String(error || 'Unknown startup error');
}

function handleStartupError(error) {
  const message = formatStartupError(error);
  console.error(message);
  try {
    dialog.showErrorBox('NotebookLM MCP Desktop could not start', message);
  } catch {
    // App may be too early in startup for a dialog on some platforms.
  }
  app.quit();
}

async function startApp() {
  app.setName(APP_INFO.productName);
  createServices();
  forwardEvents();
  registerIpc();
  await bridge.start();
  await createWindow();
  createTray();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);
  app.whenReady().then(startApp).catch(handleStartupError);
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  bridge?.stop?.();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
