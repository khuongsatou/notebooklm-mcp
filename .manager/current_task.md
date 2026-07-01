# Current Task

## Status

- State: In Progress — Adding YouTube sources to NotebookLM
- Owner: Project Manager
- Priority: High
- Started At: 2026-06-29

## Task

Tạo notebook NotebookLM phân tích video YouTube "Vì sao lại chơi GAME LẬU? | Giải Mã Bí Ẩn" (Game Cực Hay), lấy transcript, validate nội dung, và add source vào notebook qua MCP.

**Notebook:** https://notebooklm.google.com/notebook/1b5ce23a-319e-4aaf-94bf-6c31e7623962

## Scope

- [x] Kết nối NotebookLM qua System Chrome Profile 185
- [x] MCP authenticate (patchright browser)
- [x] Đăng ký notebook vào MCP library
- [x] Lấy transcript YouTube bằng yt-dlp
- [x] Validate 20/20 yếu tố nội dung (100%)
- [ ] Add source YouTube URL vào notebook (MCP browser đang xử lý)
- [ ] Add source transcript text vào notebook (MCP browser đang xử lý)

## Next Action

Chờ 2 MCP browser sessions hoàn tất add_source. Sau đó dùng `ask_question` để query notebook và validate qua NotebookLM Gemini.

## PM Progress Snapshot - 2026-07-01

- Overall state: In Progress.
- Desktop/bridge baseline: implemented and previously smoke-tested.
- Current code delta: NotebookLM safe runner hardening is staged locally through `lib/notebook-safe-runner.cjs`, `/api/doctor`, `/api/ask-safe`, IPC/preload exposure, Agent tool additions `nb_doctor` and `nb_ask_safe`, renderer safe ask fallback, and browser timeout propagation in `src/config.ts`.
- Verification today: `npm run build` passed; `npm run check:desktop` passed.
- Open tracked changes: `electron.cjs`, `lib/agent-chat.cjs`, `lib/agent-tools.cjs`, `lib/notebook-bridge-server.cjs`, `package.json`, `preload.cjs`, `renderer/renderer.js`, `src/config.ts`.
- Open untracked files: `.codex/skills/it-roles/SKILL.md`, `lib/notebook-safe-runner.cjs`, `curl/session.txt`.
- Security risk: `curl/session.txt` contains live-looking cookie/session/access token material and must not be committed; remove/ignore it and rotate credentials if it has left the local machine.
- Remaining blocker: no fresh evidence yet that the 2 pending NotebookLM `add_source` browser sessions completed or that `ask_question` validated the final notebook contents.

## Implementation Snapshot - 2026-07-01 Extension Stable NotebookLM Connection

- Added REQ-008 for stable NotebookLM connection through extension Agent Chat.
- Extension Agent settings now include NotebookLM Bridge URL and request timeout.
- Added `Test NotebookLM` action that runs bridge doctor from the side panel.
- Added Agent tools: `fk_notebook_status`, `fk_notebook_doctor`, `fk_notebook_ask_safe`, `fk_notebook_add_source`.
- Added packaged skill `/fk-notebooklm-connect`.
- Verification: extension JS syntax checks passed; `npm run build` passed; `npm run check:desktop` passed.
- Remaining manual work: reload Chrome extension, start desktop bridge, run real doctor/ask-safe/add-source against authenticated NotebookLM.
