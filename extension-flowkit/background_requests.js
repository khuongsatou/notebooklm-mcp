async function requestCaptchaFromTab(tabId, requestId, pageAction) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: 'GET_CAPTCHA',
      requestId,
      pageAction,
    });
  } catch (error) {
    const msg = error?.message || '';
    const shouldInject =
      msg.includes('Receiving end does not exist') ||
      msg.includes('Could not establish connection');
    if (!shouldInject) throw error;

    // Inject content script and retry
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    await sleep(200);
    return await chrome.tabs.sendMessage(tabId, {
      type: 'GET_CAPTCHA',
      requestId,
      pageAction,
    });
  }
}

async function getReadyFlowTab() {
  const flowUrlPatterns = ['https://labs.google/fx/tools/flow*', 'https://labs.google/fx/*/tools/flow*'];
  let tabs = await chrome.tabs.query({ url: flowUrlPatterns });

  if (!tabs.length) {
    const created = await chrome.tabs.create({
      url: 'https://labs.google/fx/tools/flow',
      active: true,
    });
    await sleep(3000);
    tabs = [created];
  }

  const tab = tabs
    .filter((candidate) => candidate?.id)
    .sort((a, b) => {
      if (!!b.active !== !!a.active) return Number(!!b.active) - Number(!!a.active);
      return (b.lastAccessed || 0) - (a.lastAccessed || 0);
    })[0];

  if (!tab?.id) return null;

  try {
    if (tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tab.id, { active: true });
    await sleep(750);
  } catch (e) {
    console.warn('[FlowAgent] Could not focus Flow tab before captcha:', e?.message || e);
  }

  return tab;
}

async function solveCaptcha(requestId, captchaAction) {
  try {
    const tab = await getReadyFlowTab();
    if (!tab?.id) return { error: 'NO_FLOW_TAB' };
    const resp = await Promise.race([
      requestCaptchaFromTab(tab.id, requestId, captchaAction),
      new Promise((_, rej) => setTimeout(() => rej(new Error('CAPTCHA_TIMEOUT')), 30000)),
    ]);
    return resp;
  } catch (e) {
    return { error: e.message };
  }
}

async function handleSolveCaptcha(msg) {
  const { id, params } = msg;
  const result = await solveCaptcha(id, params?.captchaAction || 'VIDEO_GENERATION');

  // Standalone captcha solve counts as captcha-consuming
  metrics.requestCount++;
  if (result?.token) {
    metrics.successCount++;
  } else {
    metrics.failedCount++;
    metrics.lastError = result?.error || 'NO_TOKEN';
  }
  chrome.storage.local.set({ metrics });

  sendToAgent({ id, result });
}

// ─── API Request Proxy ──────────────────────────────────────

async function handleTrpcRequest(msg) {
  const { id, params } = msg;
  const { url, method = 'POST', headers = {}, body, responseType = 'json' } = params;

  if (!url || !url.startsWith('https://labs.google/')) {
    sendToAgent({ id, error: 'INVALID_TRPC_URL' });
    return;
  }

  setState('running');
  // TRPC calls don't consume captcha — don't count in metrics

  const logId = id;
  const logType = url.includes('createProject') ? 'CREATE_PROJECT' : 'TRPC';
  // TRPC calls are silent — don't show in request log

  const fetchHeaders = { 'Content-Type': 'application/json', ...headers };
  if (flowKey) {
    fetchHeaders['authorization'] = `Bearer ${flowKey}`;
  }

  try {
    const resp = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    let data;
    if (responseType === 'url') {
      data = { url: resp.url, ok: resp.ok };
    } else {
      data = await resp.json();
    }
    chrome.storage.local.set({ metrics });
    updateRequestLog(logId, { status: 'success' });
    sendToAgent({ id, status: resp.status, data });
  } catch (e) {
    console.error('[FlowAgent] tRPC request failed:', e);
    chrome.storage.local.set({ metrics });
    updateRequestLog(logId, { status: 'failed', error: e.message || 'TRPC_FETCH_FAILED' });
    sendToAgent({ id, error: e.message || 'TRPC_FETCH_FAILED' });
  } finally {
    setState('idle');
  }
}

async function handleApiRequest(msg) {
  const { id, params } = msg;
  const { url, method, headers, body, captchaAction } = params;

  if (!url) {
    sendToAgent({ id, error: 'MISSING_URL' });
    return;
  }

  if (!url.startsWith('https://aisandbox-pa.googleapis.com/')) {
    sendToAgent({ id, error: 'INVALID_URL' });
    return;
  }

  setState('running');
  const hasCaptcha = !!captchaAction;
  if (hasCaptcha) metrics.requestCount++;

  const logId = id;
  const logType = _classifyApiUrl(url);
  if (_VISIBLE_TYPES.has(logType)) {
    const payloadSummary = body ? JSON.stringify(body).slice(0, 200) : null;
    addRequestLog({ id: logId, type: logType, time: new Date().toISOString(), status: 'processing', error: null, outputUrl: null, url, payloadSummary });
  }

  try {
    // Step 1: Solve captcha if needed
    let captchaToken = null;
    if (captchaAction) {
      const captchaResult = await solveCaptcha(id, captchaAction);
      captchaToken = captchaResult?.token || null;
      if (!captchaToken) {
        // Cannot proceed without captcha — API will 403
        const err = captchaResult?.error || 'CAPTCHA_FAILED';
        console.error(`[FlowAgent] Captcha failed for ${captchaAction}: ${err}`);
        sendToAgent({ id, status: 403, error: `CAPTCHA_FAILED: ${err}` });
        if (hasCaptcha) { metrics.failedCount++; metrics.lastError = `CAPTCHA_FAILED: ${err}`; }
        chrome.storage.local.set({ metrics });
        updateRequestLog(logId, { status: 'failed', error: `CAPTCHA_FAILED: ${err}` });
        setState('idle');
        return;
      }
    }

    // Step 2: Inject captcha token into body
    let finalBody = body;
    if (captchaToken && finalBody) {
      finalBody = JSON.parse(JSON.stringify(finalBody)); // deep clone
      if (finalBody.clientContext?.recaptchaContext) {
        finalBody.clientContext.recaptchaContext.token = captchaToken;
      }
      if (finalBody.requests && Array.isArray(finalBody.requests)) {
        for (const req of finalBody.requests) {
          if (req.clientContext?.recaptchaContext) {
            req.clientContext.recaptchaContext.token = captchaToken;
          }
        }
      }
    }

    // Step 3: Use flowKey for auth
    const activeFlowKey = flowKey;
    if (!activeFlowKey) {
      sendToAgent({ id, status: 503, error: 'NO_FLOW_KEY' });
      if (hasCaptcha) { metrics.failedCount++; metrics.lastError = 'NO_FLOW_KEY'; }
      chrome.storage.local.set({ metrics });
      updateRequestLog(logId, { status: 'failed', error: 'NO_FLOW_KEY' });
      setState('idle');
      return;
    }

    const fetchHeaders = { ...(headers || {}) };
    fetchHeaders['authorization'] = `Bearer ${activeFlowKey}`;
    if (url.includes('batchAsyncGenerateVideo')) {
      const debugHeaders = { ...fetchHeaders, authorization: 'Bearer <FLOW_KEY>' };
      const debugBody = finalBody ? JSON.parse(JSON.stringify(finalBody)) : finalBody;
      if (debugBody?.clientContext?.recaptchaContext?.token) {
        debugBody.clientContext.recaptchaContext.token = '<RECAPTCHA_TOKEN>';
      }
      if (Array.isArray(debugBody?.requests)) {
        for (const req of debugBody.requests) {
          if (req.clientContext?.recaptchaContext?.token) req.clientContext.recaptchaContext.token = '<RECAPTCHA_TOKEN>';
        }
      }
      const curlFull = buildCurl(method || 'POST', url, debugHeaders, debugBody);
      console.log('[FlowAgent][GEN_VIDEO_CURL]\n' + curlFull);
      updateRequestLog(logId, { curlFull, requestBodyFull: JSON.stringify(debugBody, null, 2) });
      sendToAgent({ type: 'debug_log', label: 'GEN_VIDEO_CURL', message: curlFull });
    }

    // Step 4: Make the API call from browser context
    const response = await fetch(url, {
      method: method || 'POST',
      headers: fetchHeaders,
      credentials: 'include',
      body: method === 'GET' ? undefined : JSON.stringify(finalBody),
    });

    let responseData;
    const responseText = await response.text();
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    if (url.includes('batchAsyncGenerateVideo')) {
      const responseFull = JSON.stringify({ status: response.status, ok: response.ok, body: responseData }, null, 2);
      console.log('[FlowAgent][GEN_VIDEO_RESPONSE]', {
        status: response.status,
        ok: response.ok,
        body: responseData,
      });
      updateRequestLog(logId, { responseFull });
      sendToAgent({
        type: 'debug_log',
        label: 'GEN_VIDEO_RESPONSE',
        message: responseFull,
      });
    }

    sendToAgent({
      id,
      status: response.status,
      data: responseData,
    });

    const responseSummary = responseText ? responseText.slice(0, 300) : null;
    if (response.ok) {
      if (hasCaptcha) { metrics.successCount++; metrics.lastError = null; }
      updateRequestLog(logId, { status: 'success', httpStatus: response.status, responseSummary });
    } else {
      if (hasCaptcha) { metrics.failedCount++; metrics.lastError = `API_${response.status}`; }
      updateRequestLog(logId, { status: 'failed', error: `API_${response.status}`, httpStatus: response.status, responseSummary });
    }
  } catch (e) {
    sendToAgent({
      id,
      status: 500,
      error: e.message || 'API_REQUEST_FAILED',
    });
    if (hasCaptcha) { metrics.failedCount++; metrics.lastError = e.message; }
    updateRequestLog(logId, { status: 'failed', error: e.message || 'API_REQUEST_FAILED' });
  }

  chrome.storage.local.set({ metrics });
  setState('idle');
}

function redactBearer(value) {
  const text = String(value || '');
  return text.replace(/Bearer\s+[^'"\s]+/gi, 'Bearer <FLOW_KEY>');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildCurl(method, url, headers, body) {
  const parts = [`curl ${shellQuote(url)}`];
  if ((method || 'POST').toUpperCase() !== 'GET') parts.push(`-X ${shellQuote(method || 'POST')}`);
  for (const [key, value] of Object.entries(headers || {})) {
    parts.push(`-H ${shellQuote(`${key}: ${redactBearer(value)}`)}`);
  }
  if (body !== undefined && body !== null && (method || 'POST').toUpperCase() !== 'GET') {
    parts.push(`--data-raw ${shellQuote(JSON.stringify(body))}`);
  }
  return parts.join(' \\\n  ');
}

// ─── State & Popup ──────────────────────────────────────────
