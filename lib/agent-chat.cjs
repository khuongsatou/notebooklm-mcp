'use strict';

const { buildNotebookAgentTools, executeNotebookAgentTool } = require('./agent-tools.cjs');
const { NotebookSafeRunner } = require('./notebook-safe-runner.cjs');

class AgentChatService {
  constructor({ settings, credentials, mcp, log, hub, update }) {
    this.settings = settings;
    this.credentials = credentials;
    this.mcp = mcp;
    this.log = log;
    this.hub = hub;
    this.update = update;
    this.safeRunner = new NotebookSafeRunner({ mcp, log, settings });
  }

  config() {
    const settings = this.settings.read();
    return {
      baseUrl: settings.providerBaseUrl,
      model: settings.providerModel,
      hasApiKey: Boolean(this.credentials.get('providerApiKey')),
      maxLoops: settings.agentMaxLoops,
      maxToolCalls: settings.agentMaxToolCalls,
      contextLimit: settings.agentContextLimit,
      searchEnabled: settings.agentSearchEnabled,
    };
  }

  listTools() {
    return buildNotebookAgentTools();
  }

  async testConnection(patch = {}) {
    const settings = { ...this.settings.read(), ...(patch || {}) };
    const key = patch.providerApiKey || this.credentials.get('providerApiKey');
    const resp = await fetch(`${normalizeBase(settings.providerBaseUrl)}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: data?.error?.message || `HTTP ${resp.status}` };
    const models = Array.isArray(data.data)
      ? data.data.map((item) => item.id).filter(Boolean)
      : Array.isArray(data.models)
        ? data.models.map((item) => item.id || item.name).filter(Boolean)
        : [];
    return { ok: true, modelCount: models.length, sampleModels: models.slice(0, 12) };
  }

  async chat({ messages = [], message = '' } = {}) {
    const settings = this.settings.read();
    const apiKey = this.credentials.get('providerApiKey');
    const tools = buildNotebookAgentTools();
    const contextMessages = compactMessages([
      {
        role: 'system',
        content: [
          'Bạn là Agent Chat điều khiển NotebookLM MCP desktop app bằng tools.',
          'Khi user yêu cầu hành động và đủ thông tin, hãy gọi tool thật, không chỉ mô tả.',
          'Dùng tool hẹp nhất và an toàn nhất. Không bịa tool result.',
          'Đọc tool result trước khi kết luận.',
          'Trả lời ngắn gọn theo ngôn ngữ của user, ưu tiên tiếng Việt nếu user dùng tiếng Việt.',
          'Không hiển thị API key/token/secret.',
        ].join('\n'),
      },
      ...messages.filter((item) => item.role && item.content).map((item) => ({
        role: item.role,
        content: String(item.content),
      })),
      ...(message ? [{ role: 'user', content: String(message) }] : []),
    ], settings.agentContextLimit);

    const steps = [];
    let final = '';
    for (let loop = 0; loop < settings.agentMaxLoops; loop += 1) {
      this.emitStep({ type: 'thinking', status: 'running', text: `LLM loop ${loop + 1}/${settings.agentMaxLoops}` });
      const assistant = await this.callProvider(settings, apiKey, {
        model: settings.providerModel,
        messages: contextMessages,
        tools,
        tool_choice: 'auto',
      });
      contextMessages.push(assistant);
      const toolCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls.slice(0, settings.agentMaxToolCalls) : [];
      this.emitStep({ type: 'thinking', status: 'done', text: `LLM loop ${loop + 1} returned ${toolCalls.length} tool call(s)` });
      if (!toolCalls.length) {
        final = assistant.content || '';
        break;
      }
      for (const call of toolCalls) {
        const name = call.function?.name || '';
        const input = parseArgs(call.function?.arguments);
        const step = { type: 'tool', name, input, status: 'running' };
        steps.push(step);
        this.emitStep(step);
        try {
          const result = await executeNotebookAgentTool(name, input, {
            mcp: this.mcp,
            settings: this.settings,
            log: this.log,
            update: this.update,
            safeRunner: this.safeRunner,
          });
          step.status = 'done';
          step.result = result;
          this.emitStep(step);
          contextMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify(result).slice(0, 20000),
          });
        } catch (error) {
          const result = { ok: false, error: error.message || String(error) };
          step.status = 'error';
          step.result = result;
          this.emitStep(step);
          contextMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify(result),
          });
        }
      }
    }
    if (!final) final = 'Agent đã dừng vì đạt giới hạn vòng lặp. Hãy xem tool steps để tiếp tục.';
    return {
      ok: true,
      content: final,
      steps,
      context: {
        estimatedTokens: estimateTokens(contextMessages),
        limit: settings.agentContextLimit,
      },
    };
  }

  async callProvider(settings, apiKey, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const resp = await fetch(`${normalizeBase(settings.providerBaseUrl)}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error?.message || data?.error || `Provider HTTP ${resp.status}`);
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('Provider returned no assistant message');
    return message;
  }

  emitStep(step) {
    this.hub?.emit('agent:step', { ...step, time: new Date().toISOString() });
  }
}

function normalizeBase(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  return JSON.parse(String(raw));
}

function estimateTokens(value) {
  return Math.ceil(JSON.stringify(value || '').length / 4);
}

function compactMessages(messages, limit) {
  const max = Math.max(1000, Number(limit) || 128000);
  const result = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const cost = estimateTokens(msg);
    if (used + cost > max * 0.85 && result.length > 2) break;
    result.unshift(msg);
    used += cost;
  }
  if (result[0]?.role !== 'system' && messages[0]?.role === 'system') result.unshift(messages[0]);
  return result;
}

module.exports = {
  AgentChatService,
};
