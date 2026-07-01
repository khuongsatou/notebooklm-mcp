// Agent Chat background runtime.
// Runs OpenAI-compatible tool loops and executes a narrow internal tool registry.

const AGENT_SETTINGS_KEY = 'fk_agent_settings';
const AGENT_MY_SKILLS_KEY = 'fk_agent_my_skills';
const AGENT_MEMORY_KEY = 'fk_agent_memory';

const DEFAULT_AGENT_SETTINGS = {
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

function agentLocalApiBase() {
  return 'http://127.0.0.1:8100';
}

const PACKAGED_AGENT_SKILLS = [
  {
    name: 'fk-runtime-status',
    command: '/fk-runtime-status',
    file: 'skills/fk-runtime-status.md',
    summary: 'Kiểm tra trạng thái runtime, token, queue/log và lỗi gần nhất.',
    handler: 'fk_runtime_status',
  },
  {
    name: 'fk-notebooklm-connect',
    command: '/fk-notebooklm-connect',
    file: 'skills/fk-notebooklm-connect.md',
    summary: 'Chẩn đoán kết nối NotebookLM bridge, auth, notebook target và session capacity.',
    handler: 'fk_notebook_doctor',
  },
  {
    name: 'fk-runtime-start-stop',
    command: '/fk-runtime-start-stop',
    file: 'skills/fk-runtime-start-stop.md',
    summary: 'Start, stop hoặc restart runtime bridge an toàn.',
    handler: 'fk_runtime_start_stop',
  },
  {
    name: 'fk-chat-send',
    command: '/fk-chat-send',
    file: 'skills/fk-chat-send.md',
    summary: 'Gửi message vào manual/companion chat pipeline nếu backend hỗ trợ.',
    handler: 'fk_chat_send',
  },
  {
    name: 'fk-speech-test',
    command: '/fk-speech-test',
    file: 'skills/fk-speech-test.md',
    summary: 'Kiểm tra voice/TTS hoặc audio queue thông qua local bridge.',
    handler: 'fk_bridge_request',
  },
  {
    name: 'fk-avatar-control',
    command: '/fk-avatar-control',
    file: 'skills/fk-avatar-control.md',
    summary: 'Điều khiển overlay/avatar/speech bubble nếu local bridge hỗ trợ.',
    handler: 'fk_bridge_request',
  },
  {
    name: 'fk-music-control',
    command: '/fk-music-control',
    file: 'skills/fk-music-control.md',
    summary: 'List/start/stop background music nếu local bridge hỗ trợ.',
    handler: 'fk_bridge_request',
  },
  {
    name: 'fk-config-update',
    command: '/fk-config-update',
    file: 'skills/fk-config-update.md',
    summary: 'Đọc/cập nhật config không chứa secret.',
    handler: 'fk_provider_check',
  },
  {
    name: 'fk-logs-debug',
    command: '/fk-logs-debug',
    file: 'skills/fk-logs-debug.md',
    summary: 'Đọc request log, tóm tắt lỗi và đề xuất hướng fix.',
    handler: 'fk_request_log',
  },
  {
    name: 'fk-provider-check',
    command: '/fk-provider-check',
    file: 'skills/fk-provider-check.md',
    summary: 'Kiểm tra provider/model/base URL/config hiện tại.',
    handler: 'fk_provider_check',
  },
  {
    name: 'fk-release-qa',
    command: '/fk-release-qa',
    file: 'skills/fk-release-qa.md',
    summary: 'Chạy checklist QA phù hợp và báo cáo pass/fail.',
    handler: 'fk_release_qa',
  },
];

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fk_runtime_status',
      description: 'Get current extension/runtime status, token presence, metrics and recent error.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_notebook_status',
      description: 'Check the local NotebookLM desktop bridge status and health without exposing tokens.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_notebook_doctor',
      description: 'Run NotebookLM bridge diagnostics for auth, selected notebook, session capacity and recent logs.',
      parameters: {
        type: 'object',
        properties: {
          include_logs: { type: 'boolean' },
          log_query: { type: 'string' },
          log_limit: { type: 'number', minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_notebook_ask_safe',
      description: 'Ask NotebookLM through the local bridge using preflight diagnostics, classified failures and one safe retry.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', minLength: 1 },
          notebook_id: { type: 'string' },
          notebook_url: { type: 'string' },
          session_id: { type: 'string' },
          source_format: { type: 'string', enum: ['none', 'inline', 'footnotes', 'json'] },
          show_browser: { type: 'boolean' },
          retry: { type: 'boolean' },
        },
        required: ['question'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_notebook_add_source',
      description: 'Add a URL or text source to NotebookLM through the local bridge after connection preflight.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['url', 'text'] },
          content: { type: 'string', minLength: 1 },
          title: { type: 'string' },
          notebook_id: { type: 'string' },
          notebook_url: { type: 'string' },
        },
        required: ['type', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_runtime_start_stop',
      description: 'Start, stop, restart, or inspect the local runtime bridge.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['status', 'start', 'stop', 'restart'] },
        },
        required: ['action'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_request_log',
      description: 'Read or clear the extension request log.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['read', 'clear'] },
          limit: { type: 'number', minimum: 1, maximum: 30 },
        },
        required: ['action'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_open_notebooklm',
      description: 'Open NotebookLM in a browser tab.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_refresh_token',
      description: 'Trigger NotebookLM token refresh by reloading/opening a NotebookLM tab.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_provider_check',
      description: 'Inspect Agent Chat provider/model/context/Codex bridge config without exposing API keys.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_agent_search',
      description: 'Search the web for current/public information using a lightweight search endpoint.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 2 },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_codex_prompt',
      description: 'Send a prompt to a local Codex CLI bridge endpoint. The bridge must be configured/running locally.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', minLength: 1 },
          mode: { type: 'string', enum: ['ask', 'fix', 'review', 'retry'] },
          retry: { type: 'boolean' },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_create_skill',
      description: 'Create a user skill in the local My Skills library when no existing skill fits the request.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 3 },
          command: { type: 'string', minLength: 4 },
          goal: { type: 'string', minLength: 3 },
          toolsAllowed: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          outputFormat: { type: 'string' },
          guardrails: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'command', 'goal', 'steps'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_list_skills',
      description: 'List packaged skills and user-created My Skills.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_bridge_request',
      description: 'Call a local MCP ML backend endpoint for narrow internal actions not directly implemented by the extension.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', minLength: 1 },
          method: { type: 'string', enum: ['GET', 'POST'] },
          body: { type: 'object' },
        },
        required: ['path', 'method'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_release_qa',
      description: 'Run a lightweight release QA checklist for extension runtime, provider config, skills, and logs.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fk_chat_send',
      description: 'Send a message to the existing backend manual chat endpoint when available.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', minLength: 1 },
          model: { type: 'string' },
        },
        required: ['message'],
        additionalProperties: false,
      },
    },
  },
];

function agentEstimateTokens(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  return Math.ceil(text.length / 4) + 4;
}

function agentNormalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_AGENT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
}

function agentSafeError(error) {
  const message = error?.message || String(error || 'Unknown error');
  return redactAgentSecrets(message);
}

function redactAgentSecrets(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [redacted]')
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, 'ya29.[redacted]')
    .replace(/(__Secure-next-auth\.session-token=)[^;\s]+/g, '$1[redacted]')
    .replace(/(__Host-next-auth\.csrf-token=)[^;\s]+/g, '$1[redacted]');
}

async function getAgentSettings() {
  const data = await chrome.storage.local.get([AGENT_SETTINGS_KEY]);
  return { ...DEFAULT_AGENT_SETTINGS, ...(data[AGENT_SETTINGS_KEY] || {}) };
}

async function saveAgentSettings(nextSettings) {
  const current = await getAgentSettings();
  const patch = { ...(nextSettings || {}) };
  if (!Object.prototype.hasOwnProperty.call(patch, 'apiKey') || patch.apiKey === '[configured]') {
    patch.apiKey = current.apiKey || '';
  }
  const safe = { ...DEFAULT_AGENT_SETTINGS, ...current, ...patch };
  await chrome.storage.local.set({ [AGENT_SETTINGS_KEY]: safe });
  return { ...safe, apiKey: safe.apiKey ? '[configured]' : '' };
}

function agentNormalizeLocalHttpUrl(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const local = host === '127.0.0.1' || host === 'localhost' || host === '::1';
    if (url.protocol === 'http:' && local) return url.toString().replace(/\/+$/, '');
  } catch {
    // Fall through to the fallback.
  }
  return String(fallback || DEFAULT_AGENT_SETTINGS.notebookBridgeUrl).replace(/\/+$/, '');
}

function agentNotebookBridgeBase(settings) {
  return agentNormalizeLocalHttpUrl(settings.notebookBridgeUrl, DEFAULT_AGENT_SETTINGS.notebookBridgeUrl);
}

function agentNotebookTimeout(settings, floorMs = 15000) {
  const value = Number(settings.notebookRequestTimeoutMs || DEFAULT_AGENT_SETTINGS.notebookRequestTimeoutMs);
  if (!Number.isFinite(value)) return DEFAULT_AGENT_SETTINGS.notebookRequestTimeoutMs;
  return Math.max(floorMs, Math.min(Math.round(value), 1200000));
}

async function agentFetchJson(url, {
  method = 'GET',
  body,
  timeoutMs = 30000,
  retries = 1,
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
        cache: 'no-store',
        signal: controller.signal,
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text || '{}'); } catch { data = { text: redactAgentSecrets(text) }; }
      data = redactNotebookPayload(data);
      if (!resp.ok) {
        lastError = new Error(data.error || data.message || `HTTP ${resp.status}`);
        if (resp.status >= 500 && attempt < retries) {
          await sleep(350 * (attempt + 1));
          continue;
        }
        return { ok: false, status: resp.status, error: agentSafeError(lastError), result: data };
      }
      return { ok: true, status: resp.status, result: data };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(350 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, error: agentSafeError(lastError || 'Request failed') };
}

function redactNotebookPayload(value) {
  if (typeof value === 'string') return redactAgentSecrets(value);
  if (Array.isArray(value)) return value.map((item) => redactNotebookPayload(item));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.entries(value).forEach(([key, item]) => {
    if (/token|cookie|authorization|api[-_]?key|secret/i.test(key)) {
      out[key] = item ? '[redacted]' : item;
      return;
    }
    out[key] = redactNotebookPayload(item);
  });
  return out;
}

function agentHeaders(settings) {
  const headers = { 'Content-Type': 'application/json' };
  const key = String(settings.apiKey || '').trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers['x-api-key'] = key;
  }
  return headers;
}

function agentToolNames() {
  return new Set(AGENT_TOOLS.map((tool) => tool.function.name));
}

function agentValidateToolCall(name, args) {
  if (!agentToolNames().has(name)) throw new Error(`Tool not allowed: ${name}`);
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error(`Invalid input for ${name}`);
  }
  return args;
}

function agentParseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  return JSON.parse(String(raw));
}

async function getMySkills() {
  const data = await chrome.storage.local.get([AGENT_MY_SKILLS_KEY]);
  return Array.isArray(data[AGENT_MY_SKILLS_KEY]) ? data[AGENT_MY_SKILLS_KEY] : [];
}

async function saveMySkill(skill) {
  const skills = await getMySkills();
  const command = String(skill.command || '').trim().replace(/^\/?/, '/');
  const normalized = {
    id: `my-${Date.now()}`,
    name: String(skill.name || command.replace(/^\//, '')).trim(),
    command,
    goal: String(skill.goal || '').trim(),
    toolsAllowed: Array.isArray(skill.toolsAllowed) ? skill.toolsAllowed : [],
    steps: Array.isArray(skill.steps) ? skill.steps : [],
    outputFormat: String(skill.outputFormat || 'Tóm tắt kết quả ngắn gọn, có trạng thái và next step.'),
    guardrails: Array.isArray(skill.guardrails) ? skill.guardrails : [],
    createdAt: new Date().toISOString(),
    source: 'my-skills',
  };
  const next = [normalized, ...skills.filter((item) => item.command !== normalized.command)].slice(0, 60);
  await chrome.storage.local.set({ [AGENT_MY_SKILLS_KEY]: next });
  return normalized;
}

async function loadPackagedSkillMarkdown(skillName) {
  const skill = PACKAGED_AGENT_SKILLS.find((item) => item.name === skillName || item.command === skillName);
  if (!skill?.file) return '';
  try {
    const resp = await fetch(chrome.runtime.getURL(skill.file));
    if (!resp.ok) return '';
    return await resp.text();
  } catch {
    return '';
  }
}

function detectAgentCommand(text) {
  const match = String(text || '').trim().match(/^\/([\w-]+)/);
  if (!match) return null;
  const name = match[1];
  return PACKAGED_AGENT_SKILLS.find((skill) => skill.name === name || skill.command === `/${name}`) || {
    name,
    command: `/${name}`,
    summary: 'User-created or unknown command.',
  };
}

function buildSkillSummary(skills) {
  return skills.map((skill) => `- ${skill.command || `/${skill.name}`}: ${skill.summary || skill.goal || 'custom skill'}`).join('\n');
}

function hashEmbedding(text, size = 64) {
  const vector = new Array(size).fill(0);
  const words = String(text || '').toLowerCase().match(/[a-z0-9_\-\u00C0-\u1EF9]{2,}/g) || [];
  words.forEach((word) => {
    let hash = 2166136261;
    for (let i = 0; i < word.length; i += 1) {
      hash ^= word.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    vector[Math.abs(hash) % size] += 1;
  });
  const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0)) || 1;
  return vector.map((n) => Number((n / norm).toFixed(5)));
}

function cosine(a, b) {
  return a.reduce((sum, n, i) => sum + n * (b[i] || 0), 0);
}

async function addAgentMemory(sessionId, text) {
  if (!text || text.length < 20) return;
  const data = await chrome.storage.local.get([AGENT_MEMORY_KEY]);
  const memory = Array.isArray(data[AGENT_MEMORY_KEY]) ? data[AGENT_MEMORY_KEY] : [];
  memory.unshift({
    id: `mem-${Date.now()}`,
    sessionId: sessionId || 'default',
    text: String(text).slice(0, 1400),
    embedding: hashEmbedding(text),
    createdAt: new Date().toISOString(),
  });
  await chrome.storage.local.set({ [AGENT_MEMORY_KEY]: memory.slice(0, 200) });
}

async function retrieveAgentMemory(query, limit = 4) {
  const data = await chrome.storage.local.get([AGENT_MEMORY_KEY]);
  const memory = Array.isArray(data[AGENT_MEMORY_KEY]) ? data[AGENT_MEMORY_KEY] : [];
  const q = hashEmbedding(query);
  return memory
    .map((item) => ({ ...item, score: cosine(q, item.embedding || []) }))
    .filter((item) => item.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function compactMessagesForContext(messages, settings) {
  const limit = Number(settings.contextLimit || DEFAULT_AGENT_SETTINGS.contextLimit);
  const reserved = Number(settings.reservedResponseTokens || DEFAULT_AGENT_SETTINGS.reservedResponseTokens);
  const budget = Math.max(2000, limit - reserved);
  const estimatedBefore = agentEstimateTokens(messages);
  if (estimatedBefore <= budget) {
    return { messages, estimatedBefore, estimatedAfter: estimatedBefore, summary: '' };
  }

  const keep = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const cost = agentEstimateTokens(msg);
    if (total + cost > Math.floor(budget * 0.72)) break;
    keep.unshift(msg);
    total += cost;
  }
  const dropped = messages.slice(0, Math.max(0, messages.length - keep.length));
  const summary = dropped
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => `${msg.role}: ${String(msg.content || '').replace(/\s+/g, ' ').slice(0, 220)}`)
    .slice(-12)
    .join('\n');
  const summaryMessage = {
    role: 'system',
    content: `Context summary from older chat turns. Use only as background, not as verified tool result.\n${summary}`,
  };
  const compacted = [summaryMessage, ...keep];
  return {
    messages: compacted,
    estimatedBefore,
    estimatedAfter: agentEstimateTokens(compacted),
    summary,
  };
}

function buildAgentSystemPrompt({ skillMarkdown, skillSummary, memorySnippets }) {
  return [
    'Bạn là Agent Chat điều khiển app bằng tools nội bộ.',
    'Khi user yêu cầu hành động và đủ thông tin, hãy gọi tool phù hợp thay vì chỉ mô tả.',
    'Dùng tool hẹp nhất và an toàn nhất. Validate dữ liệu trước khi gọi tool.',
    'Không bịa tool result. Luôn đọc tool result trước khi kết luận.',
    'Nếu cần thông tin hiện tại và search được bật, dùng fk_agent_search.',
    'Khi user yêu cầu NotebookLM/NotebookML, kiểm tra kết nối bằng fk_notebook_doctor hoặc fk_notebook_status trước; dùng fk_notebook_ask_safe thay vì gọi ask thường.',
    'Không hiển thị token/cookie/secret từ NotebookLM bridge, kể cả khi tool trả về log.',
    'Nếu user yêu cầu sửa bug/retry bằng Codex, dùng fk_codex_prompt và báo rõ cần local Codex bridge đang chạy.',
    'Nếu chưa có skill phù hợp, có thể tạo skill bằng fk_create_skill rồi giải thích cách dùng command đó.',
    'Trả lời ngắn gọn theo ngôn ngữ của user.',
    'Sau khi tạo/cập nhật/chạy hành động, tóm tắt kết quả và ID/trạng thái quan trọng.',
    '',
    'Available skill commands:',
    skillSummary || '- Không có skill.',
    memorySnippets?.length ? `\nRelevant memory:\n${memorySnippets.map((m) => `- ${m.text}`).join('\n')}` : '',
    skillMarkdown ? `\nSelected skill workflow:\n${skillMarkdown}` : '',
  ].filter(Boolean).join('\n');
}

async function executeAgentTool(name, args, settings) {
  const input = agentValidateToolCall(name, args);

  if (name === 'fk_runtime_status') {
    return {
      state,
      connected: ws?.readyState === WebSocket.OPEN,
      flowKeyPresent: !!flowKey,
      tokenAgeMs: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
      metrics: {
        requestCount: metrics.requestCount,
        successCount: metrics.successCount,
        failedCount: metrics.failedCount,
        lastError: metrics.lastError || null,
      },
      requestLogCount: requestLog.length,
      notebookBridgeUrl: agentNotebookBridgeBase(settings),
    };
  }

  if (name === 'fk_notebook_status') {
    const base = agentNotebookBridgeBase(settings);
    const [info, health] = await Promise.all([
      agentFetchJson(`${base}/api/info`, { timeoutMs: 10000, retries: 1 }),
      agentFetchJson(`${base}/api/health`, { timeoutMs: 15000, retries: 1 }),
    ]);
    return {
      ok: info.ok && health.ok,
      bridgeUrl: base,
      info,
      health,
      tokenPresentInExtension: !!flowKey,
      extensionTokenAgeMs: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
    };
  }

  if (name === 'fk_notebook_doctor') {
    const base = agentNotebookBridgeBase(settings);
    const body = {
      include_logs: Boolean(input.include_logs),
      log_query: input.log_query || '',
      log_limit: Math.max(1, Math.min(Number(input.log_limit || 12), 50)),
    };
    const result = await agentFetchJson(`${base}/api/doctor`, {
      method: 'POST',
      body,
      timeoutMs: 30000,
      retries: 1,
    });
    return {
      ok: result.ok && result.result?.ok !== false,
      bridgeUrl: base,
      result,
      tokenPresentInExtension: !!flowKey,
      extensionTokenAgeMs: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
      nextStep: result.ok && result.result?.ok
        ? 'NotebookLM bridge is ready for ask-safe/add-source.'
        : 'Run MCP auth in the desktop bridge, select/pass a notebook, or start the bridge if unreachable.',
    };
  }

  if (name === 'fk_notebook_ask_safe') {
    const base = agentNotebookBridgeBase(settings);
    const result = await agentFetchJson(`${base}/api/ask-safe`, {
      method: 'POST',
      body: {
        ...input,
        retry: input.retry !== false,
        show_browser: input.show_browser !== false,
      },
      timeoutMs: agentNotebookTimeout(settings),
      retries: 0,
    });
    return {
      ok: result.ok && result.result?.ok !== false,
      bridgeUrl: base,
      result,
    };
  }

  if (name === 'fk_notebook_add_source') {
    const base = agentNotebookBridgeBase(settings);
    const preflight = await executeAgentTool('fk_notebook_doctor', {}, settings);
    if (!preflight.ok) {
      return {
        ok: false,
        error: 'NotebookLM preflight failed; source was not submitted.',
        preflight,
      };
    }
    const result = await agentFetchJson(`${base}/api/sources`, {
      method: 'POST',
      body: input,
      timeoutMs: agentNotebookTimeout(settings),
      retries: 0,
    });
    return {
      ok: result.ok && result.result?.ok !== false,
      bridgeUrl: base,
      preflight,
      result,
    };
  }

  if (name === 'fk_runtime_start_stop') {
    if (input.action === 'stop') {
      manualDisconnect = true;
      if (ws) ws.close();
      setState('off');
      return { ok: true, action: 'stop', state };
    }
    if (input.action === 'start' || input.action === 'restart') {
      restartAgentSocket(`Agent Chat ${input.action}`);
      return { ok: true, action: input.action, state: 'reconnecting' };
    }
    return executeAgentTool('fk_runtime_status', {}, settings);
  }

  if (name === 'fk_request_log') {
    if (input.action === 'clear') {
      clearRequestLog();
      return { ok: true, action: 'clear', count: requestLog.length };
    }
    const limit = Math.max(1, Math.min(Number(input.limit || 10), 30));
    return {
      ok: true,
      count: requestLog.length,
      entries: requestLog.slice(0, limit).map((entry) => ({
        id: entry.id,
        type: entry.type || entry.method,
        time: entry.time || entry.timestamp || entry.createdAt,
        status: entry.status || entry.state,
        httpStatus: entry.httpStatus,
        error: entry.error,
      })),
    };
  }

  if (name === 'fk_open_notebooklm') {
    const tab = await chrome.tabs.create({ url: NOTEBOOKLM_URL, active: true });
    return { ok: true, tabId: tab.id, url: NOTEBOOKLM_URL };
  }

  if (name === 'fk_refresh_token') {
    await captureTokenFromNotebookLMTab();
    return { ok: true, flowKeyPresent: !!flowKey, tokenAgeMs: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null };
  }

  if (name === 'fk_provider_check') {
    return {
      ok: true,
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey: settings.apiKey ? '[configured]' : '[missing]',
      maxLoops: settings.maxLoops,
      maxToolCallsPerLoop: settings.maxToolCallsPerLoop,
      contextLimit: settings.contextLimit,
      enableSearch: Boolean(settings.enableSearch),
      enableVectorMemory: Boolean(settings.enableVectorMemory),
      codexBridgeUrl: settings.codexBridgeUrl,
      notebookBridgeUrl: agentNotebookBridgeBase(settings),
      notebookRequestTimeoutMs: agentNotebookTimeout(settings),
    };
  }

  if (name === 'fk_agent_search') {
    if (!settings.enableSearch) return { ok: false, error: 'Agent Search is disabled in settings.' };
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Search failed HTTP ${resp.status}`);
    const data = await resp.json();
    const topics = [];
    (data.RelatedTopics || []).forEach((item) => {
      if (item.Text) topics.push({ text: item.Text, url: item.FirstURL });
      if (Array.isArray(item.Topics)) {
        item.Topics.forEach((nested) => {
          if (nested.Text) topics.push({ text: nested.Text, url: nested.FirstURL });
        });
      }
    });
    return {
      ok: true,
      query: input.query,
      heading: data.Heading || '',
      abstract: data.AbstractText || '',
      source: data.AbstractSource || 'DuckDuckGo',
      results: topics.slice(0, 6),
    };
  }

  if (name === 'fk_codex_prompt') {
    const url = String(settings.codexBridgeUrl || '').trim();
    if (!url) return { ok: false, error: 'Codex bridge URL is not configured.' };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: input.prompt,
        mode: input.mode || 'ask',
        retry: Boolean(input.retry),
      }),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text || '{}'); } catch { data = { text }; }
    if (!resp.ok) return { ok: false, status: resp.status, error: data.error || text || resp.statusText };
    return { ok: true, status: resp.status, result: data };
  }

  if (name === 'fk_create_skill') {
    const saved = await saveMySkill(input);
    return { ok: true, skill: saved };
  }

  if (name === 'fk_list_skills') {
    const mySkills = await getMySkills();
    return { ok: true, packaged: PACKAGED_AGENT_SKILLS, mySkills };
  }

  if (name === 'fk_bridge_request') {
    const path = String(input.path || '').replace(/^\/+/, '');
    const url = `${agentLocalApiBase()}/${path}`;
    const resp = await fetch(url, {
      method: input.method,
      headers: { 'Content-Type': 'application/json' },
      body: input.method === 'POST' ? JSON.stringify(input.body || {}) : undefined,
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text || '{}'); } catch { data = { text }; }
    return { ok: resp.ok, status: resp.status, result: data };
  }

  if (name === 'fk_release_qa') {
    const provider = await executeAgentTool('fk_provider_check', {}, settings);
    const runtime = await executeAgentTool('fk_runtime_status', {}, settings);
    const logs = await executeAgentTool('fk_request_log', { action: 'read', limit: 5 }, settings);
    return {
      ok: true,
      checks: [
        { name: 'Provider configured', pass: provider.apiKey === '[configured]' && Boolean(provider.model), evidence: provider },
        { name: 'Runtime status readable', pass: true, evidence: runtime },
        { name: 'Request log readable', pass: true, evidence: { count: logs.count, recentErrors: logs.entries.filter((e) => e.error).length } },
        { name: 'Packaged fk skills available', pass: PACKAGED_AGENT_SKILLS.length >= 10, evidence: { count: PACKAGED_AGENT_SKILLS.length } },
      ],
    };
  }

  if (name === 'fk_chat_send') {
    const resp = await fetch(`${agentLocalApiBase()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: input.message }],
        model: input.model || '',
      }),
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, result: data };
  }

  throw new Error(`Unhandled tool: ${name}`);
}

async function runDeterministicCommand(command, userText, settings) {
  if (!command?.handler) return null;
  const lower = String(userText || '').toLowerCase();
  let args = {};
  if (command.handler === 'fk_runtime_start_stop') {
    args.action = lower.includes('stop') ? 'stop' : lower.includes('restart') ? 'restart' : lower.includes('start') ? 'start' : 'status';
  } else if (command.handler === 'fk_request_log') {
    args = { action: lower.includes('clear') ? 'clear' : 'read', limit: 10 };
  } else if (command.handler === 'fk_chat_send') {
    args = { message: userText.replace(/^\/[\w-]+\s*/, '').trim() || userText };
  } else if (command.handler === 'fk_notebook_doctor') {
    args = {
      include_logs: lower.includes('log') || lower.includes('diagnose') || lower.includes('doctor'),
      log_limit: 12,
    };
  } else if (command.handler === 'fk_bridge_request') {
    return null;
  }
  const result = await executeAgentTool(command.handler, args, settings);
  return {
    final: `Đã chạy ${command.command}.\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
    steps: [{
      type: 'tool',
      name: command.handler,
      input: args,
      result,
      status: 'ok',
      deterministic: true,
    }],
  };
}

async function callAgentModel(settings, body) {
  const resp = await fetch(`${agentNormalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: agentHeaders(settings),
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text || '{}'); } catch { data = { raw: text }; }
  if (!resp.ok) {
    throw new Error(data.error?.message || data.error || `LLM HTTP ${resp.status}`);
  }
  return data;
}

async function runAgentChat(payload) {
  const settings = await getAgentSettings();
  const incomingMessages = Array.isArray(payload.messages) ? payload.messages : [];
  const userText = String(payload.userText || incomingMessages[incomingMessages.length - 1]?.content || '');
  const command = detectAgentCommand(userText);
  const skillMarkdown = command ? await loadPackagedSkillMarkdown(command.name) : '';
  const mySkills = await getMySkills();
  const memorySnippets = settings.enableVectorMemory ? await retrieveAgentMemory(userText) : [];
  const skillSummary = buildSkillSummary([...PACKAGED_AGENT_SKILLS, ...mySkills]);
  const systemPrompt = buildAgentSystemPrompt({ skillMarkdown, skillSummary, memorySnippets });
  const steps = [{
    type: 'thinking',
    status: 'started',
    text: 'Đã dựng context, skill hints và tool registry cho Agent Chat.',
  }];

  if (command?.handler) {
    const deterministic = await runDeterministicCommand(command, userText, settings);
    if (deterministic) {
      return {
        ok: true,
        final: deterministic.final,
        steps: [...steps, ...deterministic.steps],
        context: {
          estimatedTokens: agentEstimateTokens(incomingMessages),
          contextLimit: settings.contextLimit,
          compacted: false,
          memoryHits: memorySnippets.length,
        },
      };
    }
  }

  const initialMessages = [
    { role: 'system', content: systemPrompt },
    ...incomingMessages.map((msg) => ({ role: msg.role, content: String(msg.content || '') })).filter((msg) => msg.role && msg.content),
  ];
  const compacted = compactMessagesForContext(initialMessages, settings);
  const messages = compacted.messages;
  if (compacted.summary) {
    steps.push({
      type: 'context',
      status: 'compacted',
      text: 'Context vượt giới hạn nên đã nén các lượt cũ thành summary.',
      estimatedBefore: compacted.estimatedBefore,
      estimatedAfter: compacted.estimatedAfter,
    });
  }

  const maxLoops = Math.max(1, Math.min(Number(settings.maxLoops || 6), 12));
  const maxToolCallsPerLoop = Math.max(1, Math.min(Number(settings.maxToolCallsPerLoop || 4), 8));
  let final = '';

  for (let loop = 0; loop < maxLoops; loop += 1) {
    steps.push({ type: 'thinking', status: 'llm_call', text: `LLM pass ${loop + 1}/${maxLoops}` });
    const data = await callAgentModel(settings, {
      model: settings.model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
    });
    const message = data.choices?.[0]?.message || {};
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls.slice(0, maxToolCallsPerLoop) : [];
    messages.push({
      role: 'assistant',
      content: message.content || '',
      tool_calls: toolCalls.length ? toolCalls : undefined,
    });

    if (!toolCalls.length) {
      final = message.content || '';
      break;
    }

    for (const call of toolCalls) {
      const name = call.function?.name;
      let parsedArgs = {};
      const step = {
        type: 'tool',
        id: call.id,
        name,
        input: null,
        result: null,
        status: 'running',
      };
      try {
        parsedArgs = agentParseToolArgs(call.function?.arguments);
        step.input = parsedArgs;
        const result = await executeAgentTool(name, parsedArgs, settings);
        step.result = result;
        step.status = 'ok';
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 12000),
        });
      } catch (error) {
        const result = { ok: false, error: agentSafeError(error) };
        step.result = result;
        step.status = 'error';
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      steps.push(step);
    }
  }

  if (!final) {
    final = 'Agent đã dừng vì đạt giới hạn vòng lặp hoặc không nhận được final response rõ ràng.';
  }

  await addAgentMemory(payload.sessionId, `User: ${userText}\nAssistant: ${final}`);

  return {
    ok: true,
    final,
    steps,
    context: {
      estimatedTokens: compacted.estimatedAfter,
      estimatedBefore: compacted.estimatedBefore,
      contextLimit: settings.contextLimit,
      compacted: Boolean(compacted.summary),
      memoryHits: memorySnippets.length,
      maxLoops,
      maxToolCallsPerLoop,
    },
  };
}

async function testAgentConnection(settingsPatch = {}) {
  const settings = { ...(await getAgentSettings()), ...(settingsPatch || {}) };
  const resp = await fetch(`${agentNormalizeBaseUrl(settings.baseUrl)}/models`, {
    headers: agentHeaders(settings),
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text || '{}'); } catch { data = { raw: text }; }
  if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
  const models = Array.isArray(data.data)
    ? data.data.map((item) => item.id).filter(Boolean)
    : Array.isArray(data.models)
      ? data.models.map((item) => item.id || item.name || item.fullModel).filter(Boolean)
      : [];
  return { ok: true, models, configuredModel: settings.model };
}

async function testNotebookConnection(settingsPatch = {}) {
  const settings = { ...(await getAgentSettings()), ...(settingsPatch || {}) };
  return executeAgentTool('fk_notebook_doctor', { include_logs: false, log_limit: 8 }, settings);
}

chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg.type === 'AGENT_CHAT_RUN') {
    runAgentChat(msg.payload || {})
      .then((result) => reply(result))
      .catch((error) => reply({ ok: false, error: agentSafeError(error) }));
    return true;
  }

  if (msg.type === 'AGENT_SETTINGS_GET') {
    getAgentSettings()
      .then((settings) => reply({ ok: true, settings: { ...settings, apiKey: settings.apiKey ? '[configured]' : '' } }))
      .catch((error) => reply({ ok: false, error: agentSafeError(error) }));
    return true;
  }

  if (msg.type === 'AGENT_SETTINGS_SAVE') {
    saveAgentSettings(msg.settings || {})
      .then((settings) => reply({ ok: true, settings }))
      .catch((error) => reply({ ok: false, error: agentSafeError(error) }));
    return true;
  }

  if (msg.type === 'AGENT_CONNECTION_TEST') {
    testAgentConnection(msg.settings || {})
      .then((result) => reply(result))
      .catch((error) => reply({ ok: false, error: agentSafeError(error) }));
    return true;
  }

  if (msg.type === 'AGENT_NOTEBOOK_TEST') {
    testNotebookConnection(msg.settings || {})
      .then((result) => reply(result))
      .catch((error) => reply({ ok: false, error: agentSafeError(error) }));
    return true;
  }

  if (msg.type === 'AGENT_SKILLS_LIST') {
    getMySkills()
      .then((mySkills) => reply({ ok: true, packaged: PACKAGED_AGENT_SKILLS, mySkills }))
      .catch((error) => reply({ ok: false, error: agentSafeError(error) }));
    return true;
  }

  if (msg.type === 'AGENT_SKILL_CREATE') {
    saveMySkill(msg.skill || {})
      .then((skill) => reply({ ok: true, skill }))
      .catch((error) => reply({ ok: false, error: agentSafeError(error) }));
    return true;
  }

  return false;
});
