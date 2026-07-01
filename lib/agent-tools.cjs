'use strict';

function buildNotebookAgentTools() {
  return [
    tool('nb_get_health', 'Check NotebookLM MCP health/auth/session/library status.', {}),
    tool('nb_doctor', 'Diagnose NotebookLM bridge/auth/session/notebook readiness and prescribe fixes.', {
      include_logs: { type: 'boolean' },
      log_query: { type: 'string' },
      log_limit: { type: 'number' },
    }),
    tool('nb_setup_auth', 'Run NotebookLM setup auth. Opens browser when show_browser is true.', {
      show_browser: { type: 'boolean' },
    }),
    tool('nb_list_notebooks', 'List local NotebookLM notebook library.', {}),
    tool('nb_select_notebook', 'Select active notebook by id.', {
      id: { type: 'string' },
    }, ['id']),
    tool('nb_ask_question', 'Ask NotebookLM a grounded question.', {
      question: { type: 'string' },
      notebook_id: { type: 'string' },
      session_id: { type: 'string' },
      source_format: { type: 'string', enum: ['none', 'inline', 'footnotes', 'json'] },
      show_browser: { type: 'boolean' },
    }, ['question']),
    tool('nb_ask_safe', 'Run NotebookLM preflight diagnostics, then ask with classified failure output and one safe retry.', {
      question: { type: 'string' },
      notebook_id: { type: 'string' },
      notebook_url: { type: 'string' },
      session_id: { type: 'string' },
      source_format: { type: 'string', enum: ['none', 'inline', 'footnotes', 'json'] },
      show_browser: { type: 'boolean' },
      retry: { type: 'boolean' },
    }, ['question']),
    tool('nb_add_source', 'Add URL or text source to NotebookLM.', {
      type: { type: 'string', enum: ['url', 'text'] },
      content: { type: 'string' },
      title: { type: 'string' },
      notebook_id: { type: 'string' },
      session_id: { type: 'string' },
      show_browser: { type: 'boolean' },
    }, ['type', 'content']),
    tool('nb_audio_generate', 'Start or wait for NotebookLM Audio Overview generation.', {
      notebook_id: { type: 'string' },
      session_id: { type: 'string' },
      custom_prompt: { type: 'string' },
      wait_for_completion: { type: 'boolean' },
      timeout_ms: { type: 'number' },
      show_browser: { type: 'boolean' },
    }),
    tool('nb_audio_status', 'Check NotebookLM Audio Overview status.', {
      notebook_id: { type: 'string' },
      session_id: { type: 'string' },
      show_browser: { type: 'boolean' },
    }),
    tool('nb_audio_download', 'Download ready NotebookLM Audio Overview.', {
      destination_dir: { type: 'string' },
      notebook_id: { type: 'string' },
      session_id: { type: 'string' },
      show_browser: { type: 'boolean' },
    }, ['destination_dir']),
    tool('nb_logs_read', 'Read recent desktop bridge logs.', {
      level: { type: 'string', enum: ['all', 'info', 'warn', 'error'] },
      query: { type: 'string' },
      limit: { type: 'number' },
    }),
    tool('nb_update_check', 'Check desktop app update status.', {}),
  ];
}

function tool(name, description, properties, required = []) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

async function executeNotebookAgentTool(name, args, ctx) {
  const mcp = ctx.mcp;
  const defaults = {};
  if (ctx.settings.read().browserMode === 'visible') defaults.show_browser = true;
  switch (name) {
    case 'nb_get_health':
      return mcp.callTool('get_health', {});
    case 'nb_doctor':
      return ctx.safeRunner.doctor(args);
    case 'nb_setup_auth':
      return mcp.callTool('setup_auth', { show_browser: args.show_browser ?? defaults.show_browser });
    case 'nb_list_notebooks':
      return mcp.callTool('list_notebooks', {});
    case 'nb_select_notebook':
      return mcp.callTool('select_notebook', { id: args.id });
    case 'nb_ask_question':
      return mcp.callTool('ask_question', { ...args, source_format: args.source_format || ctx.settings.read().defaultSourceFormat || 'none' });
    case 'nb_ask_safe':
      return ctx.safeRunner.askSafe({ ...args, source_format: args.source_format || ctx.settings.read().defaultSourceFormat || 'none' });
    case 'nb_add_source':
      return mcp.callTool('add_source', args);
    case 'nb_audio_generate':
      return mcp.callTool('generate_audio', args);
    case 'nb_audio_status':
      return mcp.callTool('get_audio_status', args);
    case 'nb_audio_download':
      return mcp.callTool('download_audio', args);
    case 'nb_logs_read':
      return { ok: true, data: { entries: ctx.log.list(args) } };
    case 'nb_update_check':
      return ctx.update.check();
    default:
      throw new Error(`Unknown agent tool: ${name}`);
  }
}

module.exports = {
  buildNotebookAgentTools,
  executeNotebookAgentTool,
};
