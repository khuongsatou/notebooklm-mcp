# Desktop App Plan: NotebookLM MCP Desktop

## Mục tiêu

Tạo desktop app bằng Electron cho dự án hiện tại, tham khảo UI/UX và kiến trúc từ `/Users/apple/Desktop/project/mtips5s_profile_pro`, sao chép tinh thần style và luồng vận hành khoảng 90% nhưng map đúng domain NotebookLM MCP.

App phải có:

- UI ít chữ, nhiều icon, thao tác bằng chọn option thay vì bắt user gõ.
- Backend bridge riêng để kết nối UI với NotebookLM MCP server.
- API cho tác vụ CRUD/command không realtime.
- Socket/SSE cho trạng thái realtime: logs, tool progress, session, auth, audio generation.
- Nút kết nối NotebookLM để setup auth, phân tích và validate thông tin nhanh qua MCP.
- Label version góc phải; click mở modal update/info giống reference.

## Reference đã đọc

| Nguồn | Dùng để học |
|------|-------------|
| `refer/01-tong-quan-kien-truc.md` | Kiến trúc MCP NotebookLM, tool handlers, session/browser/library |
| `refer/02-pipeline-luong-du-lieu.md` | Luồng ask/source/audio/auth/HTTP transport |
| `refer/03-prompt-va-schema-tool.md` | Tool schema, prompt, annotations, input/output |
| `refer/04-phan-tich-chuc-nang-io.md` | Mapping chức năng, input, output |
| `mtips5s_profile_pro/electron.cjs` | Electron main, app info, update, IPC, tray/background |
| `mtips5s_profile_pro/preload.cjs` | `contextBridge` API surface |
| `mtips5s_profile_pro/renderer/*` | Dark UI, icon-heavy controls, version modal |
| `mtips5s_profile_pro/lib/bridge-server.cjs` | HTTP bridge, SSE/OpenAPI pattern |
| `mtips5s_profile_pro/lib/update-client.cjs` | Update check/download/install pattern |

## Kiến trúc đề xuất

```text
Electron Renderer
  -> preload contextBridge
  -> Electron main IPC
  -> NotebookLM Desktop Bridge
      -> REST API for CRUD/actions
      -> WebSocket/SSE for progress/status/logs
      -> MCP adapter/service
          -> existing NotebookLM MCP tool definitions/handlers
          -> SessionManager/AuthManager/NotebookLibrary
          -> Patchright browser automation
```

## Cấu trúc file cần tạo

```text
electron.cjs
preload.cjs
renderer/
  index.html
  renderer.js
  styles.css
  icons.css
lib/
  desktop-app-info.cjs
  desktop-settings.cjs
  desktop-credential-store.cjs
  notebook-bridge-server.cjs
  notebook-mcp-adapter.cjs
  notebook-socket-hub.cjs
  notebook-log-manager.cjs
  notebook-update-client.cjs
  agent-chat.cjs
  agent-tools.cjs
scripts/
  start-electron.cjs
  package-app.cjs
assets/
  icon.svg
```

## Backend bridge

### REST API

| Route | Method | Mục đích | Realtime? |
|------|--------|----------|-----------|
| `/api/health` | GET | App/backend/MCP health | No |
| `/api/notebooks` | GET | List notebooks | No |
| `/api/notebooks` | POST | Add notebook metadata | No |
| `/api/notebooks/:id/select` | POST | Select active notebook | No |
| `/api/notebooks/:id` | PATCH | Update metadata | No |
| `/api/notebooks/:id` | DELETE | Remove notebook | No |
| `/api/sessions` | GET | List NotebookLM sessions | No |
| `/api/sessions/:id/reset` | POST | Reset session | No |
| `/api/sessions/:id/close` | POST | Close session | No |
| `/api/auth/setup` | POST | Open NotebookLM login | Progress via socket |
| `/api/auth/reauth` | POST | Re-auth | Progress via socket |
| `/api/ask` | POST | Ask NotebookLM | Progress via socket |
| `/api/sources` | POST | Add URL/text source | Progress via socket |
| `/api/audio/generate` | POST | Start audio overview | Progress via socket |
| `/api/audio/status` | GET | Poll audio status | Optional |
| `/api/audio/download` | POST | Download audio | Progress via socket |
| `/api/settings` | GET/PATCH | Read/update app config | No |
| `/api/updates/check` | POST | Check update | No |
| `/api/agent/chat` | POST | Agent Chat tool loop | Progress via socket |

### Socket/SSE events

| Event | Payload |
|-------|---------|
| `bridge:status` | port, mcpReady, auth, activeNotebook |
| `tool:progress` | tool, progressToken, step, current, total |
| `session:update` | sessions, active count |
| `auth:update` | authenticated, account, message |
| `audio:update` | notebookId, status, filePath |
| `log:event` | level, scope, message, meta |
| `agent:step` | thinking step, tool call, tool result/error |

## UI/UX plan

### Style copy từ reference

- Dark nền `#1a1a1a`, surface `#262626`, border `#333333`.
- Accent cam `#E56A4A`, success xanh, warning vàng, danger đỏ.
- Header có icon app, tên app, version pill bên phải.
- Layout card/panel dashboard, border nhỏ, shadow nhẹ.
- Nhiều icon button, ít paragraph.
- Input có nhiều lựa chọn phải dùng `select`, segmented control, chips hoặc icon buttons.

### Views chính

| View | Mục đích | Controls |
|------|----------|----------|
| Dashboard | Tổng quan auth, active notebook, sessions, health | Connect NotebookLM, Setup Auth, Re-auth, Open NotebookLM |
| Notebooks | Quản lý notebook library | Add URL, select active, edit metadata, tags/topics chips |
| Ask & Validate | Hỏi/validate thông tin bằng NotebookLM | notebook select, source format select, show browser toggle |
| Sources | Thêm URL/text source | type selector, title input, content textarea |
| Sessions | Xem/close/reset sessions | table/list, action icons |
| Audio | Generate/status/download Audio Overview | prompt preset select, destination chooser |
| Agent Chat | Chat tool loop điều khiển app | tool steps, copy, context meter, skill chips |
| Logs | Log manager realtime | level chips, search, pause, copy/export |
| Settings | Provider, MCP, browser, update, Codex bridge | selects/toggles, no secret in plain text |

### Version modal

- Header có pill `vX.Y.Z` ở góc phải.
- Click mở modal:
  - App name/version.
  - Current backend port.
  - Update source/repo.
  - Changelog ngắn.
  - Buttons: Check update, Download, Install, Copy diagnostics.
- Pattern lấy từ `update-client.cjs` và renderer update modal của reference.

## NotebookLM connect flow

1. User bấm icon/nút `Connect NotebookLM`.
2. Desktop bridge gọi MCP tool `get_health`.
3. Nếu chưa authenticated, hiện modal setup:
   - Browser mode: Headless / Visible.
   - Account profile select.
   - Button `Setup Auth`.
4. Backend gọi `setup_auth` với progress qua socket.
5. Sau khi auth OK, app gọi `list_notebooks` và `get_library_stats`.
6. User chọn active notebook hoặc thêm notebook URL.
7. App cho phép `Ask`, `Add Source`, `Generate Audio`, `Validate`.

## MCP adapter

Không gọi DOM NotebookLM trực tiếp từ Electron UI. Tạo `notebook-mcp-adapter.cjs` hoặc TS tương đương để:

- Gọi existing MCP tool handlers trong process nếu khả thi.
- Hoặc gọi HTTP MCP transport `/mcp` như client nội bộ.
- Chuẩn hóa output `{ ok, data, error, meta }`.
- Convert progress callback thành socket event.
- Map destructive tools thành confirm flow trong UI.

## Agent Chat trong desktop app

- Dùng OpenAI-compatible provider config giống Agent Chat extension.
- Tools nội bộ:
  - `nb_get_health`
  - `nb_setup_auth`
  - `nb_list_notebooks`
  - `nb_select_notebook`
  - `nb_ask_question`
  - `nb_add_source`
  - `nb_audio_generate`
  - `nb_audio_status`
  - `nb_audio_download`
  - `nb_logs_read`
  - `nb_update_check`
- UI hiển thị user message, assistant final, tool call input/result, observable steps, context meter, copy message/session.

## Settings cần có

| Nhóm | Config |
|------|--------|
| MCP | transport mode, HTTP port, profile, disabled tools |
| Browser | headless/visible, browser channel, timeout, session timeout |
| NotebookLM | default notebook, source format, account profile |
| Provider | base URL, model, API key secret storage |
| Agent | max loops, max tool calls, context limit, search on/off |
| Backend | bridge host/port, socket enabled, log retention |
| Update | source, GitHub repo/API base, auto-check |

Secrets phải lưu bằng `safeStorage` hoặc credential store local, không ghi vào tracked files.

## Implementation phases

### Phase 1: Bootstrap Electron shell

- Add `electron.cjs`, `preload.cjs`, `renderer/`, scripts.
- Copy style tokens/layout pattern từ reference.
- Header, dashboard shell, version pill/modal.
- App info IPC: `bridge:get-info`.

### Phase 2: Backend bridge

- Implement `notebook-bridge-server.cjs`.
- REST health/settings/log routes.
- Socket/SSE hub for progress/logs.
- Log manager and diagnostics.

### Phase 3: MCP adapter

- Wrap current NotebookLM MCP tools.
- Implement health/auth/library/session/source/audio calls.
- Convert progress to socket events.
- Handle errors/rate limits/auth requirements.

### Phase 4: NotebookLM UI workflows

- Dashboard connect/setup auth.
- Notebook library CRUD.
- Ask & validate panel.
- Sources panel.
- Audio panel.
- Sessions panel.

### Phase 5: Agent Chat desktop

- Agent tool registry from MCP adapter.
- OpenAI-compatible provider config.
- Tool loop with max loops/tool-call limits.
- UI transcript with steps/results/copy/context.

### Phase 6: Update/packaging

- Update client/modal.
- Scripts `start`, `desktop`, `check`, `package`.
- mac/win packaging plan.
- Preflight checklist.

## Acceptance criteria

- Desktop app opens with copied visual style close to reference.
- Version pill opens update/info modal.
- User can connect/setup NotebookLM from app.
- App can call at least `get_health`, `list_notebooks`, `ask_question`.
- Backend exposes API and socket/SSE progress.
- UI uses selects/toggles/chips for multi-choice inputs.
- No API key/token appears in UI logs or tracked files.
- Build/check passes.

## Risks

- Electron app uses CommonJS while current package is ESM; choose `.cjs` files for Electron main/preload/lib.
- Current MCP is TypeScript/ESM; direct import from CommonJS may be awkward. Safer first version calls compiled CLI/HTTP MCP transport internally.
- NotebookLM auth/browser automation can take minutes; UI must show progress and not block.
- Some update/packaging pieces should be copied structurally but renamed for this app.

## Recommended first implementation slice

1. Add Electron dependencies/scripts.
2. Create app shell and version modal.
3. Create bridge server with `/api/health` and `/events`.
4. Start existing MCP HTTP transport as child process or internal adapter.
5. Wire Connect NotebookLM button to `get_health` and `setup_auth`.
6. Add Notebook list and Ask panel.
