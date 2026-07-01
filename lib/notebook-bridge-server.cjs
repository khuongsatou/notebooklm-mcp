'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { NotebookSafeRunner } = require('./notebook-safe-runner.cjs');

const MAX_BODY_BYTES = 2 * 1024 * 1024;

class NotebookBridgeServer {
  constructor({ settings, credentials, mcp, log, hub, agent, update, appInfo, rootDir } = {}) {
    this.settings = settings;
    this.credentials = credentials;
    this.mcp = mcp;
    this.log = log;
    this.hub = hub;
    this.agent = agent;
    this.update = update;
    this.appInfo = appInfo;
    this.rootDir = rootDir || path.resolve(__dirname, '..');
    this.server = null;
    this.safeRunner = new NotebookSafeRunner({ mcp, log, settings });
  }

  async start() {
    const settings = this.settings.read();
    if (this.server) return this.info();
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((error) => {
        this.log?.error('bridge', 'Unhandled request error', { error: error.message });
        sendJson(res, 500, { ok: false, error: error.message });
      });
    });
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(settings.bridgePort, settings.bridgeHost, () => {
        this.server.off('error', reject);
        resolve();
      });
    });
    this.log?.info('bridge', 'Desktop bridge started', this.info());
    this.hub?.emit('bridge:status', { bridgeReady: true, ...this.info() });
    return this.info();
  }

  async stop() {
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(resolve));
    this.server = null;
    this.mcp?.stop();
  }

  info() {
    const settings = this.settings.read();
    return {
      host: settings.bridgeHost,
      port: settings.bridgePort,
      url: `http://${settings.bridgeHost}:${settings.bridgePort}`,
      appInfo: this.appInfo,
      mcp: this.mcp.config(),
      socket: this.hub.stats(),
    };
  }

  async handle(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'OPTIONS') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (url.pathname === '/events') {
      this.hub.handle(req, res);
      return;
    }
    if (url.pathname === '/api/health' && req.method === 'GET') {
      const mcpStarted = await this.mcp.ensureStarted().then(() => true, () => false);
      let health = null;
      if (mcpStarted) {
        try { health = await this.mcp.callTool('get_health', {}); } catch (error) { health = { ok: false, error: error.message }; }
      }
      sendJson(res, 200, { ok: true, bridge: this.info(), mcpStarted, health });
      return;
    }
    if (url.pathname === '/api/doctor' && req.method === 'GET') {
      sendJson(res, 200, await this.safeRunner.doctor({
        include_logs: url.searchParams.get('include_logs') === '1' || url.searchParams.get('include_logs') === 'true',
        log_query: url.searchParams.get('log_query') || '',
        log_limit: Number(url.searchParams.get('log_limit') || 12),
      }));
      return;
    }
    if (url.pathname === '/api/doctor' && req.method === 'POST') {
      sendJson(res, 200, await this.safeRunner.doctor(await readJson(req)));
      return;
    }
    if (url.pathname === '/api/info' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, ...this.info() });
      return;
    }
    if (url.pathname === '/api/settings' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, settings: this.publicSettings() });
      return;
    }
    if (url.pathname === '/api/settings' && ['POST', 'PATCH'].includes(req.method)) {
      const body = await readJson(req);
      if (body.providerApiKey) {
        this.credentials.set('providerApiKey', body.providerApiKey);
        delete body.providerApiKey;
      }
      const settings = this.settings.write(body);
      sendJson(res, 200, { ok: true, settings: this.publicSettings(settings) });
      return;
    }
    if (url.pathname === '/api/logs' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, entries: this.log.list(Object.fromEntries(url.searchParams.entries())), stats: this.log.stats() });
      return;
    }
    if (url.pathname === '/api/logs/clear' && req.method === 'POST') {
      sendJson(res, 200, this.log.clear());
      return;
    }
    if (url.pathname === '/api/content/list' && req.method === 'GET') {
      const space = url.searchParams.get('space') || '';
      const root = this.contentRoot(space);
      const files = listContentFiles(root).map((item) => ({
        ...item,
        space,
      }));
      sendJson(res, 200, { ok: true, space, files });
      return;
    }
    if (url.pathname === '/api/content/read' && req.method === 'GET') {
      const space = url.searchParams.get('space') || '';
      const relPath = url.searchParams.get('path') || '';
      const root = this.contentRoot(space);
      const file = safeResolve(root, relPath);
      const stat = fs.statSync(file);
      if (!stat.isFile()) {
        sendJson(res, 400, { ok: false, error: 'not-a-file' });
        return;
      }
      const ext = path.extname(file).toLowerCase();
      const media = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.mov', '.m4v'].includes(ext);
      if (media) {
        sendJson(res, 200, {
          ok: true,
          space,
          path: relPath,
          name: path.basename(file),
          ext,
          size: stat.size,
          media: true,
          url: `/api/content/raw?space=${encodeURIComponent(space)}&path=${encodeURIComponent(relPath)}`,
        });
        return;
      }
      if (stat.size > 1024 * 1024) {
        sendJson(res, 413, { ok: false, error: 'file-too-large', size: stat.size });
        return;
      }
      const text = fs.readFileSync(file, 'utf8');
      let json = null;
      if (ext === '.json') {
        try { json = JSON.parse(text); } catch { json = null; }
      }
      sendJson(res, 200, {
        ok: true,
        space,
        path: relPath,
        name: path.basename(file),
        ext,
        size: stat.size,
        media: false,
        text,
        json,
      });
      return;
    }
    if (url.pathname === '/api/content/raw' && req.method === 'GET') {
      const space = url.searchParams.get('space') || '';
      const relPath = url.searchParams.get('path') || '';
      const root = this.contentRoot(space);
      const file = safeResolve(root, relPath);
      if (!fs.statSync(file).isFile()) {
        sendJson(res, 400, { ok: false, error: 'not-a-file' });
        return;
      }
      sendBinaryFile(res, file);
      return;
    }
    if (url.pathname === '/api/tools' && req.method === 'GET') {
      const tools = await this.mcp.listTools();
      sendJson(res, 200, { ok: true, tools });
      return;
    }
    if (url.pathname === '/api/notebooks' && req.method === 'GET') {
      sendJson(res, 200, await this.mcp.callTool('list_notebooks', {}));
      return;
    }
    if (url.pathname === '/api/notebooks' && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool('add_notebook', await readJson(req)));
      return;
    }
    const selectMatch = url.pathname.match(/^\/api\/notebooks\/([^/]+)\/select$/);
    if (selectMatch && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool('select_notebook', { id: decodeURIComponent(selectMatch[1]) }));
      return;
    }
    const notebookMatch = url.pathname.match(/^\/api\/notebooks\/([^/]+)$/);
    if (notebookMatch && req.method === 'PATCH') {
      sendJson(res, 200, await this.mcp.callTool('update_notebook', { id: decodeURIComponent(notebookMatch[1]), ...(await readJson(req)) }));
      return;
    }
    if (notebookMatch && req.method === 'DELETE') {
      sendJson(res, 200, await this.mcp.callTool('remove_notebook', { id: decodeURIComponent(notebookMatch[1]) }));
      return;
    }
    if (url.pathname === '/api/sessions' && req.method === 'GET') {
      sendJson(res, 200, await this.mcp.callTool('list_sessions', {}));
      return;
    }
    const sessionAction = url.pathname.match(/^\/api\/sessions\/([^/]+)\/(reset|close)$/);
    if (sessionAction && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool(sessionAction[2] === 'reset' ? 'reset_session' : 'close_session', { session_id: decodeURIComponent(sessionAction[1]) }));
      return;
    }
    if (url.pathname === '/api/auth/setup' && req.method === 'POST') {
      const body = await readJson(req);
      sendJson(res, 200, await this.mcp.callTool('setup_auth', { show_browser: body.show_browser !== false }));
      return;
    }
    if (url.pathname === '/api/auth/reauth' && req.method === 'POST') {
      const body = await readJson(req);
      sendJson(res, 200, await this.mcp.callTool('re_auth', { show_browser: body.show_browser !== false }));
      return;
    }
    if (url.pathname === '/api/auth/open-system-profile' && req.method === 'POST') {
      const body = await readJson(req);
      const settings = this.settings.read();
      const result = await openSystemChromeProfile({
        appName: body.appName || settings.systemChromeApp,
        profileDirectory: body.profileDirectory ?? settings.systemChromeProfileDirectory,
        url: body.url || settings.notebookLmUrl,
        dryRun: body.dry_run === true,
      });
      this.log?.info('bridge', 'System Chrome profile requested', result);
      sendJson(res, 200, result);
      return;
    }
    if (url.pathname === '/api/ask' && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool('ask_question', await readJson(req)));
      return;
    }
    if (url.pathname === '/api/ask-safe' && req.method === 'POST') {
      sendJson(res, 200, await this.safeRunner.askSafe(await readJson(req)));
      return;
    }
    if (url.pathname === '/api/sources' && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool('add_source', await readJson(req)));
      return;
    }
    if (url.pathname === '/api/audio/generate' && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool('generate_audio', await readJson(req)));
      return;
    }
    if (url.pathname === '/api/audio/status' && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool('get_audio_status', await readJson(req)));
      return;
    }
    if (url.pathname === '/api/audio/download' && req.method === 'POST') {
      sendJson(res, 200, await this.mcp.callTool('download_audio', await readJson(req)));
      return;
    }
    if (url.pathname === '/api/agent/config' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, config: this.agent.config(), tools: this.agent.listTools() });
      return;
    }
    if (url.pathname === '/api/agent/test' && req.method === 'POST') {
      sendJson(res, 200, await this.agent.testConnection(await readJson(req)));
      return;
    }
    if (url.pathname === '/api/agent/chat' && req.method === 'POST') {
      sendJson(res, 200, await this.agent.chat(await readJson(req)));
      return;
    }
    if (url.pathname === '/api/updates/check' && req.method === 'POST') {
      sendJson(res, 200, await this.update.check());
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      sendFile(res, path.join(this.rootDir, 'renderer', 'index.html'));
      return;
    }
    if (['/styles.css', '/renderer.js'].includes(url.pathname)) {
      sendFile(res, path.join(this.rootDir, 'renderer', url.pathname.slice(1)));
      return;
    }
    sendJson(res, 404, { ok: false, error: 'not-found' });
  }

  publicSettings(settings = this.settings.read()) {
    return {
      ...settings,
      hasProviderApiKey: Boolean(this.credentials.get('providerApiKey')),
    };
  }

  contentRoot(space) {
    if (space === 'questions') return path.join(this.rootDir, 'questions');
    if (space === 'workspace') return path.join(this.rootDir, 'workspace');
    throw new Error('invalid-content-space');
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('request-body-too-large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid-json')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Secret',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, file) {
  if (!fs.existsSync(file)) {
    sendJson(res, 404, { ok: false, error: 'file-not-found' });
    return;
  }
  const ext = path.extname(file);
  const type = ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
}

function sendBinaryFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
  };
  const stat = fs.statSync(file);
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Content-Length': String(stat.size),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(file).pipe(res);
}

async function openSystemChromeProfile({ appName = 'Google Chrome', profileDirectory = '', url = 'https://notebooklm.google.com/', dryRun = false } = {}) {
  const safeUrl = normalizeNotebookUrl(url);
  const safeApp = String(appName || 'Google Chrome');
  const safeProfile = String(profileDirectory || '').trim();
  const command = buildChromeOpenCommand({ appName: safeApp, profileDirectory: safeProfile, url: safeUrl });
  if (dryRun) {
    return { ok: true, dryRun: true, url: safeUrl, profileDirectory: safeProfile, command };
  }
  const launch = await launchExternal(command.cmd, command.args);
  if (!launch.ok) {
    return {
      ok: false,
      error: launch.error,
      url: safeUrl,
      profileDirectory: safeProfile,
      command,
    };
  }
  return {
    ok: true,
    message: safeProfile ? `Opened NotebookLM in Chrome profile ${safeProfile}.` : 'Opened NotebookLM in active Chrome profile.',
    url: safeUrl,
    profileDirectory: safeProfile,
    command,
  };
}

function buildChromeOpenCommand({ appName, profileDirectory, url }) {
  if (process.platform === 'darwin') {
    if (profileDirectory) {
      return { cmd: 'open', args: ['-na', appName, '--args', `--profile-directory=${profileDirectory}`, url] };
    }
    return { cmd: 'open', args: ['-a', appName, url] };
  }
  if (process.platform === 'win32') {
    const args = ['/c', 'start', '', 'chrome'];
    if (profileDirectory) args.push(`--profile-directory=${profileDirectory}`);
    args.push(url);
    return { cmd: 'cmd', args };
  }
  const args = [];
  if (profileDirectory) args.push(`--profile-directory=${profileDirectory}`);
  args.push(url);
  return { cmd: 'google-chrome', args };
}

function launchExternal(cmd, args) {
  if (process.platform === 'darwin') return runAndCheck(cmd, args);
  return spawnDetached(cmd, args);
}

function runAndCheck(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.once('error', (error) => {
      resolve({ ok: false, error: error.message || String(error) });
    });
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      const detail = stderr.trim() || `exit ${code ?? 'unknown'}${signal ? ` signal ${signal}` : ''}`;
      resolve({ ok: false, error: detail });
    });
  });
}

function spawnDetached(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve({ ok: true });
    });
  });
}

function normalizeNotebookUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'https:' && url.hostname === 'notebooklm.google.com') return url.toString();
  } catch {
    // Use safe default below.
  }
  return 'https://notebooklm.google.com/';
}

function safeResolve(root, relPath) {
  const resolved = path.resolve(root, relPath || '');
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    throw new Error('path-outside-content-root');
  }
  return resolved;
}

function listContentFiles(root) {
  if (!fs.existsSync(root)) return [];
  const rootResolved = path.resolve(root);
  const result = [];
  walk(rootResolved);
  return result.sort((a, b) => a.path.localeCompare(b.path));

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(rootResolved, full);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const stat = fs.statSync(full);
      result.push({
        path: rel,
        name: entry.name,
        dir: path.dirname(rel) === '.' ? '' : path.dirname(rel),
        ext: path.extname(entry.name).toLowerCase(),
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }
}

module.exports = {
  NotebookBridgeServer,
};
