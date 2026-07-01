'use strict';

class NotebookSafeRunner {
  constructor({ mcp, log, settings } = {}) {
    this.mcp = mcp;
    this.log = log;
    this.settings = settings;
  }

  async doctor(options = {}) {
    const opts = {
      includeLogs: options.include_logs === true || options.includeLogs === true,
      logQuery: options.log_query || options.logQuery || '',
      logLimit: clamp(Number(options.log_limit || options.logLimit || 12), 1, 50),
      targetNotebookProvided: Boolean(options.targetNotebookProvided),
    };
    const startedAt = Date.now();
    const checks = [];
    let healthResult = null;
    let health = null;
    let sessionsResult = null;
    let sessions = null;

    try {
      healthResult = await this.mcp.callTool('get_health', {}, { progress: false });
      health = unwrapData(healthResult);
      checks.push(check('MCP_HEALTH', 'ok', true, 'MCP responded to get_health.', 'No action needed.', {
        initialized: this.mcp.config?.().initialized ?? null,
      }));
    } catch (error) {
      checks.push(check(
        'MCP_UNAVAILABLE',
        'error',
        false,
        `MCP did not respond: ${safeMessage(error)}`,
        'Start/restart the desktop bridge, then call /api/doctor again.'
      ));
    }

    if (health) {
      const authenticated = health.authenticated === true;
      checks.push(check(
        'AUTH',
        authenticated ? 'ok' : 'error',
        authenticated,
        authenticated ? 'NotebookLM MCP auth state is valid.' : 'NotebookLM MCP auth is missing or expired.',
        authenticated
          ? 'No action needed.'
          : 'Run POST /api/auth/reauth with {"show_browser":true}, finish Google login, then retry.',
        { authenticated }
      ));

      const hasTarget = opts.targetNotebookProvided || Boolean(health.active_notebook_id || isHttpUrl(health.notebook_url));
      checks.push(check(
        'NOTEBOOK_TARGET',
        hasTarget ? 'ok' : 'error',
        hasTarget,
        hasTarget ? 'A notebook target is available.' : 'No active notebook or notebook target is available.',
        hasTarget
          ? 'No action needed.'
          : 'Add/select a notebook, or pass notebook_id/notebook_url to /api/ask-safe.',
        {
          active_notebook_id: health.active_notebook_id || null,
          total_notebooks: health.total_notebooks ?? null,
        }
      ));

      if (Number.isFinite(Number(health.active_sessions)) && Number.isFinite(Number(health.max_sessions))) {
        const active = Number(health.active_sessions);
        const max = Number(health.max_sessions);
        checks.push(check(
          'SESSION_CAPACITY',
          active >= max ? 'warn' : 'ok',
          active < max,
          active >= max ? `Active sessions are at capacity (${active}/${max}).` : `Session capacity is healthy (${active}/${max}).`,
          active >= max ? 'Close old sessions with POST /api/sessions/{id}/close or restart the bridge.' : 'No action needed.',
          { active_sessions: active, max_sessions: max, session_timeout: health.session_timeout ?? null }
        ));
      }

      const currentSettings = this.settings?.read?.() || {};
      if (currentSettings.connectMode === 'systemChrome' && health.authenticated !== true) {
        checks.push(check(
          'PROFILE_MODE',
          'warn',
          false,
          'Desktop connect mode opens system Chrome, but MCP ask uses the MCP browser profile.',
          'For /api/ask-safe, authenticate the MCP profile with /api/auth/reauth. Use system Chrome only for manual browsing.',
          { connectMode: currentSettings.connectMode }
        ));
      }
    }

    try {
      sessionsResult = await this.mcp.callTool('list_sessions', {}, { progress: false });
      sessions = unwrapData(sessionsResult);
    } catch (error) {
      if (health) {
        checks.push(check(
          'SESSION_LIST',
          'warn',
          false,
          `Could not list sessions: ${safeMessage(error)}`,
          'This is usually non-fatal. Retry /api/doctor if session controls look stale.'
        ));
      }
    }

    const entries = opts.includeLogs
      ? this.log?.list?.({ level: 'all', query: opts.logQuery, limit: opts.logLimit }) || []
      : [];
    const diagnosis = checks
      .filter((item) => item.status !== 'ok')
      .map((item) => ({
        code: item.code,
        severity: item.status,
        message: item.message,
        fix: item.fix,
      }));
    const blockers = checks.filter((item) => item.status === 'error');

    return {
      ok: blockers.length === 0,
      status: blockers.length ? 'blocked' : diagnosis.length ? 'warning' : 'ready',
      elapsed_ms: Date.now() - startedAt,
      summary: blockers.length
        ? `${blockers.length} blocking issue(s) found.`
        : diagnosis.length
          ? `${diagnosis.length} warning(s) found.`
          : 'NotebookLM bridge looks ready.',
      checks,
      diagnosis,
      prescription: buildPrescription(diagnosis),
      health,
      sessions,
      logs: entries,
    };
  }

  async askSafe(args = {}) {
    const question = String(args.question || '').trim();
    if (!question) {
      return {
        ok: false,
        status: 'blocked',
        error: 'QUESTION_REQUIRED',
        diagnosis: [{ code: 'QUESTION_REQUIRED', severity: 'error', message: 'question is required.' }],
      };
    }

    const targetNotebookProvided = Boolean(args.notebook_id || args.notebook_url);
    const preflight = await this.doctor({ targetNotebookProvided });
    if (!preflight.ok) {
      this.log?.warn?.('safe-runner', 'ask-safe blocked by preflight', {
        diagnosis: preflight.diagnosis,
      });
      return {
        ok: false,
        status: 'blocked',
        error: 'PREFLIGHT_FAILED',
        diagnosis: preflight.diagnosis,
        prescription: preflight.prescription,
        preflight,
      };
    }

    const retry = args.retry !== false;
    const askArgs = normalizeAskArgs(args);
    const first = await this.callAskQuestion(askArgs);
    if (first.ok) {
      return {
        ok: true,
        status: 'success',
        attempts: 1,
        preflight,
        result: first.result,
        data: first.result.data || first.result,
      };
    }

    const classified = classifyNotebookError(first.error);
    if (!retry || !classified.retryable) {
      return buildAskFailure({ attempts: 1, preflight, classified, error: first.error });
    }

    if (askArgs.session_id && /session/i.test(first.error || '')) {
      await this.mcp.callTool('reset_session', { session_id: askArgs.session_id }, { progress: false }).catch(() => null);
    }

    const secondArgs = {
      ...askArgs,
      show_browser: askArgs.show_browser !== false,
      browser_options: {
        ...(askArgs.browser_options || {}),
        show: true,
        timeout_ms: Math.max(Number(askArgs.browser_options?.timeout_ms || 0), 900000),
      },
    };
    const second = await this.callAskQuestion(secondArgs);
    if (second.ok) {
      return {
        ok: true,
        status: 'success',
        attempts: 2,
        recovered_from: classified,
        preflight,
        result: second.result,
        data: second.result.data || second.result,
      };
    }

    return buildAskFailure({
      attempts: 2,
      preflight,
      classified: classifyNotebookError(second.error),
      error: second.error,
      first_error: first.error,
    });
  }

  async callAskQuestion(args) {
    try {
      const result = await this.mcp.callTool('ask_question', args);
      if (result?.ok === false || result?.success === false) {
        return { ok: false, result, error: result.error || 'ask_question failed' };
      }
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: safeMessage(error) };
    }
  }
}

function normalizeAskArgs(args) {
  const allowed = [
    'question',
    'session_id',
    'notebook_id',
    'notebook_url',
    'show_browser',
    'browser_options',
    'source_format',
  ];
  const result = {};
  for (const key of allowed) {
    if (args[key] !== undefined) result[key] = args[key];
  }
  if (!result.source_format) result.source_format = 'none';
  return result;
}

function unwrapData(result) {
  if (!result) return null;
  if (result.data && typeof result.data === 'object') return result.data;
  return result;
}

function check(code, status, pass, message, fix, evidence = {}) {
  return { code, status, pass, message, fix, evidence };
}

function buildPrescription(diagnosis) {
  if (!diagnosis.length) return ['No action needed.'];
  return diagnosis.map((item) => `${item.code}: ${item.fix}`);
}

function classifyNotebookError(error) {
  const message = safeMessage(error);
  const lower = message.toLowerCase();
  if (/rate limit|daily discussion|daily limit|query limit/.test(lower)) {
    return { code: 'RATE_LIMIT', retryable: false, message, fix: 'Wait for quota reset or re_auth with another Google account.' };
  }
  if (/auth|login|sign in|re-auth|authenticate/.test(lower)) {
    return { code: 'AUTH_EXPIRED', retryable: false, message, fix: 'Run POST /api/auth/reauth with show_browser=true.' };
  }
  if (/timeout|request-timeout/.test(lower)) {
    return { code: 'TIMEOUT', retryable: true, message, fix: 'Retry with a visible browser and a larger timeout.' };
  }
  if (/chat input|interface not ready|selector|page has loaded/.test(lower)) {
    return { code: 'PAGE_NOT_READY', retryable: true, message, fix: 'Retry with show_browser=true; close modals or reload the notebook page.' };
  }
  if (/closed|target.*closed|context.*closed|browser.*closed/.test(lower)) {
    return { code: 'BROWSER_CLOSED', retryable: true, message, fix: 'Retry after the MCP browser context recreates.' };
  }
  if (/notebook.*required|notebook not found|active notebook/.test(lower)) {
    return { code: 'NO_NOTEBOOK_TARGET', retryable: false, message, fix: 'Select a notebook or pass notebook_id/notebook_url.' };
  }
  if (/processsingleton|singletonlock|profile.*use|profile lock/.test(lower)) {
    return { code: 'PROFILE_LOCK', retryable: false, message, fix: 'Close Chrome/Chromium or use NOTEBOOK_PROFILE_STRATEGY=isolated.' };
  }
  return { code: 'UNKNOWN', retryable: false, message, fix: 'Run /api/doctor?include_logs=1 and inspect recent MCP logs.' };
}

function buildAskFailure({ attempts, preflight, classified, error, first_error }) {
  return {
    ok: false,
    status: 'failed',
    attempts,
    error: classified.code,
    message: safeMessage(error),
    first_error,
    diagnosis: [{
      code: classified.code,
      severity: classified.retryable ? 'warn' : 'error',
      message: classified.message,
      fix: classified.fix,
    }],
    prescription: [classified.fix],
    preflight,
  };
}

function safeMessage(error) {
  const message = error?.message || error?.error || String(error || 'Unknown error');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/ya29\.[A-Za-z0-9._-]+/g, 'ya29.[redacted]');
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  NotebookSafeRunner,
  classifyNotebookError,
};
