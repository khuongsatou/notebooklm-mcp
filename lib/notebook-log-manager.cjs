'use strict';

const fs = require('fs');
const path = require('path');

class NotebookLogManager {
  constructor({ userDataDir, retention = 500 } = {}) {
    this.retention = retention;
    this.entries = [];
    this.file = path.join(userDataDir, 'notebooklm_desktop.log');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }

  write(level, scope, message, meta = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      time: new Date().toISOString(),
      level,
      scope,
      message,
      meta: redact(meta),
    };
    this.entries.unshift(entry);
    this.entries = this.entries.slice(0, this.retention);
    try {
      fs.appendFileSync(this.file, `${JSON.stringify(entry)}\n`);
    } catch {
      // File logging is best effort.
    }
    return entry;
  }

  info(scope, message, meta) { return this.write('info', scope, message, meta); }
  warn(scope, message, meta) { return this.write('warn', scope, message, meta); }
  error(scope, message, meta) { return this.write('error', scope, message, meta); }

  list({ level = 'all', query = '', limit = 200 } = {}) {
    const q = String(query || '').toLowerCase();
    return this.entries
      .filter((entry) => level === 'all' || entry.level === level)
      .filter((entry) => !q || JSON.stringify(entry).toLowerCase().includes(q))
      .slice(0, Math.min(Number(limit) || 200, this.retention));
  }

  clear() {
    this.entries = [];
    try { fs.writeFileSync(this.file, ''); } catch { /* best effort */ }
    return { ok: true };
  }

  stats() {
    const counts = this.entries.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1;
      return acc;
    }, {});
    return { total: this.entries.length, retention: this.retention, counts, file: this.file };
  }
}

function redact(value) {
  const text = JSON.stringify(value || {});
  return JSON.parse(text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/("?(?:apiKey|token|password|secret)"?\s*:\s*")([^"]+)(")/gi, '$1[redacted]$3'));
}

module.exports = {
  NotebookLogManager,
};
