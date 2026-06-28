'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

class NotebookMcpAdapter {
  constructor({ rootDir, settings, log, hub } = {}) {
    this.rootDir = rootDir || path.resolve(__dirname, '..');
    this.settings = settings;
    this.log = log;
    this.hub = hub;
    this.child = null;
    this.sessionId = '';
    this.rpcId = 1;
    this.initialized = false;
    this.starting = null;
  }

  config() {
    const settings = this.settings.read();
    return {
      host: settings.mcpHost,
      port: settings.mcpPort,
      url: `http://${settings.mcpHost}:${settings.mcpPort}/mcp`,
      healthUrl: `http://${settings.mcpHost}:${settings.mcpPort}/healthz`,
      initialized: this.initialized,
      childPid: this.child?.pid || null,
    };
  }

  async ensureStarted() {
    if (this.starting) return this.starting;
    this.starting = this._ensureStarted().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async _ensureStarted() {
    const settings = this.settings.read();
    if (!(await this.healthProbe())) {
      await this.spawnServer(settings);
      await waitFor(async () => this.healthProbe(), 20000, 350);
    }
    if (!this.initialized || !this.sessionId) {
      await this.initialize();
    }
    return { ok: true, ...this.config() };
  }

  async spawnServer(settings) {
    if (this.child && !this.child.killed) return;
    const entry = path.join(this.rootDir, 'dist', 'index.js');
    this.log?.info('mcp', 'Starting NotebookLM MCP HTTP transport', { entry, port: settings.mcpPort });
    this.child = spawn(process.execPath, [
      entry,
      '--transport',
      'http',
      '--host',
      settings.mcpHost,
      '--port',
      String(settings.mcpPort),
    ], {
      cwd: this.rootDir,
      env: {
        ...process.env,
        NOTEBOOKLM_TRANSPORT: 'http',
        NOTEBOOKLM_HOST: settings.mcpHost,
        NOTEBOOKLM_PORT: String(settings.mcpPort),
        NOTEBOOKLM_PROFILE: settings.mcpProfile || 'full',
        HEADLESS: settings.browserMode === 'headless' ? 'true' : 'false',
        BROWSER_CHANNEL: settings.browserChannel || process.env.BROWSER_CHANNEL || 'chrome',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child.stdout.on('data', (chunk) => this.onProcessLog('info', chunk));
    this.child.stderr.on('data', (chunk) => this.onProcessLog('info', chunk));
    this.child.on('exit', (code, signal) => {
      this.log?.warn('mcp', 'NotebookLM MCP process exited', { code, signal });
      this.hub?.emit('bridge:status', { mcpReady: false, code, signal });
      this.child = null;
      this.initialized = false;
      this.sessionId = '';
    });
  }

  onProcessLog(level, chunk) {
    const text = String(chunk || '').trim();
    if (!text) return;
    this.log?.write(level, 'mcp', text);
    this.hub?.emit('log:event', { level, scope: 'mcp', message: text, time: new Date().toISOString() });
  }

  async healthProbe() {
    const settings = this.settings.read();
    try {
      const res = await requestJson({
        host: settings.mcpHost,
        port: settings.mcpPort,
        path: '/healthz',
        method: 'GET',
        timeoutMs: 1000,
      });
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch {
      return false;
    }
  }

  async initialize() {
    const result = await this.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: false },
        sampling: {},
      },
      clientInfo: {
        name: 'notebooklm-mcp-desktop',
        version: '0.1.0',
      },
    }, { allowNoSession: true });
    await this.rpcNotification('notifications/initialized', {});
    this.initialized = true;
    this.log?.info('mcp', 'MCP HTTP session initialized', { sessionId: this.sessionId });
    this.hub?.emit('bridge:status', { mcpReady: true, sessionId: this.sessionId });
    return result;
  }

  async listTools() {
    await this.ensureStarted();
    const result = await this.rpc('tools/list', {});
    return result.tools || [];
  }

  async callTool(name, args = {}, { progress = true } = {}) {
    await this.ensureStarted();
    const progressToken = progress ? `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}` : undefined;
    const toolArgs = progressToken
      ? { ...args, _meta: { progressToken } }
      : args;
    this.hub?.emit('tool:progress', { tool: name, progressToken, message: 'Started', progress: 0, total: 1 });
    const result = await this.rpc('tools/call', {
      name,
      arguments: toolArgs,
    });
    const parsed = parseToolResult(result);
    this.hub?.emit('tool:progress', { tool: name, progressToken, message: 'Completed', progress: 1, total: 1, result: parsed });
    return parsed;
  }

  async readResource(uri) {
    await this.ensureStarted();
    return this.rpc('resources/read', { uri });
  }

  async rpc(method, params = {}, { allowNoSession = false } = {}) {
    const settings = this.settings.read();
    const id = this.rpcId++;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.sessionId && !allowNoSession) headers['Mcp-Session-Id'] = this.sessionId;
    const response = await requestJson({
      host: settings.mcpHost,
      port: settings.mcpPort,
      path: '/mcp',
      method: 'POST',
      headers,
      body: {
        jsonrpc: '2.0',
        id,
        method,
        params,
      },
      timeoutMs: 650000,
    });
    if (response.headers['mcp-session-id']) {
      this.sessionId = response.headers['mcp-session-id'];
    }
    const payload = response.body;
    if (payload?.error) {
      throw new Error(payload.error.message || JSON.stringify(payload.error));
    }
    return payload?.result || {};
  }

  async rpcNotification(method, params = {}) {
    const settings = this.settings.read();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    await requestJson({
      host: settings.mcpHost,
      port: settings.mcpPort,
      path: '/mcp',
      method: 'POST',
      headers,
      body: {
        jsonrpc: '2.0',
        method,
        params,
      },
      timeoutMs: 30000,
    });
  }

  stop() {
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
    }
    this.child = null;
    this.initialized = false;
    this.sessionId = '';
  }
}

function parseToolResult(result = {}) {
  const text = Array.isArray(result.content)
    ? result.content.find((item) => item.type === 'text')?.text
    : '';
  if (!text) return { ok: true, raw: result };
  try {
    const parsed = JSON.parse(text);
    return {
      ok: parsed.success !== false,
      ...parsed,
    };
  } catch {
    return { ok: true, text };
  }
}

function requestJson({ host, port, path: pathname, method = 'GET', headers = {}, body, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      host,
      port,
      path: pathname,
      method,
      timeout: timeoutMs,
      headers: {
        ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = {};
        if (text.trim()) {
          try {
            parsed = parseJsonOrSse(text);
          } catch (error) {
            reject(new Error(`invalid-json-response: ${error.message}: ${text.slice(0, 200)}`));
            return;
          }
        }
        resolve({ statusCode: res.statusCode || 0, headers: res.headers, body: parsed });
      });
    });
    req.on('timeout', () => req.destroy(new Error('request-timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseJsonOrSse(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    const last = dataLines[dataLines.length - 1] || '{}';
    return JSON.parse(last);
  }
  return JSON.parse(trimmed);
}

async function waitFor(fn, timeoutMs, intervalMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await fn()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for MCP HTTP server');
}

module.exports = {
  NotebookMcpAdapter,
};
