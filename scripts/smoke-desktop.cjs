'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { DesktopSettings } = require('../lib/desktop-settings.cjs');
const { CredentialStore } = require('../lib/desktop-credential-store.cjs');
const { NotebookLogManager } = require('../lib/notebook-log-manager.cjs');
const { NotebookSocketHub } = require('../lib/notebook-socket-hub.cjs');
const { NotebookMcpAdapter } = require('../lib/notebook-mcp-adapter.cjs');
const { NotebookBridgeServer } = require('../lib/notebook-bridge-server.cjs');
const { NotebookUpdateClient } = require('../lib/notebook-update-client.cjs');
const { AgentChatService } = require('../lib/agent-chat.cjs');
const { buildAppInfo } = require('../lib/desktop-app-info.cjs');

const rootDir = path.resolve(__dirname, '..');
const report = [];

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-desktop-smoke-'));
  const bridgePort = await getFreePort();
  const mcpPort = await getFreePort();

  const settings = new DesktopSettings({ userDataDir });
  settings.write({
    bridgePort,
    mcpPort,
    browserMode: 'headless',
    updateRepo: '',
    providerBaseUrl: 'http://127.0.0.1:9/v1',
  });
  const credentials = new CredentialStore({ userDataDir });
  const log = new NotebookLogManager({ userDataDir });
  const hub = new NotebookSocketHub();
  const mcp = new NotebookMcpAdapter({ rootDir, settings, log, hub });
  const appInfo = buildAppInfo(rootDir);
  const update = new NotebookUpdateClient({ appInfo, settings, log });
  const agent = new AgentChatService({ settings, credentials, mcp, log, hub, update });
  const bridge = new NotebookBridgeServer({
    settings,
    credentials,
    mcp,
    log,
    hub,
    agent,
    update,
    appInfo,
    rootDir,
  });

  try {
    await step('bridge.start', async () => {
      const info = await bridge.start();
      assert(info.port === bridgePort, 'bridge port mismatch');
      return { url: info.url };
    });

    const base = `http://127.0.0.1:${bridgePort}`;

    await step('api.info', async () => {
      const data = await requestJson(`${base}/api/info`);
      assert(data.ok === true, 'info not ok');
      assert(data.appInfo?.version, 'missing app version');
      return { version: data.appInfo.version };
    });

    await step('settings.get', async () => {
      const data = await requestJson(`${base}/api/settings`);
      assert(data.ok === true, 'settings not ok');
      assert(data.settings.bridgePort === bridgePort, 'settings bridgePort mismatch');
      return { hasProviderApiKey: data.settings.hasProviderApiKey };
    });

    await step('settings.patch', async () => {
      const data = await requestJson(`${base}/api/settings`, {
        method: 'PATCH',
        body: { defaultSourceFormat: 'footnotes', agentMaxLoops: 3 },
      });
      assert(data.ok === true, 'settings patch not ok');
      assert(data.settings.defaultSourceFormat === 'footnotes', 'source format not patched');
      assert(data.settings.agentMaxLoops === 3, 'agentMaxLoops not patched');
      return { defaultSourceFormat: data.settings.defaultSourceFormat, agentMaxLoops: data.settings.agentMaxLoops };
    });

    await step('logs.write/list/clear', async () => {
      log.info('smoke', 'hello smoke');
      let data = await requestJson(`${base}/api/logs?level=all&limit=5`);
      assert(data.ok === true, 'logs list not ok');
      assert(data.entries.some((entry) => entry.scope === 'smoke'), 'smoke log missing');
      data = await requestJson(`${base}/api/logs/clear`, { method: 'POST' });
      assert(data.ok === true, 'logs clear not ok');
      return { cleared: true };
    });

    await step('events.sse', async () => {
      const eventPromise = waitForSseEvent(`${base}/events`, 'smoke:event', 2500);
      setTimeout(() => hub.emit('smoke:event', { ok: true }), 100);
      const event = await eventPromise;
      assert(event.ok === true, 'SSE payload mismatch');
      return event;
    });

    await step('mcp.health', async () => {
      const data = await requestJson(`${base}/api/health`);
      assert(data.ok === true, 'health api not ok');
      assert(data.mcpStarted === true, 'mcp not started');
      assert(data.health?.ok === true, 'mcp health tool not ok');
      return {
        authenticated: data.health.data?.authenticated,
        sessions: data.health.data?.active_sessions,
      };
    });

    await step('mcp.tools', async () => {
      const data = await requestJson(`${base}/api/tools`);
      assert(data.ok === true, 'tools api not ok');
      assert(Array.isArray(data.tools), 'tools missing');
      assert(data.tools.some((tool) => tool.name === 'get_health'), 'get_health tool missing');
      return { count: data.tools.length };
    });

    await step('notebooks.list', async () => {
      const data = await requestJson(`${base}/api/notebooks`);
      assert(data.ok === true, 'notebooks list not ok');
      const notebooks = data.data?.notebooks || data.notebooks || [];
      assert(Array.isArray(notebooks), 'notebooks is not array');
      return { count: notebooks.length };
    });

    await step('sessions.list', async () => {
      const data = await requestJson(`${base}/api/sessions`);
      assert(data.ok === true, 'sessions list not ok');
      const sessions = data.data?.sessions || data.sessions || [];
      assert(Array.isArray(sessions), 'sessions is not array');
      return { count: sessions.length };
    });

    await step('auth.system_profile.dry_run', async () => {
      const data = await requestJson(`${base}/api/auth/open-system-profile`, {
        method: 'POST',
        body: { dry_run: true, profileDirectory: 'Profile 1' },
      });
      assert(data.ok === true, 'system profile dry run not ok');
      assert(data.dryRun === true, 'system profile dry run flag missing');
      assert(data.url === 'https://notebooklm.google.com/', 'unexpected NotebookLM URL');
      assert(data.command?.cmd, 'open command missing');
      return { cmd: data.command.cmd, args: data.command.args };
    });

    await step('content.questions.list_read', async () => {
      const data = await requestJson(`${base}/api/content/list?space=questions`);
      assert(data.ok === true, 'questions content list not ok');
      assert(Array.isArray(data.files), 'questions files missing');
      const file = data.files.find((item) => ['.json', '.md', '.txt'].includes(item.ext));
      if (!file) return { count: data.files.length, read: 'skipped-no-readable-file' };
      const read = await requestJson(`${base}/api/content/read?space=questions&path=${encodeURIComponent(file.path)}`);
      assert(read.ok === true, 'questions content read not ok');
      assert(Object.prototype.hasOwnProperty.call(read, 'text') || Object.prototype.hasOwnProperty.call(read, 'json'), 'questions readable payload missing');
      return { count: data.files.length, sample: file.path, bytes: read.size };
    });

    await step('content.workspace.list_read', async () => {
      const data = await requestJson(`${base}/api/content/list?space=workspace`);
      assert(data.ok === true, 'workspace content list not ok');
      assert(Array.isArray(data.files), 'workspace files missing');
      const file = data.files.find((item) => ['.json', '.md', '.txt'].includes(item.ext));
      if (!file) return { count: data.files.length, read: 'skipped-no-readable-file' };
      const read = await requestJson(`${base}/api/content/read?space=workspace&path=${encodeURIComponent(file.path)}`);
      assert(read.ok === true, 'workspace content read not ok');
      assert(Object.prototype.hasOwnProperty.call(read, 'text') || Object.prototype.hasOwnProperty.call(read, 'json'), 'workspace readable payload missing');
      return { count: data.files.length, sample: file.path, bytes: read.size };
    });

    await step('updates.check.no_repo', async () => {
      const data = await requestJson(`${base}/api/updates/check`, { method: 'POST' });
      assert(data.ok === true, 'update check should be ok without repo');
      assert(data.hasUpdate === false, 'unexpected update without repo');
      return { message: data.message };
    });

    await step('agent.config', async () => {
      const data = await requestJson(`${base}/api/agent/config`);
      assert(data.ok === true, 'agent config not ok');
      assert(Array.isArray(data.tools), 'agent tools missing');
      assert(data.tools.some((tool) => tool.function?.name === 'nb_get_health'), 'nb_get_health missing');
      return { toolCount: data.tools.length };
    });

    await step('agent.provider_test_expected_fail', async () => {
      const data = await requestJson(`${base}/api/agent/test`, { method: 'POST', body: {} });
      assert(data.ok === false, 'provider test should fail against closed smoke port');
      return { handledError: data.error || 'failed as expected' };
    });

    await step('package.artifact', async () => {
      const releaseRoot = path.join(rootDir, 'release');
      const exists = fs.existsSync(releaseRoot);
      assert(exists, 'release directory missing; run npm run package');
      const entries = fs.readdirSync(releaseRoot).filter((entry) => entry.includes('NotebookLM-MCP-Desktop'));
      assert(entries.length > 0, 'desktop package artifact missing');
      return { artifact: entries[0] };
    });

    skip('auth.setup', 'Interactive Google login required; validate manually via Connect/Setup Auth in Electron UI.');
    skip('ask.validate', 'Requires authenticated NotebookLM account and active notebook.');
    skip('sources.add', 'Requires authenticated NotebookLM account and target notebook.');
    skip('audio.generate/status/download', 'Requires authenticated NotebookLM account and notebook with sources.');
    skip('agent.chat.real_llm', 'Requires configured OpenAI-compatible provider key/base URL.');
    skip('electron.visual_ui', 'Requires manual GUI review with npm run desktop.');
  } finally {
    await bridge.stop();
  }

  printReport();
  const failed = report.filter((item) => item.status === 'FAIL');
  if (failed.length) process.exit(1);
}

async function step(name, fn) {
  const started = Date.now();
  try {
    const details = await fn();
    report.push({ name, status: 'PASS', ms: Date.now() - started, details });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.push({ name, status: 'FAIL', ms: Date.now() - started, error: error.message || String(error) });
    console.error(`FAIL ${name}: ${error.message || error}`);
  }
}

function skip(name, reason) {
  report.push({ name, status: 'SKIP', reason });
  console.log(`SKIP ${name}: ${reason}`);
}

function printReport() {
  const counts = report.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const out = {
    generatedAt: new Date().toISOString(),
    counts,
    report,
  };
  const outFile = path.join(rootDir, '.manager', 'desktop-smoke-report.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nSmoke report: ${outFile}`);
  console.log(JSON.stringify(counts, null, 2));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requestJson(url, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(target, {
      method,
      timeout: 650000,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(text.trim() ? JSON.parse(text) : {});
        } catch (error) {
          reject(new Error(`invalid json from ${url}: ${error.message}: ${text.slice(0, 120)}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${url}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitForSseEvent(url, expectedEvent, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(target, { method: 'GET', headers: { Accept: 'text/event-stream' } }, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const events = buffer.split(/\n\n/);
        buffer = events.pop() || '';
        for (const raw of events) {
          const event = parseSse(raw);
          if (event.event === expectedEvent) {
            clearTimeout(timer);
            req.destroy();
            resolve(event.data);
            return;
          }
        }
      });
    });
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Timed out waiting for SSE event ${expectedEvent}`));
    }, timeoutMs);
    req.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.end();
  });
}

function parseSse(raw) {
  const event = { event: 'message', data: {} };
  const dataLines = [];
  raw.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('event:')) event.event = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  });
  try { event.data = JSON.parse(dataLines.join('\n') || '{}'); } catch { event.data = {}; }
  return event;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
