'use strict';

const https = require('https');

class NotebookUpdateClient {
  constructor({ appInfo, settings, log } = {}) {
    this.appInfo = appInfo;
    this.settings = settings;
    this.log = log;
  }

  async check() {
    const settings = this.settings.read();
    const repo = settings.updateRepo || this.appInfo.updateRepo || '';
    if (!repo) {
      return {
        ok: true,
        source: settings.updateSource || 'github',
        currentVersion: this.appInfo.version,
        latestVersion: this.appInfo.version,
        hasUpdate: false,
        message: 'No update repo configured.',
      };
    }
    try {
      const data = await requestJson(`https://api.github.com/repos/${repo}/releases/latest`);
      const latestVersion = normalizeVersion(data.tag_name || data.name || this.appInfo.version);
      const currentVersion = normalizeVersion(this.appInfo.version);
      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
      return {
        ok: true,
        source: 'github',
        repo,
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseUrl: data.html_url || '',
        changelog: data.body || '',
        assets: Array.isArray(data.assets) ? data.assets.map((asset) => ({
          name: asset.name,
          size: asset.size,
          downloadUrl: asset.browser_download_url,
        })) : [],
      };
    } catch (error) {
      this.log?.warn('updates', 'Update check failed', { error: error.message });
      return { ok: false, error: error.message, currentVersion: this.appInfo.version };
    }
  }
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(new URL(url), {
      method: 'GET',
      timeout: 15000,
      headers: { 'User-Agent': 'NotebookLM-MCP-Desktop/1.0' },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
          reject(new Error(`github_http_${res.statusCode}: ${text.slice(0, 160)}`));
          return;
        }
        try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('update_check_timeout')));
    req.on('error', reject);
    req.end();
  });
}

function normalizeVersion(value = '') {
  const match = String(value || '').replace(/^v/i, '').match(/\d+(?:\.\d+){0,3}/);
  return match ? match[0] : '0.0.0';
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split('.').map(Number);
  const right = normalizeVersion(b).split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length, 3); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

module.exports = {
  NotebookUpdateClient,
};
