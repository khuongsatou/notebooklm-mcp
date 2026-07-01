# Test Report

## QA Summary

- Result: Pass with warnings
- Tester: Codex
- Date: 2026-06-28
- Latest smoke run: 17 pass, 6 skipped/manual

## Checklist

| Requirement | Test | Result | Evidence |
|-------------|------|--------|----------|
| REQ-DESKTOP-001 | Electron/desktop files syntax check | Pass | `npm run check:desktop` |
| REQ-BACKEND-001 | TypeScript MCP build | Pass | `npm run build` |
| REQ-BACKEND-002 | MCP adapter initializes Streamable HTTP session | Pass | Smoke test `mcp.ensureStarted()` |
| REQ-BACKEND-002 | MCP adapter calls real `get_health` | Pass | Smoke test returned `success: true`, `authenticated: false`, `active_sessions: 0` |
| REQ-BACKEND-003 | Bridge API routes `/api/info`, `/api/health`, `/api/notebooks` | Pass | Smoke test returned `infoOk`, `healthOk`, `notebooksOk` |
| REQ-SECURITY-001 | Hardcoded secret scan | Pass | No secret found; only token-prefix detection code in extension |
| REQ-PACKAGE-001 | Current-platform app packaging | Pass | `npm run package` created macOS app bundle in `release/` |
| REQ-SMOKE-001 | Feature smoke test by group | Pass with manual skips | `npm run smoke:desktop`, report at `.manager/desktop-smoke-report.json` |

## Desktop Smoke Matrix

| Feature | Result | Notes |
|---------|--------|-------|
| Bridge start | Pass | Temp bridge started |
| `/api/info` | Pass | App version returned |
| Settings get/patch | Pass | `defaultSourceFormat`, `agentMaxLoops` patched |
| Logs write/list/clear | Pass | Smoke log found and cleared |
| SSE events | Pass | Received `smoke:event` |
| MCP health | Pass | MCP HTTP started and `get_health` returned success |
| MCP tools | Pass | 20 tools listed, `get_health` present |
| Notebooks list | Pass | Returned array, currently 0 notebooks |
| Sessions list | Pass | Returned array, currently 0 sessions |
| System Chrome connect dry-run | Pass | `/api/auth/open-system-profile` builds safe Chrome open command without launching browser |
| Questions content list/read | Pass | `/api/content/list?space=questions` and sample file read |
| Workspace content list/read | Pass | `/api/content/list?space=workspace` and sample file read |
| Updates check | Pass | No repo configured handled cleanly |
| Agent config | Pass | 11 tools listed, `nb_get_health` present |
| Agent provider test | Pass | Expected failure handled for closed local provider port |
| Package artifact | Pass | `NotebookLM-MCP-Desktop-2.0.0-darwin-arm64` present |
| Auth setup | Skipped/manual | Requires interactive Google login |
| Ask/validate | Skipped/manual | Requires authenticated account and active notebook |
| Source add | Skipped/manual | Requires authenticated account and target notebook |
| Audio flow | Skipped/manual | Requires authenticated account and source-backed notebook |
| Real Agent Chat LLM | Skipped/manual | Requires configured OpenAI-compatible provider |
| Electron visual UI | Skipped/manual | Requires GUI review via `npm run desktop` |

## Commands Run

```bash
npm run check:desktop
npm run smoke:desktop
```

## Warnings

- `npm install` showed EBADENGINE warnings for ESLint packages requiring Node `^20.19.0 || ^22.13.0 || >=24`, current Node is `v23.4.0`.
- `npm audit` reports 7 vulnerabilities in dependency tree.
- GUI/browser UX and real Chrome focus behavior must be visually reviewed in Electron during manual pass.

## Defects

- None blocking found in syntax/build/backend smoke tests.

## QA Update - 2026-07-01 Extension NotebookLM Stable Connection

| Requirement | Test | Result | Evidence |
|-------------|------|--------|----------|
| REQ-008 | Extension Agent Chat background syntax | Pass | `node --check extension-flowkit/background_agent_chat.js` |
| REQ-008 | Extension Agent Chat UI syntax | Pass | `node --check extension-flowkit/side_panel_agent_chat.js` |
| REQ-008 | Extension side panel related syntax | Pass | `node --check extension-flowkit/background.js`, `side_panel_chat.js`, `side_panel.js`, `side_panel_skills.js` |
| REQ-008 | TypeScript MCP build after integration | Pass | `npm run build` |
| REQ-008 | Desktop bridge syntax including safe runner | Pass | `npm run check:desktop` |
| REQ-008 | Desktop bridge smoke baseline for extension target | Pass with manual skips | `npm run smoke:desktop` returned 17 pass, 6 skipped/manual |

### Manual Test Still Needed

- Load/reload `extension-flowkit` in Chrome.
- Open Agent Chat settings, verify `NotebookLM Bridge` defaults to `http://127.0.0.1:18931`.
- Start desktop bridge, click `Test NotebookLM`, confirm doctor shows ready/warning/blocker accurately.
- Use `/fk-notebooklm-connect` and ask a real notebook question through `fk_notebook_ask_safe`.
- Add a small text source through `fk_notebook_add_source` against a known notebook.
