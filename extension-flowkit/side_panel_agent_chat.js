// ── Agent Chat floating panel ───────────────────────────────

const AGENT_UI_STATE_KEY = 'fk_agent_ui_state';
const AGENT_SESSION_KEY = 'fk_agent_sessions';

const DEFAULT_AGENT_UI_SETTINGS = {
  baseUrl: 'http://127.0.0.1:20128/v1',
  apiKey: '',
  model: 'cx/gpt-5.5',
  maxLoops: 6,
  maxToolCallsPerLoop: 4,
  contextLimit: 128000,
  reservedResponseTokens: 4000,
  enableSearch: true,
  enableVectorMemory: true,
  codexBridgeUrl: 'http://127.0.0.1:8100/api/codex/run',
  notebookBridgeUrl: 'http://127.0.0.1:18931',
  notebookRequestTimeoutMs: 900000,
};

let agentOpen = false;
let agentBusy = false;
let agentTab = 'chat';
let agentMessages = [];
let agentSessions = [];
let agentSessionId = `session-${Date.now()}`;
let agentSettings = { ...DEFAULT_AGENT_UI_SETTINGS };
let agentPackagedSkills = [];
let agentMySkills = [];

function agentEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function agentEstimateTokens(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  return Math.ceil(text.length / 4) + 4;
}

function agentMarkdown(text) {
  const source = String(text || '');
  const blocks = [];
  let safe = agentEsc(source).replace(/```([\s\S]*?)```/g, (_, code) => {
    const id = `code-${blocks.length}`;
    blocks.push(`<pre class="agent-code"><button class="agent-copy-mini" data-copy-text="${agentEsc(code)}">Copy</button><code>${code}</code></pre>`);
    return `@@${id}@@`;
  });

  safe = safe
    .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="agent-inline-code">$1</code>')
    .replace(/^\s*[-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');

  safe = `<p>${safe}</p>`.replace(/<p>\s*<\/p>/g, '');
  blocks.forEach((html, i) => {
    safe = safe.replace(`@@code-${i}@@`, html);
  });
  return safe;
}

function agentSendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response' });
    });
  });
}

function agentCreateShell() {
  if (document.getElementById('agent-chat-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'agent-chat-fab';
  fab.type = 'button';
  fab.title = 'Open Agent Chat';
  fab.textContent = 'AI';
  document.body.appendChild(fab);

  const panel = document.createElement('section');
  panel.id = 'agent-chat-panel';
  panel.innerHTML = `
    <div class="agent-panel-head">
      <div>
        <div class="agent-title">Agent Chat</div>
        <div class="agent-subtitle">Tool loop · fk skills · context memory</div>
      </div>
      <div class="agent-head-actions">
        <button class="agent-icon-btn" id="agent-copy-session" type="button" title="Copy session">Copy</button>
        <button class="agent-icon-btn" id="agent-new-session" type="button" title="New session">New</button>
        <button class="agent-icon-btn" id="agent-close" type="button" title="Close">×</button>
      </div>
    </div>
    <div class="agent-skill-strip" id="agent-skill-strip"></div>
    <div class="agent-context-row">
      <span id="agent-context-text">Context 0 / 128000</span>
      <div class="agent-context-meter"><span id="agent-context-meter-fill"></span></div>
    </div>
    <div class="agent-tabs">
      <button class="agent-tab active" data-agent-tab="chat" type="button">Chat</button>
      <button class="agent-tab" data-agent-tab="settings" type="button">Settings</button>
      <button class="agent-tab" data-agent-tab="skills" type="button">Skills</button>
    </div>
    <div class="agent-tab-panel active" id="agent-tab-chat">
      <div class="agent-messages" id="agent-messages"></div>
      <div class="agent-input-row">
        <textarea id="agent-input" class="agent-input" rows="1" placeholder="Ask agent to act... Enter sends, Shift+Enter newline"></textarea>
        <button id="agent-send" class="agent-send" type="button">Send</button>
      </div>
    </div>
    <div class="agent-tab-panel" id="agent-tab-settings">
      <div class="agent-settings-grid">
        <label>Base URL<input id="agent-base-url" type="url" placeholder="OpenAI-compatible base URL"></label>
        <label>API Key<input id="agent-api-key" type="password" placeholder="Leave blank to keep saved key"></label>
        <label>Model<input id="agent-model" type="text" placeholder="model id"></label>
        <label>Context Limit<input id="agent-context-limit" type="number" min="2000" step="1000"></label>
        <label>Max Loops<input id="agent-max-loops" type="number" min="1" max="12"></label>
        <label>Tool Calls/Loop<input id="agent-max-tool-calls" type="number" min="1" max="8"></label>
        <label>Codex Bridge URL<input id="agent-codex-url" type="url" placeholder="http://127.0.0.1:8100/api/codex/run"></label>
        <label>NotebookLM Bridge<input id="agent-notebook-url" type="url" placeholder="http://127.0.0.1:18931"></label>
        <label>Notebook Timeout<input id="agent-notebook-timeout" type="number" min="15000" max="1200000" step="5000"></label>
        <label class="agent-check"><input id="agent-enable-search" type="checkbox"> Agent Search</label>
        <label class="agent-check"><input id="agent-enable-memory" type="checkbox"> Vector Memory</label>
      </div>
      <div class="agent-settings-actions">
        <button class="btn" id="agent-save-settings" type="button">Save</button>
        <button class="btn" id="agent-test-connection" type="button">Test connection</button>
        <button class="btn" id="agent-test-notebook" type="button">Test NotebookLM</button>
      </div>
      <div class="agent-status-line" id="agent-settings-status"></div>
    </div>
    <div class="agent-tab-panel" id="agent-tab-skills">
      <div class="agent-skill-create">
        <input id="agent-skill-name" type="text" placeholder="my-skill-name">
        <input id="agent-skill-goal" type="text" placeholder="Mục tiêu skill">
        <textarea id="agent-skill-steps" rows="3" placeholder="Các bước, mỗi dòng một bước"></textarea>
        <button class="btn btn-primary" id="agent-create-skill" type="button">Create Skill</button>
      </div>
      <div class="agent-skill-library">
        <div>
          <h4>My Skills</h4>
          <div id="agent-my-skills"></div>
        </div>
        <div>
          <h4>Community / Built-in</h4>
          <div id="agent-community-skills"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(panel);

  fab.addEventListener('click', () => setAgentOpen(!agentOpen));
  document.getElementById('agent-close').addEventListener('click', () => setAgentOpen(false));
  document.getElementById('agent-send').addEventListener('click', sendAgentChat);
  document.getElementById('agent-copy-session').addEventListener('click', copyAgentSession);
  document.getElementById('agent-new-session').addEventListener('click', newAgentSession);
  document.getElementById('agent-save-settings').addEventListener('click', saveAgentSettingsFromUi);
  document.getElementById('agent-test-connection').addEventListener('click', testAgentConnectionFromUi);
  document.getElementById('agent-test-notebook').addEventListener('click', testNotebookConnectionFromUi);
  document.getElementById('agent-create-skill').addEventListener('click', createAgentSkillFromUi);
  document.querySelectorAll('.agent-tab').forEach((btn) => {
    btn.addEventListener('click', () => setAgentTab(btn.dataset.agentTab));
  });
  document.getElementById('agent-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendAgentChat();
    }
  });
  document.getElementById('agent-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
  panel.addEventListener('click', async (event) => {
    const copyText = event.target?.getAttribute?.('data-copy-text');
    if (copyText != null) {
      await navigator.clipboard.writeText(copyText);
      const old = event.target.textContent;
      event.target.textContent = 'Copied';
      setTimeout(() => { event.target.textContent = old; }, 900);
    }
    const cmd = event.target?.getAttribute?.('data-agent-command');
    if (cmd) {
      setAgentTab('chat');
      const input = document.getElementById('agent-input');
      input.value = `${cmd} `;
      input.focus();
    }
  });
}

function setAgentOpen(open) {
  agentOpen = open;
  document.getElementById('agent-chat-panel')?.classList.toggle('open', open);
  document.getElementById('agent-chat-fab')?.classList.toggle('open', open);
}

function setAgentTab(tab) {
  agentTab = tab;
  document.querySelectorAll('.agent-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.agentTab === tab));
  document.querySelectorAll('.agent-tab-panel').forEach((panel) => panel.classList.remove('active'));
  document.getElementById(`agent-tab-${tab}`)?.classList.add('active');
}

function updateAgentContext() {
  const used = agentEstimateTokens(agentMessages.map((msg) => ({ role: msg.role, content: msg.content })));
  const limit = Number(agentSettings.contextLimit || DEFAULT_AGENT_UI_SETTINGS.contextLimit);
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const text = document.getElementById('agent-context-text');
  const fill = document.getElementById('agent-context-meter-fill');
  if (text) text.textContent = `Context ${used.toLocaleString()} / ${limit.toLocaleString()} tokens est.`;
  if (fill) {
    fill.style.width = `${pct}%`;
    fill.className = pct > 85 ? 'danger' : pct > 65 ? 'warn' : '';
  }
}

function renderAgentMessages() {
  const el = document.getElementById('agent-messages');
  if (!el) return;
  if (agentMessages.length === 0) {
    el.innerHTML = `
      <div class="agent-empty">
        <strong>Agent Chat</strong>
        <span>Nói tự nhiên để agent dùng tools. Thử /fk-runtime-status hoặc hỏi agent search.</span>
      </div>`;
    updateAgentContext();
    return;
  }

  el.innerHTML = agentMessages.map((msg, idx) => {
    if (msg.role === 'tool') return renderAgentToolMessage(msg, idx);
    const cls = msg.role === 'user' ? 'user' : msg.error ? 'error' : 'assistant';
    const title = msg.role === 'user' ? 'You' : msg.error ? 'Error' : 'Agent';
    const content = msg.role === 'assistant' ? agentMarkdown(msg.content || msg.error || '') : agentEsc(msg.content || msg.error || '');
    const context = msg.context ? `<div class="agent-msg-context">Context ${agentEsc(msg.context.estimatedTokens || 0)} / ${agentEsc(msg.context.contextLimit || '')} · memory ${agentEsc(msg.context.memoryHits || 0)} · compacted ${msg.context.compacted ? 'yes' : 'no'}</div>` : '';
    const thinking = msg.steps?.length ? renderAgentSteps(msg.steps) : '';
    return `<article class="agent-msg ${cls}">
      <div class="agent-msg-head">
        <span>${agentEsc(title)}</span>
        <button class="agent-copy-mini" data-copy-text="${agentEsc(msg.content || msg.error || '')}" type="button">Copy</button>
      </div>
      <div class="agent-bubble">${content}</div>
      ${context}
      ${thinking}
    </article>`;
  }).join('');
  el.querySelectorAll('.agent-step-toggle').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.agent-steps')?.classList.toggle('open'));
  });
  el.scrollTop = el.scrollHeight;
  updateAgentContext();
}

function renderAgentSteps(steps) {
  const count = steps.length;
  const lines = steps.map((step) => {
    if (step.type === 'tool') {
      return `<div class="agent-step ${step.status}">
        <div class="agent-step-title">${agentEsc(step.name)} <span>${agentEsc(step.status)}</span></div>
        <details>
          <summary>Input</summary>
          <pre>${agentEsc(JSON.stringify(step.input || {}, null, 2))}</pre>
        </details>
        <details>
          <summary>Result</summary>
          <pre>${agentEsc(JSON.stringify(step.result || {}, null, 2))}</pre>
        </details>
      </div>`;
    }
    return `<div class="agent-step ${agentEsc(step.status || '')}">
      <div class="agent-step-title">Thinking step <span>${agentEsc(step.status || '')}</span></div>
      <p>${agentEsc(step.text || '')}</p>
    </div>`;
  }).join('');
  return `<div class="agent-steps">
    <button class="agent-step-toggle" type="button">Thinking & steps (${count})</button>
    <div class="agent-step-list">${lines}</div>
  </div>`;
}

function renderAgentToolMessage(msg, idx) {
  return `<article class="agent-msg tool">
    <div class="agent-msg-head">
      <span>Tool: ${agentEsc(msg.name || 'unknown')}</span>
      <button class="agent-copy-mini" data-copy-text="${agentEsc(JSON.stringify(msg.result || {}, null, 2))}" type="button">Copy</button>
    </div>
    <div class="agent-tool-grid">
      <details open><summary>Input</summary><pre>${agentEsc(JSON.stringify(msg.input || {}, null, 2))}</pre></details>
      <details open><summary>Result</summary><pre>${agentEsc(JSON.stringify(msg.result || {}, null, 2))}</pre></details>
    </div>
  </article>`;
}

function renderAgentSkills() {
  const strip = document.getElementById('agent-skill-strip');
  if (strip) {
    const suggestions = [...agentPackagedSkills.slice(0, 6), ...agentMySkills.slice(0, 3)];
    strip.innerHTML = suggestions.map((skill) => {
      const cmd = skill.command || `/${skill.name}`;
      return `<button type="button" data-agent-command="${agentEsc(cmd)}">${agentEsc(cmd)}</button>`;
    }).join('');
  }
  const my = document.getElementById('agent-my-skills');
  if (my) {
    my.innerHTML = agentMySkills.length
      ? agentMySkills.map((skill) => `<button type="button" data-agent-command="${agentEsc(skill.command)}">${agentEsc(skill.command)}<span>${agentEsc(skill.goal || '')}</span></button>`).join('')
      : '<div class="agent-skill-empty">No custom skills yet.</div>';
  }
  const community = document.getElementById('agent-community-skills');
  if (community) {
    community.innerHTML = agentPackagedSkills.map((skill) => `<button type="button" data-agent-command="${agentEsc(skill.command)}">${agentEsc(skill.command)}<span>${agentEsc(skill.summary || '')}</span></button>`).join('');
  }
}

async function loadAgentSettings() {
  const resp = await agentSendMessage('AGENT_SETTINGS_GET');
  if (resp.ok && resp.settings) {
    agentSettings = { ...DEFAULT_AGENT_UI_SETTINGS, ...resp.settings };
  }
  hydrateAgentSettingsUi();
}

function hydrateAgentSettingsUi() {
  const fields = {
    'agent-base-url': agentSettings.baseUrl,
    'agent-model': agentSettings.model,
    'agent-context-limit': agentSettings.contextLimit,
    'agent-max-loops': agentSettings.maxLoops,
    'agent-max-tool-calls': agentSettings.maxToolCallsPerLoop,
    'agent-codex-url': agentSettings.codexBridgeUrl,
    'agent-notebook-url': agentSettings.notebookBridgeUrl,
    'agent-notebook-timeout': agentSettings.notebookRequestTimeoutMs,
  };
  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  });
  const key = document.getElementById('agent-api-key');
  if (key) {
    key.value = '';
    key.placeholder = agentSettings.apiKey === '[configured]' ? 'Saved key configured' : 'Paste API key';
  }
  const search = document.getElementById('agent-enable-search');
  const memory = document.getElementById('agent-enable-memory');
  if (search) search.checked = Boolean(agentSettings.enableSearch);
  if (memory) memory.checked = Boolean(agentSettings.enableVectorMemory);
  updateAgentContext();
}

function collectAgentSettingsFromUi() {
  const apiKey = document.getElementById('agent-api-key')?.value || '';
  const patch = {
    baseUrl: document.getElementById('agent-base-url')?.value || DEFAULT_AGENT_UI_SETTINGS.baseUrl,
    model: document.getElementById('agent-model')?.value || DEFAULT_AGENT_UI_SETTINGS.model,
    contextLimit: Number(document.getElementById('agent-context-limit')?.value || DEFAULT_AGENT_UI_SETTINGS.contextLimit),
    maxLoops: Number(document.getElementById('agent-max-loops')?.value || DEFAULT_AGENT_UI_SETTINGS.maxLoops),
    maxToolCallsPerLoop: Number(document.getElementById('agent-max-tool-calls')?.value || DEFAULT_AGENT_UI_SETTINGS.maxToolCallsPerLoop),
    codexBridgeUrl: document.getElementById('agent-codex-url')?.value || DEFAULT_AGENT_UI_SETTINGS.codexBridgeUrl,
    notebookBridgeUrl: document.getElementById('agent-notebook-url')?.value || DEFAULT_AGENT_UI_SETTINGS.notebookBridgeUrl,
    notebookRequestTimeoutMs: Number(document.getElementById('agent-notebook-timeout')?.value || DEFAULT_AGENT_UI_SETTINGS.notebookRequestTimeoutMs),
    enableSearch: Boolean(document.getElementById('agent-enable-search')?.checked),
    enableVectorMemory: Boolean(document.getElementById('agent-enable-memory')?.checked),
  };
  if (apiKey.trim()) patch.apiKey = apiKey.trim();
  return patch;
}

function setAgentStatus(message, tone = '') {
  const el = document.getElementById('agent-settings-status');
  if (!el) return;
  el.textContent = message || '';
  el.className = `agent-status-line ${tone}`;
}

async function saveAgentSettingsFromUi() {
  const resp = await agentSendMessage('AGENT_SETTINGS_SAVE', { settings: collectAgentSettingsFromUi() });
  if (resp.ok) {
    agentSettings = { ...agentSettings, ...resp.settings };
    setAgentStatus('Agent settings saved.', 'ok');
    hydrateAgentSettingsUi();
  } else {
    setAgentStatus(`Save failed: ${resp.error}`, 'bad');
  }
}

async function testAgentConnectionFromUi() {
  setAgentStatus('Testing /models...', '');
  const resp = await agentSendMessage('AGENT_CONNECTION_TEST', { settings: collectAgentSettingsFromUi() });
  if (resp.ok) {
    setAgentStatus(`Connected. ${resp.models?.length || 0} model(s).`, 'ok');
  } else {
    setAgentStatus(`Test failed: ${resp.error}`, 'bad');
  }
}

async function testNotebookConnectionFromUi() {
  const btn = document.getElementById('agent-test-notebook');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Testing...';
  }
  setAgentStatus('Running NotebookLM doctor...', '');
  const resp = await agentSendMessage('AGENT_NOTEBOOK_TEST', { settings: collectAgentSettingsFromUi() });
  const doctor = resp.result?.result || resp.result || null;
  if (resp.ok || doctor) {
    const status = doctor?.status || (resp.ok ? 'ready' : 'blocked');
    const summary = doctor?.summary || resp.error || 'NotebookLM bridge responded.';
    setAgentStatus(`NotebookLM ${status}: ${summary}`, resp.ok && status === 'ready' ? 'ok' : '');
  } else {
    setAgentStatus(`NotebookLM test failed: ${resp.error || resp.result?.error || 'Bridge unavailable'}`, 'bad');
  }
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Test NotebookLM';
  }
}

async function loadAgentSkills() {
  const resp = await agentSendMessage('AGENT_SKILLS_LIST');
  if (resp.ok) {
    agentPackagedSkills = resp.packaged || [];
    agentMySkills = resp.mySkills || [];
    renderAgentSkills();
  }
}

async function createAgentSkillFromUi() {
  const name = document.getElementById('agent-skill-name')?.value.trim();
  const goal = document.getElementById('agent-skill-goal')?.value.trim();
  const steps = (document.getElementById('agent-skill-steps')?.value || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (!name || !goal || steps.length === 0) return;
  const commandName = name.startsWith('fk-') ? name : `fk-${name.replace(/^\/+/, '')}`;
  const resp = await agentSendMessage('AGENT_SKILL_CREATE', {
    skill: {
      name: commandName,
      command: `/${commandName}`,
      goal,
      steps,
      toolsAllowed: ['fk_runtime_status', 'fk_request_log', 'fk_agent_search'],
      outputFormat: 'Trả lời ngắn gọn, có kết quả và next step.',
      guardrails: ['Không ghi secret.', 'Chỉ gọi tool cần thiết.'],
    },
  });
  if (resp.ok) {
    document.getElementById('agent-skill-name').value = '';
    document.getElementById('agent-skill-goal').value = '';
    document.getElementById('agent-skill-steps').value = '';
    await loadAgentSkills();
    setAgentTab('skills');
  }
}

async function sendAgentChat() {
  const input = document.getElementById('agent-input');
  const send = document.getElementById('agent-send');
  const text = input.value.trim();
  if (!text || agentBusy) return;

  agentMessages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  agentBusy = true;
  send.disabled = true;
  agentMessages.push({ role: 'assistant', content: 'Đang chạy agent...', steps: [{ type: 'thinking', status: 'running', text: 'Đang gọi LLM và chuẩn bị tool loop.' }] });
  renderAgentMessages();

  const placeholderIndex = agentMessages.length - 1;
  const history = agentMessages
    .filter((msg, idx) => idx !== placeholderIndex && (msg.role === 'user' || msg.role === 'assistant') && msg.content)
    .map((msg) => ({ role: msg.role, content: msg.content }));

  const resp = await agentSendMessage('AGENT_CHAT_RUN', {
    payload: {
      sessionId: agentSessionId,
      userText: text,
      messages: history,
    },
  });

  if (resp.ok) {
    agentMessages[placeholderIndex] = {
      role: 'assistant',
      content: resp.final || '',
      steps: resp.steps || [],
      context: resp.context || null,
    };
  } else {
    agentMessages[placeholderIndex] = {
      role: 'assistant',
      error: resp.error || 'Agent failed',
      content: '',
      steps: [{ type: 'thinking', status: 'error', text: resp.error || 'Agent failed' }],
    };
  }
  agentBusy = false;
  send.disabled = false;
  renderAgentMessages();
  persistAgentSession();
}

async function copyAgentSession() {
  const text = agentMessages.map((msg) => `${msg.role.toUpperCase()}: ${msg.content || msg.error || ''}`).join('\n\n');
  await navigator.clipboard.writeText(text);
}

function newAgentSession() {
  persistAgentSession();
  agentSessionId = `session-${Date.now()}`;
  agentMessages = [];
  renderAgentMessages();
}

async function persistAgentSession() {
  const current = {
    id: agentSessionId,
    updatedAt: new Date().toISOString(),
    messages: agentMessages,
  };
  const next = [current, ...agentSessions.filter((item) => item.id !== agentSessionId)].slice(0, 12);
  agentSessions = next;
  await chrome.storage.local.set({ [AGENT_SESSION_KEY]: next });
}

async function loadAgentSessions() {
  const data = await chrome.storage.local.get([AGENT_SESSION_KEY, AGENT_UI_STATE_KEY]);
  agentSessions = Array.isArray(data[AGENT_SESSION_KEY]) ? data[AGENT_SESSION_KEY] : [];
  const latest = agentSessions[0];
  if (latest) {
    agentSessionId = latest.id;
    agentMessages = Array.isArray(latest.messages) ? latest.messages : [];
  }
  agentOpen = Boolean(data[AGENT_UI_STATE_KEY]?.open);
  setAgentOpen(agentOpen);
}

document.addEventListener('DOMContentLoaded', async () => {
  agentCreateShell();
  await loadAgentSettings();
  await loadAgentSkills();
  await loadAgentSessions();
  renderAgentMessages();
});

window.addEventListener('beforeunload', () => {
  chrome.storage.local.set({ [AGENT_UI_STATE_KEY]: { open: agentOpen } });
  persistAgentSession();
});
