# Implementation Notes

## Developer Summary

Đã triển khai desktop app Electron + backend bridge theo plan. App dùng `.cjs` để tránh xung đột package ESM, bridge spawn MCP HTTP transport từ `dist/index.js`, UI gọi NotebookLM MCP qua IPC/REST adapter.

## Changed Files

| File | Requirement | Notes |
|------|-------------|-------|
| `electron.cjs` | REQ-DESKTOP-001 | Electron main, khởi động bridge, IPC, tray, app info |
| `preload.cjs` | REQ-DESKTOP-001 | `contextBridge` API cho renderer |
| `renderer/index.html` | REQ-DESKTOP-002 | Dashboard, Notebooks, Ask, Sources, Audio, Sessions, Questions, Workspace, Agent, Logs, Settings, Version modal |
| `renderer/styles.css` | REQ-DESKTOP-002 | Dark/orange style giống reference, icon-heavy, ít chữ |
| `renderer/renderer.js` | REQ-DESKTOP-003 | UI logic, NotebookLM workflows, logs, settings, agent chat, content viewer |
| `lib/notebook-bridge-server.cjs` | REQ-BACKEND-001 | REST API bridge + static renderer + content list/read/raw API + System Chrome profile opener |
| `lib/notebook-mcp-adapter.cjs` | REQ-BACKEND-002 | Spawn MCP HTTP, initialize session, call tools |
| `lib/notebook-socket-hub.cjs` | REQ-BACKEND-003 | SSE realtime events |
| `lib/agent-chat.cjs`, `lib/agent-tools.cjs` | REQ-AGENT-001 | OpenAI-compatible Agent Chat + NotebookLM tools |
| `lib/desktop-settings.cjs` | REQ-SETTINGS-001 | Local settings |
| `lib/desktop-credential-store.cjs` | REQ-SECURITY-001 | Provider API key storage via Electron safeStorage when available |
| `lib/notebook-update-client.cjs` | REQ-UPDATE-001 | GitHub update check skeleton |
| `scripts/start-electron.cjs` | REQ-RUN-001 | Build then start Electron |
| `scripts/package-app.cjs` | REQ-PACKAGE-001 | Creates current-platform Electron app bundle under `release/` |
| `package.json`, `package-lock.json` | REQ-RUN-001 | Added Electron scripts/dependency |

## Technical Decisions

- Desktop app uses CommonJS `.cjs` because root package is ESM and Electron main/preload are simpler in CJS.
- MCP logic is not duplicated; bridge calls current NotebookLM MCP server over Streamable HTTP.
- Adapter supports MCP SSE-style HTTP responses (`event: message`).
- Realtime uses SSE hub and IPC forwarding; REST remains for CRUD/actions.
- Questions/Workspace tabs use a safe content API constrained to project roots and support JSON/text/media preview.
- Connect defaults to `System Chrome`, so it opens/focuses NotebookLM in the existing Chrome profile. `MCP Auth` remains available for the separate MCP browser profile.
- Provider API key is not saved in settings JSON; it is handled by credential store.

## Risks

- Packaging creates a local app bundle, but signing/notarization and auto-update install are not implemented.
- Actual NotebookLM login/ask/audio require user auth and browser review.
- `npm install` reported npm audit vulnerabilities in dependency tree and EBADENGINE warnings from ESLint packages under Node v23.4.0.

## Update - 2026-07-01 Extension NotebookLM Stable Connection

### Developer Summary

Đã bổ sung lớp kết nối NotebookLM ổn định từ Chrome extension Agent Chat sang local NotebookLM desktop bridge.

### Changed Files

| File | Requirement | Notes |
|------|-------------|-------|
| `extension-flowkit/background_agent_chat.js` | REQ-008 | Thêm settings `notebookBridgeUrl`, `notebookRequestTimeoutMs`; thêm tools `fk_notebook_status`, `fk_notebook_doctor`, `fk_notebook_ask_safe`, `fk_notebook_add_source`; thêm fetch helper có timeout/retry và redaction token/cookie. |
| `extension-flowkit/side_panel_agent_chat.js` | REQ-008 | Thêm fields NotebookLM Bridge/Timeout và nút `Test NotebookLM` trong Agent settings. |
| `extension-flowkit/skills/fk-notebooklm-connect.md` | REQ-008 | Skill workflow cho chẩn đoán bridge/auth/notebook/session và dùng ask-safe/add-source an toàn. |
| `extension-flowkit/side_panel_chat.js` | REQ-008 | Thêm fallback command `/fk-notebooklm-connect` cho autocomplete khi backend skills API chưa chạy. |

### Technical Decisions

- Extension chỉ gọi HTTP local `http://127.0.0.1`/`localhost` để tránh biến Agent Chat thành proxy tuỳ ý.
- Ask dùng `/api/ask-safe` thay vì `/api/ask`, có preflight doctor, classified failure và retry ở desktop bridge.
- Add source chạy preflight `fk_notebook_doctor` trước khi submit `/api/sources`.
- Tool results được redact token/cookie/authorization trước khi đưa vào Agent Chat.

### Remaining Risks

- Cần desktop NotebookLM bridge đang chạy ở URL cấu hình, mặc định `http://127.0.0.1:18931`.
- Cần MCP auth và notebook target hợp lệ trước khi ask/add-source thật.
- Chưa chạy manual Chrome extension UI review trong trình duyệt.
