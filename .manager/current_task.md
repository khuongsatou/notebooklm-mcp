# Current Task

## Status

- State: Implemented / Needs UX Review
- Owner: Project Manager
- Priority: High
- Started At: 2026-06-28

## Task

Triển khai desktop app Electron cho NotebookLM MCP dựa trên reference `mtips5s_profile_pro`, gồm UI/UX, backend bridge, API/SSE, version update modal, NotebookLM connect flow, Agent Chat và settings.

Update mới:
- Thêm tab `Questions` và `Workspace` để duyệt/xem/copy nội dung từ thư mục `questions/` và `workspace/`.
- Nút `Connect` ưu tiên focus/mở NotebookLM trong Chrome profile hệ thống đã login/nhúng extension, tránh tự mở profile auth riêng của MCP.

## Scope

- In scope: Electron shell, preload IPC, renderer dashboard/views, bridge server, MCP HTTP adapter, SSE events, NotebookLM workflows, System Chrome connect flow, Agent Chat, Questions/Workspace content viewer, update modal, settings/secret storage, scripts.
- Out of scope: Signed/notarized production installer; current packaging creates a local runnable app bundle.

## Next Action

Customer/UX Reviewer mở `npm run desktop` hoặc app bundle trong `release/` để kiểm tra trực quan app Electron và flow đăng nhập NotebookLM thật.
