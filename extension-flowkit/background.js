importScripts('background_requests.js', 'background_telemetry.js', 'background_media_urls.js');
/**
 * Flow Kit — Chrome Extension Background Service Worker
 *
 * Connects to local Python agent via WebSocket (agent runs WS server).
 * Captures bearer token, solves reCAPTCHA, proxies API calls through browser.
 */

const AGENT_WS_URL = 'ws://127.0.0.1:9222';
const AGENT_WS_PROBE_URL = 'http://127.0.0.1:9222/';
const NOTEBOOKLM_URL = 'https://notebooklm.google.com/';
const NOTEBOOKLM_URL_PATTERNS = ['https://notebooklm.google.com/*'];

let ws = null;
let flowKey = null;
let callbackSecret = null;  // Auth secret for HTTP callback, received from server on WS connect
let state = 'off'; // off | idle | running
let manualDisconnect = false;
let suppressNextClose = false;
let connectInFlight = false;
let metrics = {
  tokenCapturedAt: null,
  requestCount: 0,   // captcha-consuming requests only (gen image/video/upscale)
  successCount: 0,
  failedCount: 0,
  lastError: null,
};

// ─── URL → Log Type Classifier ─────────────────────────────

// Visible log types — only these appear in the request log
const _VISIBLE_TYPES = new Set(['GEN_IMG', 'GEN_VID', 'GEN_VID_REF', 'UPSCALE', 'TRACKING', 'URL_REFRESH']);

function _classifyApiUrl(url) {
  if (url.includes('uploadImage'))                     return 'UPLOAD';
  if (url.includes('batchGenerateImages'))              return 'GEN_IMG';
  if (url.includes('UpsampleVideo'))                   return 'UPSCALE';
  if (url.includes('ReferenceImages'))                 return 'GEN_VID_REF';
  if (url.includes('batchAsyncGenerateVideo'))          return 'GEN_VID';
  if (url.includes('batchCheckAsync'))                  return 'POLL';
  if (url.includes('upsampleImage'))                   return 'UPS_IMG';
  if (url.includes('/media/'))                         return 'MEDIA';
  if (url.includes('/credits'))                        return 'CREDITS';
  return 'API';
}

// ─── Request Log ────────────────────────────────────────────

let requestLog = [];

function addRequestLog(entry) {
  requestLog.unshift(entry);
  if (requestLog.length > 100) requestLog.pop();
  broadcastRequestLog();
}

function updateRequestLog(id, updates) {
  const entry = requestLog.find((e) => e.id === id);
  if (entry) Object.assign(entry, updates);
  broadcastRequestLog();
}

function broadcastRequestLog() {
  chrome.runtime.sendMessage({ type: 'REQUEST_LOG_UPDATE', log: requestLog }).catch(() => {});
}

function clearRequestLog() {
  requestLog = [];
  broadcastRequestLog();
}

// ─── Startup ────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
init().catch((error) => console.error('[FlowAgent] init failed:', error));


chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'reconnect') connectToAgent();
  if (alarm.name === 'keepAlive') keepAlive();
  if (alarm.name === 'token-refresh') {
    await captureTokenFromNotebookLMTab();
  }
});

async function init() {
  const data = await chrome.storage.local.get(['flowKey', 'metrics', 'callbackSecret']);
  if (data.flowKey) flowKey = data.flowKey;
  if (data.metrics) Object.assign(metrics, data.metrics);
  if (data.callbackSecret) callbackSecret = data.callbackSecret;
  connectToAgent();
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
}

// Enable opening the side panel on clicking the action icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Fallback just in case setPanelBehavior doesn't catch it
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});

// ─── Token Capture ──────────────────────────────────────────

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details?.requestHeaders?.length) return;
    const authHeader = details.requestHeaders.find(
      (h) => h.name?.toLowerCase() === 'authorization',
    );
    const value = authHeader?.value || '';
    if (!value.startsWith('Bearer ya29.')) return;

    const token = value.replace(/^Bearer\s+/i, '').trim();
    if (!token) return;

    // Always update — even if same token string, refresh the timestamp
    flowKey = token;
    metrics.tokenCapturedAt = Date.now();
    chrome.storage.local.set({ flowKey, metrics });
    console.log('[FlowAgent] NotebookLM bearer token captured');

    // Notify agent
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'token_captured', flowKey }));
    }
  },
  { urls: NOTEBOOKLM_URL_PATTERNS },
  ['requestHeaders', 'extraHeaders'],
);

let _openingNotebookLMTab = false;

async function clearFlowSessionAndReload(reason = 'reCAPTCHA failure') {
  console.warn('[FlowAgent] NotebookLM session refresh disabled; keeping cookies/token:', reason);
  metrics.lastError = `NotebookLM session refresh disabled (${reason})`;
  await chrome.storage.local.set({ metrics });
  await captureTokenFromNotebookLMTab();
  broadcastStatus();
  return { ok: false, disabled: true, reason, message: 'Cookie clearing is disabled; kept NotebookLM session intact.' };
}

async function captureTokenFromNotebookLMTab() {
  const tabs = await chrome.tabs.query({
    url: NOTEBOOKLM_URL_PATTERNS,
  });
  if (!tabs.length) {
    if (_openingNotebookLMTab) {
      console.log('[FlowAgent] NotebookLM tab already opening, skipping');
      return;
    }
    _openingNotebookLMTab = true;
    try {
      console.log('[FlowAgent] No NotebookLM tab found — opening one in background');
      await chrome.tabs.create({ url: NOTEBOOKLM_URL, active: false });
      await sleep(3000);
      const retryTabs = await chrome.tabs.query({
        url: NOTEBOOKLM_URL_PATTERNS,
      });
      if (!retryTabs.length) {
        console.log('[FlowAgent] NotebookLM tab not ready yet after open');
        return;
      }
      await chrome.tabs.reload(retryTabs[0].id);
      console.log('[FlowAgent] Token refresh triggered on newly opened NotebookLM tab');
    } catch (e) {
      console.error('[FlowAgent] Token refresh failed after opening tab:', e);
    } finally {
      _openingNotebookLMTab = false;
    }
    return;
  }
  try {
    await chrome.tabs.reload(tabs[0].id);
    console.log('[FlowAgent] Token refresh triggered on NotebookLM tab');
  } catch (e) {
    console.error('[FlowAgent] Token refresh failed:', e);
  }
}

// ─── WebSocket to Agent ─────────────────────────────────────

async function agentSocketPortOpen(timeoutMs = 900) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(AGENT_WS_PROBE_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function connectToAgent() {
  if (manualDisconnect) return;
  if (ws?.readyState === WebSocket.CONNECTING) return;
  if (ws?.readyState === WebSocket.OPEN) return;
  if (connectInFlight) return;

  connectInFlight = true;
  const portOpen = await agentSocketPortOpen();
  connectInFlight = false;
  if (!portOpen) {
    ws = null;
    chrome.alarms.clear('token-refresh');
    metrics.lastError = null;
    chrome.storage.local.set({ metrics });
    setState('off');
    scheduleReconnect();
    return;
  }

  try {
    ws = new WebSocket(AGENT_WS_URL);
  } catch (e) {
    metrics.lastError = null;
    chrome.storage.local.set({ metrics });
    broadcastStatus();
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[FlowAgent] Connected to agent');
    metrics.lastError = null;
    chrome.storage.local.set({ metrics });
    chrome.alarms.clear('reconnect');
    setState('idle');

    // Token refresh alarm — 45 min gives buffer before ~60 min expiry
    chrome.alarms.create('token-refresh', { periodInMinutes: 45 });

    // Send current state + resend token if we have one
    ws.send(JSON.stringify({
      type: 'extension_ready',
      flowKeyPresent: !!flowKey,
      tokenAge: flowKey && metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
    }));
    if (flowKey) {
      ws.send(JSON.stringify({ type: 'token_captured', flowKey }));
    }
  };

  ws.onmessage = async ({ data }) => {
    try {
      const msg = JSON.parse(data);

      if (msg.method === 'refresh_flow_session') {
        const result = await clearFlowSessionAndReload(msg.params?.reason || 'agent requested refresh');
        sendToAgent({ id: msg.id, result });
      } else if (msg.method === 'api_request') {
        await handleApiRequest(msg);
      } else if (msg.method === 'trpc_request') {
        await handleTrpcRequest(msg);
      } else if (msg.method === 'solve_captcha') {
        await handleSolveCaptcha(msg);
      } else if (msg.method === 'get_status') {
        sendToAgent({
          id: msg.id,
          result: {
            state,
            flowKeyPresent: !!flowKey,
            manualDisconnect,
            tokenAge: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
            metrics,
          },
        });
      } else if (msg.type === 'callback_secret') {
        callbackSecret = msg.secret;
        chrome.storage.local.set({ callbackSecret: msg.secret });
        console.log('[FlowAgent] Received callback secret');
      } else if (msg.type === 'pong') {
        // keepalive response
      }
    } catch (e) {
      console.error('[FlowAgent] Message error:', e);
    }
  };

  ws.onclose = (event) => {
    setState('off');
    chrome.alarms.clear('token-refresh');
    if (suppressNextClose) {
      suppressNextClose = false;
      return;
    }
    if (!manualDisconnect) {
      metrics.lastError = null;
      chrome.storage.local.set({ metrics });
      broadcastStatus();
    }
    if (!manualDisconnect) scheduleReconnect();
  };

  ws.onerror = (e) => {
    metrics.lastError = null;
    chrome.storage.local.set({ metrics });
    broadcastStatus();
    try { ws?.close(); } catch (_) {}
  };
}

function restartAgentSocket(reason = 'manual restart') {
  manualDisconnect = false;
  chrome.alarms.clear('reconnect');
  chrome.alarms.clear('token-refresh');

  metrics.lastError = `Restarting agent WebSocket (${reason})...`;
  chrome.storage.local.set({ metrics });
  setState('off');

  const oldSocket = ws;
  ws = null;
  if (oldSocket && oldSocket.readyState !== WebSocket.CLOSED) {
    suppressNextClose = true;
    try { oldSocket.close(); } catch (_) {}
  }

  setTimeout(() => {
    suppressNextClose = false;
    connectToAgent();
  }, 250);
}

function scheduleReconnect() {
  chrome.alarms.create('reconnect', { delayInMinutes: 0.083 }); // ~5s
}

function keepAlive() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  } else {
    connectToAgent();
  }
}

function sendToAgent(msg) {
  // API responses (with msg.id) go via HTTP — immune to WS disconnect
  if (msg.id) {
    fetch('http://127.0.0.1:8100/api/ext/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    }).catch(() => {
      // HTTP failed — fallback to WS
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    });
    return;
  }
  // Non-response messages (ping, status) or no secret yet — use WS
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ─── reCAPTCHA Solving ──────────────────────────────────────

function setState(newState) {
  state = newState;
  const badges = { idle: '●', running: '▶', off: '○' };
  const colors = { idle: '#22c55e', running: '#f59e0b', off: '#6b7280' };
  chrome.action.setBadgeText({ text: badges[state] || '' });
  chrome.action.setBadgeBackgroundColor({ color: colors[state] || '#000' });
  broadcastStatus();
}

function broadcastStatus() {
  chrome.runtime.sendMessage({ type: 'STATUS_PUSH' }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg.type === 'STATUS') {
    reply({
      connected: ws?.readyState === WebSocket.OPEN,
      agentConnected: ws?.readyState === WebSocket.OPEN,
      flowKeyPresent: !!flowKey,
      manualDisconnect,
      tokenAge: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
      metrics: {
        requestCount: metrics.requestCount,
        successCount: metrics.successCount,
        failedCount: metrics.failedCount,
        lastError: metrics.lastError,
      },
      state,
    });
  }

  if (msg.type === 'DISCONNECT') {
    manualDisconnect = true;
    if (ws) ws.close();
    reply({ ok: true });
    return true;
  }

  if (msg.type === 'RECONNECT') {
    restartAgentSocket('user requested reconnect');
    reply({ ok: true });
    return true;
  }

  if (msg.type === 'RESTART_SOCKET') {
    restartAgentSocket('user requested restart');
    reply({ ok: true });
    return true;
  }

  if (msg.type === 'REQUEST_LOG') {
    reply({ log: requestLog });
    return true;
  }

  if (msg.type === 'CLEAR_REQUEST_LOG') {
    clearRequestLog();
    reply({ ok: true, log: requestLog });
    return true;
  }

  if (msg.type === 'OPEN_FLOW_TAB') {
    chrome.tabs.create({ url: 'https://notebooklm.google.com/', active: true })
      .then((tab) => reply({ ok: true, tabId: tab.id }))
      .catch((e) => reply({ error: e.message }));
    return true;
  }

  if (msg.type === 'REFRESH_TOKEN') {
    captureTokenFromNotebookLMTab()
      .then(() => reply({ ok: true }))
      .catch((e) => reply({ error: e.message }));
    return true;
  }

  if (msg.type === 'REFRESH_FLOW_SESSION') {
    clearFlowSessionAndReload('manual refresh')
      .then((result) => reply(result))
      .catch((e) => reply({ error: e.message }));
    return true;
  }

  if (msg.type === 'TEST_CAPTCHA') {
    solveCaptcha(`test-${Date.now()}`, msg.pageAction || 'IMAGE_GENERATION')
      .then((r) => reply(r))
      .catch((e) => reply({ error: e.message }));
    return true;
  }

  if (msg.type === 'TRPC_MEDIA_URLS') {
    handleTrpcMediaUrls(msg.trpcUrl, msg.body, (entries) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'media_urls_refresh', urls: entries }));
      }
    });
    reply({ ok: true });
    return true;
  }

  return true;
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Human-like Telemetry ──────────────────────────────────
// Periodically send tracking events to Google's analytics endpoints
// to mimic normal browser behavior.
