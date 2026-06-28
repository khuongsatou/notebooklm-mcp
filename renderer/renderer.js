'use strict';

const api = window.notebookDesktop;
const state = {
  info: null,
  settings: null,
  notebooks: [],
  sessions: [],
  logs: [],
  agentMessages: [],
  agentTools: [],
  latestAnswer: '',
  diagnostics: {},
  questions: [],
  workspace: [],
  selectedQuestion: null,
  selectedWorkspace: null,
};

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function pretty(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function setBusy(id, busy) {
  const el = $(id);
  if (el) el.disabled = Boolean(busy);
}

function showView(view) {
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function errorMessage(error, fallback = 'Action failed') {
  return error?.message || error?.error || String(error || fallback);
}

function showNotice(message, type = 'warning') {
  const el = $('appNotice');
  if (!el) return;
  el.hidden = false;
  el.className = `app-notice ${type}`;
  el.textContent = message;
}

function clearNotice() {
  const el = $('appNotice');
  if (el) el.hidden = true;
}

async function startupStep(label, fn) {
  try {
    await fn();
    return true;
  } catch (error) {
    const message = `${label}: ${errorMessage(error)}`;
    state.diagnostics.startup = [...(state.diagnostics.startup || []), { label, error: errorMessage(error) }];
    showNotice(message, 'warning');
    return false;
  }
}

function setConnectionStatus(status, label, title) {
  const el = $('connectStatus');
  if (!el) return;
  el.classList.remove('is-unknown', 'is-checking', 'is-success', 'is-warning', 'is-error');
  el.classList.add(`is-${status}`);
  el.title = title || label;
  setText('connectStatusLabel', label);
}

function setConnectionStatusFromHealth(res) {
  const health = res?.health || {};
  const data = health.data || health;
  const authenticated = data.authenticated;
  if (!res?.mcpStarted) {
    setConnectionStatus('error', 'MCP error', 'MCP server is not ready');
  } else if (authenticated === true) {
    setConnectionStatus('success', 'Connected', 'NotebookLM is authenticated and ready');
  } else if (authenticated === false) {
    setConnectionStatus('warning', 'Login needed', 'NotebookLM needs login before it can be used');
  } else {
    setConnectionStatus('warning', 'Unknown', 'Could not confirm NotebookLM authentication');
  }
}

async function init() {
  bindNavigation();
  bindActions();
  bindEvents();
  await startupStep('Bridge info', loadInfo);
  await startupStep('Settings', loadSettings);
  await startupStep('Agent config', loadAgentConfig);
  await startupStep('Health check', refreshHealth);
  await startupStep('Logs', loadLogs);
  await startupStep('Questions', () => loadContentSpace('questions'));
  await startupStep('Workspace', () => loadContentSpace('workspace'));
  $('loading').hidden = true;
}

function bindNavigation() {
  document.querySelectorAll('[data-view], [data-view-jump]').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view || btn.dataset.viewJump));
  });
}

function bindActions() {
  $('bridgeBtn').addEventListener('click', () => api.bridge.openApi());
  $('versionBtn').addEventListener('click', openVersionModal);
  $('closeModalBtn').addEventListener('click', () => $('modalBackdrop').hidden = true);
  $('checkUpdateBtn').addEventListener('click', checkUpdate);
  $('copyDiagBtn').addEventListener('click', copyDiagnostics);

  $('connectBtn').addEventListener('click', connectNotebookLM);
  $('refreshHealthBtn').addEventListener('click', refreshHealth);
  $('setupAuthBtn').addEventListener('click', () => setupAuth(false));
  $('reauthBtn').addEventListener('click', () => setupAuth(true));
  $('loadNotebooksBtn').addEventListener('click', loadNotebooks);
  $('reloadNotebooksBtn').addEventListener('click', loadNotebooks);
  $('loadSessionsBtn').addEventListener('click', loadSessions);
  $('reloadSessionsBtn').addEventListener('click', loadSessions);
  $('addNotebookBtn').addEventListener('click', addNotebook);

  $('quickAskBtn').addEventListener('click', quickAsk);
  $('askBtn').addEventListener('click', askQuestion);
  $('copyAnswerBtn').addEventListener('click', () => navigator.clipboard.writeText(state.latestAnswer || $('answerBox').textContent || ''));
  $('addSourceBtn').addEventListener('click', addSource);
  $('audioRunBtn').addEventListener('click', runAudio);
  $('chooseAudioDirBtn').addEventListener('click', chooseAudioDir);

  $('reloadQuestionsBtn').addEventListener('click', () => loadContentSpace('questions'));
  $('reloadWorkspaceBtn').addEventListener('click', () => loadContentSpace('workspace'));
  $('questionSearch').addEventListener('input', () => renderContentList('questions'));
  $('workspaceSearch').addEventListener('input', () => renderContentList('workspace'));
  $('copyQuestionBtn').addEventListener('click', () => copySelectedContent('questions'));
  $('copyWorkspaceBtn').addEventListener('click', () => copySelectedContent('workspace'));

  $('reloadLogsBtn').addEventListener('click', loadLogs);
  $('clearLogsBtn').addEventListener('click', clearLogs);
  $('logLevel').addEventListener('change', loadLogs);
  $('logQuery').addEventListener('input', debounce(loadLogs, 250));

  $('saveSettingsBtn').addEventListener('click', saveSettings);
  $('agentSendBtn').addEventListener('click', sendAgentMessage);
  $('copyAgentBtn').addEventListener('click', copyAgentSession);
  $('agentInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendAgentMessage();
    }
  });
}

function bindEvents() {
  api.bridge.onEvent(({ event, payload }) => {
    if (event === 'log:event') {
      state.logs.unshift(payload);
      renderLogs();
    }
    if (event === 'bridge:status') {
      state.diagnostics.lastBridgeEvent = payload;
    }
    if (event === 'agent:step') {
      appendAgentStep(payload);
    }
  });
}

async function loadInfo() {
  const info = await api.bridge.info();
  state.info = info;
  const version = info.appInfo?.version || '0.0.0';
  $('versionBtn').textContent = `v${version}`;
  setText('bridgeStatus', info.url || 'Ready');
}

async function loadSettings() {
  const res = await api.settings.get();
  if (!res.ok) return;
  state.settings = res.settings;
  hydrateSettings(res.settings);
}

function hydrateSettings(settings) {
  const map = {
    setBridgeHost: settings.bridgeHost,
    setBridgePort: settings.bridgePort,
    setMcpPort: settings.mcpPort,
    setConnectMode: settings.connectMode,
    setChromeProfileDirectory: settings.systemChromeProfileDirectory,
    setBrowserMode: settings.browserMode,
    setSourceFormat: settings.defaultSourceFormat,
    setProviderBase: settings.providerBaseUrl,
    setProviderModel: settings.providerModel,
    setAgentLoops: settings.agentMaxLoops,
    setContextLimit: settings.agentContextLimit,
    setUpdateRepo: settings.updateRepo,
  };
  Object.entries(map).forEach(([id, value]) => {
    if ($(id)) $(id).value = value ?? '';
  });
  $('setProviderKey').placeholder = settings.hasProviderApiKey ? 'Saved key configured' : 'Paste provider key';
}

function collectSettings() {
  const patch = {
    bridgeHost: $('setBridgeHost').value.trim(),
    bridgePort: Number($('setBridgePort').value),
    mcpPort: Number($('setMcpPort').value),
    connectMode: $('setConnectMode').value,
    systemChromeProfileDirectory: $('setChromeProfileDirectory').value,
    browserMode: $('setBrowserMode').value,
    defaultSourceFormat: $('setSourceFormat').value,
    providerBaseUrl: $('setProviderBase').value.trim(),
    providerModel: $('setProviderModel').value.trim(),
    agentMaxLoops: Number($('setAgentLoops').value),
    agentContextLimit: Number($('setContextLimit').value),
    updateRepo: $('setUpdateRepo').value.trim(),
  };
  const key = $('setProviderKey').value.trim();
  if (key) patch.providerApiKey = key;
  return patch;
}

async function saveSettings() {
  setBusy('saveSettingsBtn', true);
  try {
    const res = await api.settings.save(collectSettings());
    $('settingsStatus').textContent = pretty(res);
    if (res.ok) {
      state.settings = res.settings;
      hydrateSettings(res.settings);
      showNotice('Settings saved.', 'success');
    }
  } catch (error) {
    $('settingsStatus').textContent = pretty({ ok: false, error: errorMessage(error) });
    showNotice(`Settings save failed: ${errorMessage(error)}`, 'error');
  } finally {
    setBusy('saveSettingsBtn', false);
  }
}

async function refreshHealth() {
  setBusy('refreshHealthBtn', true);
  try {
    const res = await api.notebook.health();
    state.diagnostics.health = res;
    const health = res.health || {};
    const data = health.data || health;
    setText('mcpStatus', res.mcpStarted ? 'Ready' : 'Not ready');
    setText('authStatus', data.authenticated === true ? 'Authenticated' : data.authenticated === false ? 'Needs login' : 'Unknown');
    setText('metricAuth', data.authenticated === true ? 'OK' : data.authenticated === false ? 'Login' : 'Unknown');
    setText('authIcon', data.authenticated === true ? '●' : '○');
    setText('metricSessions', String(data.session_stats?.active_sessions || data.active_sessions || 0));
    setText('activeNotebook', data.active_notebook?.name || data.activeNotebook?.name || data.active_notebook?.id || '—');
    setConnectionStatusFromHealth(res);
    if (res?.mcpStarted) clearNotice();
    return res;
  } catch (error) {
    const message = error?.message || 'Health check failed';
    state.diagnostics.healthError = message;
    setText('mcpStatus', 'Not ready');
    setText('authStatus', 'Check failed');
    setText('metricAuth', 'Error');
    setText('authIcon', '○');
    setConnectionStatus('error', 'Failed', message);
    throw error;
  } finally {
    setBusy('refreshHealthBtn', false);
  }
}

async function connectNotebookLM() {
  setBusy('connectBtn', true);
  setConnectionStatus('checking', 'Checking', 'Checking NotebookLM connection');
  try {
    const health = await refreshHealth();
    const authenticated = health.health?.data?.authenticated ?? health.health?.authenticated;
    const connectMode = $('setConnectMode')?.value || state.settings?.connectMode || 'systemChrome';
    if (authenticated === false && connectMode === 'mcpAuth') {
      await setupAuth(false);
    } else if (authenticated === false) {
      await openSystemProfile();
    } else if (authenticated === true) {
      await loadNotebooks();
      setConnectionStatus('success', 'Connected', 'NotebookLM is authenticated and notebooks loaded');
    } else {
      setConnectionStatus('warning', 'Unknown', 'MCP is ready but auth status is unknown');
    }
  } catch (error) {
    const message = error?.message || 'Connect failed';
    setConnectionStatus('error', 'Failed', message);
    if ($('answerBox')) $('answerBox').textContent = pretty({ ok: false, error: message });
  } finally {
    setBusy('connectBtn', false);
  }
}

async function openSystemProfile() {
  const payload = {
    profileDirectory: $('setChromeProfileDirectory')?.value || state.settings?.systemChromeProfileDirectory || '',
  };
  const res = await api.notebook.openSystemProfile(payload);
  state.diagnostics.systemProfile = res;
  setText('authStatus', res.ok ? 'System Chrome opened' : 'Open failed');
  setText('metricAuth', res.ok ? 'Chrome' : 'Error');
  setConnectionStatus(res.ok ? 'warning' : 'error', res.ok ? 'Chrome opened' : 'Open failed', res.ok ? 'Chrome profile opened. Sign in, then press Connect again.' : (res.error || 'Could not open Chrome profile'));
  $('answerBox').textContent = pretty({
    ...res,
    note: 'Connect opened the existing Chrome profile. Use Setup Auth only if you want the MCP private profile.',
  });
  return res;
}

async function setupAuth(reauth) {
  const browserMode = $('setBrowserMode')?.value || state.settings?.browserMode || 'visible';
  const payload = { show_browser: browserMode !== 'headless' };
  const buttonId = reauth ? 'reauthBtn' : 'setupAuthBtn';
  setBusy(buttonId, true);
  try {
    const res = reauth ? await api.notebook.reauth(payload) : await api.notebook.setupAuth(payload);
    $('answerBox').textContent = pretty(res);
    const health = await refreshHealth();
    const authenticated = health.health?.data?.authenticated ?? health.health?.authenticated;
    if (authenticated === true) {
      setConnectionStatus('success', 'Connected', 'NotebookLM is authenticated and ready');
    } else if (authenticated === false) {
      setConnectionStatus('warning', 'Login needed', 'Finish login in the browser, then press Connect again');
    }
  } catch (error) {
    const message = errorMessage(error, 'Auth setup failed');
    setConnectionStatus('error', 'Auth failed', message);
    $('answerBox').textContent = pretty({ ok: false, error: message });
    showNotice(`Auth failed: ${message}`, 'error');
  } finally {
    setBusy(buttonId, false);
  }
}

async function loadNotebooks() {
  setBusy('loadNotebooksBtn', true);
  setBusy('reloadNotebooksBtn', true);
  try {
    const res = await api.notebook.notebooks();
    if (res.ok === false) throw new Error(res.error || 'Load notebooks failed');
    const notebooks = res.data?.notebooks || res.notebooks || [];
    state.notebooks = notebooks;
    setText('metricNotebooks', String(notebooks.length));
    renderNotebooks();
    hydrateNotebookSelects();
    return notebooks;
  } catch (error) {
    const message = errorMessage(error, 'Load notebooks failed');
    $('notebookList').className = 'list empty';
    $('notebookList').textContent = `Load failed: ${message}`;
    showNotice(`Notebook list failed: ${message}`, 'error');
    return [];
  } finally {
    setBusy('loadNotebooksBtn', false);
    setBusy('reloadNotebooksBtn', false);
  }
}

function renderNotebooks() {
  const el = $('notebookList');
  if (!state.notebooks.length) {
    el.className = 'list empty';
    el.textContent = 'No notebooks found.';
    return;
  }
  el.className = 'list';
  el.innerHTML = state.notebooks.map((nb) => `
    <div class="list-item">
      <div>
        <strong>${esc(nb.name || nb.id)}</strong>
        <small>${esc(nb.id || '')}</small>
        <small>${esc(nb.url || '')}</small>
      </div>
      <div class="list-actions">
        <button class="icon-btn" data-select-notebook="${esc(nb.id)}" title="Select">✓</button>
        <button class="icon-btn" data-remove-notebook="${esc(nb.id)}" title="Remove">×</button>
      </div>
    </div>
  `).join('');
  el.querySelectorAll('[data-select-notebook]').forEach((btn) => btn.addEventListener('click', async () => {
    await api.notebook.select(btn.dataset.selectNotebook);
    await refreshHealth();
  }));
  el.querySelectorAll('[data-remove-notebook]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm(`Remove notebook ${btn.dataset.removeNotebook}?`)) return;
    await api.notebook.remove(btn.dataset.removeNotebook);
    await loadNotebooks();
  }));
}

function hydrateNotebookSelects() {
  ['askNotebook', 'sourceNotebook', 'audioNotebook'].forEach((id) => {
    const select = $(id);
    const old = select.value;
    select.innerHTML = '<option value="">Active notebook</option>' + state.notebooks.map((nb) => `<option value="${esc(nb.id)}">${esc(nb.name || nb.id)}</option>`).join('');
    select.value = old;
  });
}

async function addNotebook() {
  const payload = {
    url: $('notebookUrl').value.trim(),
    name: $('notebookName').value.trim(),
    description: $('notebookDescription').value.trim() || 'Notebook added from desktop app',
    topics: $('notebookTopics').value.split(',').map((s) => s.trim()).filter(Boolean),
  };
  if (!payload.url || !payload.name) return;
  setBusy('addNotebookBtn', true);
  try {
    const res = await api.notebook.add(payload);
    $('answerBox').textContent = pretty(res);
    if (res.ok === false) throw new Error(res.error || 'Add notebook failed');
    await loadNotebooks();
    showNotice('Notebook added.', 'success');
  } catch (error) {
    const message = errorMessage(error, 'Add notebook failed');
    $('answerBox').textContent = pretty({ ok: false, error: message });
    showNotice(`Add notebook failed: ${message}`, 'error');
  } finally {
    setBusy('addNotebookBtn', false);
  }
}

async function quickAsk() {
  $('askQuestion').value = $('quickQuestion').value;
  $('askSourceFormat').value = $('quickSourceFormat').value;
  showView('ask');
  await askQuestion();
}

async function askQuestion() {
  const question = $('askQuestion').value.trim();
  if (!question) return;
  const payload = {
    question,
    notebook_id: $('askNotebook').value || undefined,
    source_format: $('askSourceFormat').value,
    show_browser: $('askShowBrowser').checked,
  };
  setBusy('askBtn', true);
  setBusy('quickAskBtn', true);
  $('answerBox').textContent = 'Asking NotebookLM...';
  try {
    const res = await api.notebook.ask(payload);
    if (res.ok === false) throw new Error(res.error || 'Ask failed');
    const answer = res.data?.answer || res.answer || pretty(res);
    state.latestAnswer = answer;
    $('answerBox').textContent = answer;
  } catch (error) {
    const message = errorMessage(error, 'Ask failed');
    $('answerBox').textContent = pretty({ ok: false, error: message });
    showNotice(`Ask failed: ${message}`, 'error');
  } finally {
    setBusy('askBtn', false);
    setBusy('quickAskBtn', false);
  }
}

async function addSource() {
  const payload = {
    type: $('sourceType').value,
    content: $('sourceContent').value.trim(),
    title: $('sourceTitle').value.trim() || undefined,
    notebook_id: $('sourceNotebook').value || undefined,
  };
  if (!payload.content) return;
  setBusy('addSourceBtn', true);
  $('sourceResult').textContent = 'Adding source...';
  try {
    const res = await api.notebook.addSource(payload);
    if (res.ok === false) throw new Error(res.error || 'Add source failed');
    $('sourceResult').textContent = pretty(res);
  } catch (error) {
    const message = errorMessage(error, 'Add source failed');
    $('sourceResult').textContent = pretty({ ok: false, error: message });
    showNotice(`Add source failed: ${message}`, 'error');
  } finally {
    setBusy('addSourceBtn', false);
  }
}

async function chooseAudioDir() {
  try {
    const res = await api.dialog.chooseDirectory();
    if (res.ok) $('audioDestination').value = res.path;
  } catch (error) {
    showNotice(`Choose folder failed: ${errorMessage(error)}`, 'error');
  }
}

async function runAudio() {
  const mode = $('audioMode').value;
  const base = {
    notebook_id: $('audioNotebook').value || undefined,
    custom_prompt: $('audioPrompt').value.trim() || undefined,
    show_browser: true,
  };
  setBusy('audioRunBtn', true);
  $('audioResult').textContent = 'Running audio action...';
  try {
    let res;
    if (mode === 'status') res = await api.notebook.audioStatus(base);
    else if (mode === 'download') res = await api.notebook.audioDownload({ ...base, destination_dir: $('audioDestination').value.trim() });
    else res = await api.notebook.audioGenerate({ ...base, wait_for_completion: mode === 'wait', timeout_ms: mode === 'wait' ? 600000 : undefined });
    if (res.ok === false) throw new Error(res.error || 'Audio action failed');
    $('audioResult').textContent = pretty(res);
  } catch (error) {
    const message = errorMessage(error, 'Audio action failed');
    $('audioResult').textContent = pretty({ ok: false, error: message });
    showNotice(`Audio action failed: ${message}`, 'error');
  } finally {
    setBusy('audioRunBtn', false);
  }
}

async function loadSessions() {
  setBusy('loadSessionsBtn', true);
  setBusy('reloadSessionsBtn', true);
  try {
    const res = await api.notebook.sessions();
    if (res.ok === false) throw new Error(res.error || 'Load sessions failed');
    const sessions = res.data?.sessions || res.sessions || [];
    state.sessions = sessions;
    setText('metricSessions', String(sessions.length));
    renderSessions();
  } catch (error) {
    const message = errorMessage(error, 'Load sessions failed');
    $('sessionList').className = 'list empty';
    $('sessionList').textContent = `Load failed: ${message}`;
    showNotice(`Session list failed: ${message}`, 'error');
  } finally {
    setBusy('loadSessionsBtn', false);
    setBusy('reloadSessionsBtn', false);
  }
}

function renderSessions() {
  const el = $('sessionList');
  if (!state.sessions.length) {
    el.className = 'list empty';
    el.textContent = 'No active sessions.';
    return;
  }
  el.className = 'list';
  el.innerHTML = state.sessions.map((session) => `
    <div class="list-item">
      <div>
        <strong>${esc(session.id)}</strong>
        <small>${esc(session.notebook_url || '')}</small>
        <small>${esc(session.message_count || 0)} messages · inactive ${esc(session.inactive_seconds || 0)}s</small>
      </div>
      <div class="list-actions">
        <button class="icon-btn" data-session-reset="${esc(session.id)}" title="Reset">↻</button>
        <button class="icon-btn" data-session-close="${esc(session.id)}" title="Close">×</button>
      </div>
    </div>
  `).join('');
  el.querySelectorAll('[data-session-reset]').forEach((btn) => btn.addEventListener('click', () => sessionAction(btn.dataset.sessionReset, 'reset')));
  el.querySelectorAll('[data-session-close]').forEach((btn) => btn.addEventListener('click', () => sessionAction(btn.dataset.sessionClose, 'close')));
}

async function sessionAction(session_id, action) {
  try {
    const res = await api.notebook.sessionAction({ session_id, action });
    if (res.ok === false) throw new Error(res.error || 'Session action failed');
    await loadSessions();
  } catch (error) {
    showNotice(`Session action failed: ${errorMessage(error)}`, 'error');
  }
}

async function loadContentSpace(space) {
  const listId = space === 'questions' ? 'questionFiles' : 'workspaceFiles';
  const viewerId = space === 'questions' ? 'questionViewer' : 'workspaceViewer';
  const selectedKey = space === 'questions' ? 'selectedQuestion' : 'selectedWorkspace';
  $(listId).innerHTML = '<div class="list empty">Loading...</div>';
  try {
    const res = await api.content.list({ space });
    if (!res.ok) {
      $(listId).innerHTML = `<div class="list empty">Load failed: ${esc(res.error || 'unknown')}</div>`;
      return;
    }
    state[space] = res.files || [];
    state[selectedKey] = null;
    $(viewerId).innerHTML = `<div class="list empty">Select a ${space === 'questions' ? 'question' : 'workspace'} file.</div>`;
    renderContentList(space);
  } catch (error) {
    const message = errorMessage(error, 'Load content failed');
    $(listId).innerHTML = `<div class="list empty">Load failed: ${esc(message)}</div>`;
    showNotice(`Content load failed: ${message}`, 'error');
  }
}

function renderContentList(space) {
  const files = state[space] || [];
  const listId = space === 'questions' ? 'questionFiles' : 'workspaceFiles';
  const searchId = space === 'questions' ? 'questionSearch' : 'workspaceSearch';
  const selected = space === 'questions' ? state.selectedQuestion : state.selectedWorkspace;
  const query = ($(searchId)?.value || '').trim().toLowerCase();
  const filtered = files.filter((file) => [file.path, file.name, file.dir, file.ext].join(' ').toLowerCase().includes(query));
  const el = $(listId);
  if (!filtered.length) {
    el.innerHTML = '<div class="list empty">No files found.</div>';
    return;
  }
  el.innerHTML = filtered.map((file) => `
    <button class="content-file ${selected?.path === file.path ? 'active' : ''}" data-content-space="${esc(space)}" data-content-path="${esc(file.path)}">
      <strong>${contentIcon(file.ext)} ${esc(file.name)}</strong>
      <small>${esc(file.dir || '.')} · ${formatBytes(file.size)} · ${esc(file.ext || 'file')}</small>
    </button>
  `).join('');
  el.querySelectorAll('[data-content-path]').forEach((btn) => {
    btn.addEventListener('click', () => readContentFile(btn.dataset.contentSpace, btn.dataset.contentPath));
  });
}

async function readContentFile(space, filePath) {
  const viewerId = space === 'questions' ? 'questionViewer' : 'workspaceViewer';
  $(viewerId).innerHTML = '<div class="list empty">Loading file...</div>';
  try {
    const res = await api.content.read({ space, path: filePath });
    if (!res.ok) {
      $(viewerId).innerHTML = `<div class="list empty">Read failed: ${esc(res.error || 'unknown')}</div>`;
      return;
    }
    const file = { space, ...res };
    if (space === 'questions') state.selectedQuestion = file;
    if (space === 'workspace') state.selectedWorkspace = file;
    renderContentList(space);
    renderContentViewer(file);
  } catch (error) {
    const message = errorMessage(error, 'Read content failed');
    $(viewerId).innerHTML = `<div class="list empty">Read failed: ${esc(message)}</div>`;
    showNotice(`Content read failed: ${message}`, 'error');
  }
}

function renderContentViewer(file) {
  const viewerId = file.space === 'questions' ? 'questionViewer' : 'workspaceViewer';
  const el = $(viewerId);
  const rawPath = esc(file.path || file.name || '');
  const meta = `${rawPath} · ${formatBytes(file.size)} · ${esc(file.ext || 'file')}`;
  const mediaUrl = contentMediaUrl(file.url || '');
  let body = '';
  if (file.media && /\.(png|jpe?g|gif|webp)$/i.test(file.ext || '')) {
    body = `<img class="content-media" src="${esc(mediaUrl)}" alt="${rawPath}" />`;
  } else if (file.media && /\.(mp4|mov|m4v)$/i.test(file.ext || '')) {
    body = `<video class="content-media" src="${esc(mediaUrl)}" controls></video>`;
  } else if (file.json !== null && file.json !== undefined) {
    body = renderJsonSummary(file.json);
  } else if ((file.ext || '').toLowerCase() === '.md') {
    body = renderMarkdownPreview(file.text || '');
  } else {
    body = `<pre class="content-pre">${esc(file.text || '')}</pre>`;
  }
  el.innerHTML = `
    <h2>${contentIcon(file.ext)} ${esc(file.name || file.path)}</h2>
    <div class="content-meta">${meta}</div>
    ${body}
  `;
}

function renderJsonSummary(json) {
  const value = Array.isArray(json) ? { items: json } : json;
  if (!value || typeof value !== 'object') {
    return `<pre class="content-pre">${esc(JSON.stringify(json, null, 2))}</pre>`;
  }
  const entries = Object.entries(value).slice(0, 24);
  const cards = entries.map(([key, item]) => `
    <div class="content-json-card">
      <strong>${esc(key)}</strong>
      <div>${formatJsonValue(item)}</div>
    </div>
  `).join('');
  return `<div class="content-json-grid">${cards}</div><pre class="content-pre">${esc(JSON.stringify(json, null, 2))}</pre>`;
}

function formatJsonValue(value) {
  if (value === null || value === undefined) return '<span class="muted">null</span>';
  if (Array.isArray(value)) return esc(value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n'));
  if (typeof value === 'object') return `<pre class="content-pre">${esc(JSON.stringify(value, null, 2))}</pre>`;
  return esc(String(value));
}

function renderMarkdownPreview(text) {
  const blocks = esc(text)
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  return `<div class="content-pre">${blocks}</div>`;
}

function copySelectedContent(space) {
  const file = space === 'questions' ? state.selectedQuestion : state.selectedWorkspace;
  if (!file) return;
  const content = file.text || (file.json ? JSON.stringify(file.json, null, 2) : file.url || '');
  navigator.clipboard.writeText(content);
}

function contentIcon(ext) {
  const normalized = (ext || '').toLowerCase();
  if (normalized === '.json') return '{}';
  if (['.md', '.txt'].includes(normalized)) return '¶';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(normalized)) return '▧';
  if (['.mp4', '.mov', '.m4v'].includes(normalized)) return '▶';
  return '□';
}

function contentMediaUrl(url) {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `${state.info?.url || ''}${url}`;
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function loadLogs() {
  setBusy('reloadLogsBtn', true);
  try {
    const res = await api.logs.list({ level: $('logLevel')?.value || 'all', query: $('logQuery')?.value || '', limit: 300 });
    if (res.ok === false) throw new Error(res.error || 'Load logs failed');
    state.logs = res.entries || [];
    setText('metricErrors', String(res.stats?.counts?.error || 0));
    renderLogs();
  } catch (error) {
    const message = errorMessage(error, 'Load logs failed');
    $('logList').innerHTML = `<div class="list empty">Load failed: ${esc(message)}</div>`;
    showNotice(`Logs failed: ${message}`, 'error');
  } finally {
    setBusy('reloadLogsBtn', false);
  }
}

function renderLogs() {
  const el = $('logList');
  if (!state.logs.length) {
    el.innerHTML = '<div class="list empty">No logs.</div>';
    return;
  }
  el.innerHTML = state.logs.slice(0, 300).map((entry) => `
    <div class="log-entry">
      <span>${esc(new Date(entry.time || Date.now()).toLocaleTimeString())}</span>
      <span class="${esc(entry.level)}">${esc(entry.level)}</span>
      <span>${esc(entry.scope || '')}: ${esc(entry.message || '')}</span>
    </div>
  `).join('');
}

async function clearLogs() {
  setBusy('clearLogsBtn', true);
  try {
    const res = await api.logs.clear();
    if (res.ok === false) throw new Error(res.error || 'Clear logs failed');
    await loadLogs();
  } catch (error) {
    showNotice(`Clear logs failed: ${errorMessage(error)}`, 'error');
  } finally {
    setBusy('clearLogsBtn', false);
  }
}

async function loadAgentConfig() {
  try {
    const res = await api.agent.config();
    if (!res.ok) return;
    state.agentTools = res.tools || [];
    renderAgentTools();
  } catch (error) {
    state.agentTools = [];
    renderAgentTools();
    showNotice(`Agent config failed: ${errorMessage(error)}`, 'warning');
  }
}

function renderAgentTools() {
  $('agentToolStrip').innerHTML = state.agentTools.slice(0, 10).map((tool) => {
    const name = tool.function?.name || '';
    return `<button data-agent-tool="${esc(name)}">${esc(name.replace(/^nb_/, ''))}</button>`;
  }).join('');
  $('agentToolStrip').querySelectorAll('[data-agent-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('agentInput').value = `Hãy dùng tool ${btn.dataset.agentTool} để kiểm tra và tóm tắt kết quả.`;
      $('agentInput').focus();
    });
  });
}

async function sendAgentMessage() {
  const text = $('agentInput').value.trim();
  if (!text) return;
  $('agentInput').value = '';
  state.agentMessages.push({ role: 'user', content: text });
  renderAgentMessages();
  const history = state.agentMessages.filter((m) => ['user', 'assistant'].includes(m.role)).map((m) => ({ role: m.role, content: m.content }));
  state.agentMessages.push({ role: 'assistant', content: 'Running agent...', steps: [] });
  renderAgentMessages();
  const idx = state.agentMessages.length - 1;
  setBusy('agentSendBtn', true);
  try {
    const res = await api.agent.chat({ message: text, messages: history.slice(0, -1) });
    state.agentMessages[idx] = { role: 'assistant', content: res.content || res.error || pretty(res), steps: res.steps || [], context: res.context };
  } catch (error) {
    state.agentMessages[idx] = { role: 'assistant', content: `Agent failed: ${errorMessage(error)}`, steps: [] };
    showNotice(`Agent failed: ${errorMessage(error)}`, 'error');
  } finally {
    setBusy('agentSendBtn', false);
    renderAgentMessages();
  }
}

function appendAgentStep(step) {
  const last = state.agentMessages[state.agentMessages.length - 1];
  if (!last || last.role !== 'assistant') return;
  last.steps = [...(last.steps || []), step];
  renderAgentMessages();
}

function renderAgentMessages() {
  const el = $('agentMessages');
  if (!state.agentMessages.length) {
    el.innerHTML = '<div class="list empty">Agent ready. Thử: kiểm tra health NotebookLM.</div>';
    updateAgentContext();
    return;
  }
  el.innerHTML = state.agentMessages.map((msg) => `
    <div class="agent-msg ${esc(msg.role)}">
      <div class="agent-bubble">${esc(msg.content || '')}</div>
      ${(msg.steps || []).slice(-8).map((step) => `<div class="agent-step">${esc(step.type || 'step')} · ${esc(step.name || step.text || '')}<br>${esc(step.result ? JSON.stringify(step.result).slice(0, 800) : step.status || '')}</div>`).join('')}
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
  updateAgentContext();
}

function updateAgentContext() {
  const used = Math.ceil(JSON.stringify(state.agentMessages).length / 4);
  const limit = Number(state.settings?.agentContextLimit || 0);
  $('agentContextLabel').textContent = `Context ${used.toLocaleString()} / ${limit.toLocaleString()}`;
  $('agentContextBar').style.width = `${Math.min(100, limit ? used / limit * 100 : 0)}%`;
}

function copyAgentSession() {
  navigator.clipboard.writeText(state.agentMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n'));
}

function openVersionModal() {
  const info = state.info || {};
  const appInfo = info.appInfo || {};
  $('versionContent').textContent = [
    `${appInfo.productName || 'NotebookLM MCP Desktop'} v${appInfo.version || '0.0.0'}`,
    '',
    `Bridge: ${info.url || '—'}`,
    `MCP: ${info.mcp?.url || '—'}`,
    `Update repo: ${state.settings?.updateRepo || appInfo.updateRepo || 'not configured'}`,
    '',
    'Changelog:',
    appInfo.changelog || 'No changelog bundled.',
  ].join('\n');
  $('modalBackdrop').hidden = false;
}

async function checkUpdate() {
  $('versionContent').textContent = 'Checking update...';
  try {
    const res = await api.updates.check();
    state.diagnostics.update = res;
    $('versionContent').textContent = pretty(res);
  } catch (error) {
    const message = errorMessage(error, 'Update check failed');
    $('versionContent').textContent = pretty({ ok: false, error: message });
    showNotice(`Update check failed: ${message}`, 'error');
  }
}

function copyDiagnostics() {
  navigator.clipboard.writeText(pretty({
    info: state.info,
    settings: { ...state.settings, providerApiKey: undefined },
    diagnostics: state.diagnostics,
  }));
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

init().catch((error) => {
  $('loading').hidden = true;
  showNotice(`Startup failed: ${errorMessage(error)}`, 'error');
});
