'use strict';

const fs = require('fs');
const path = require('path');

class CredentialStore {
  constructor({ userDataDir, safeStorage } = {}) {
    this.safeStorage = safeStorage;
    this.file = path.join(userDataDir, 'notebooklm_desktop_secrets.json');
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  readAll() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const result = {};
      for (const [key, value] of Object.entries(raw || {})) {
        result[key] = this.decrypt(value);
      }
      return result;
    } catch {
      return {};
    }
  }

  get(key) {
    return this.readAll()[key] || '';
  }

  set(key, value) {
    const current = this.readRaw();
    if (!value) {
      delete current[key];
    } else {
      current[key] = this.encrypt(String(value));
    }
    fs.writeFileSync(this.file, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
    return true;
  }

  publicStatus() {
    const raw = this.readRaw();
    return Object.fromEntries(Object.keys(raw).map((key) => [key, true]));
  }

  readRaw() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  encrypt(value) {
    try {
      if (this.safeStorage?.isEncryptionAvailable?.()) {
        return {
          type: 'safeStorage',
          value: this.safeStorage.encryptString(value).toString('base64'),
        };
      }
    } catch {
      // Fall through to plain local storage.
    }
    return { type: 'plain-local', value };
  }

  decrypt(record) {
    if (!record || typeof record !== 'object') return '';
    if (record.type === 'safeStorage') {
      try {
        return this.safeStorage.decryptString(Buffer.from(record.value || '', 'base64'));
      } catch {
        return '';
      }
    }
    return String(record.value || '');
  }
}

module.exports = {
  CredentialStore,
};
