'use strict';

const fs = require('fs');
const path = require('path');

function readPackageInfo(rootDir = path.resolve(__dirname, '..')) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    return {
      name: pkg.name || 'notebooklm-mcp-desktop',
      productName: pkg.productName || 'NotebookLM MCP Desktop',
      version: pkg.version || '0.0.0',
      description: pkg.description || '',
      author: typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name || ''),
    };
  } catch {
    return {
      name: 'notebooklm-mcp-desktop',
      productName: 'NotebookLM MCP Desktop',
      version: '0.0.0',
      description: '',
      author: '',
    };
  }
}

function readChangelog(rootDir = path.resolve(__dirname, '..')) {
  for (const file of ['CHANGELOG.md', 'README.md']) {
    try {
      return fs.readFileSync(path.join(rootDir, file), 'utf8').trim().slice(0, 12000);
    } catch {
      // Try next file.
    }
  }
  return '';
}

function buildAppInfo(rootDir = path.resolve(__dirname, '..')) {
  const pkg = readPackageInfo(rootDir);
  return {
    ...pkg,
    version: process.env.NOTEBOOKLM_DESKTOP_VERSION || pkg.version,
    updateSource: process.env.NOTEBOOKLM_DESKTOP_UPDATE_SOURCE || 'github',
    updateRepo: process.env.NOTEBOOKLM_DESKTOP_UPDATE_REPO || '',
    changelog: readChangelog(rootDir),
  };
}

module.exports = {
  buildAppInfo,
  readChangelog,
  readPackageInfo,
};
