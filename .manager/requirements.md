# Requirements

## Product Owner Output

| ID | Requirement | Acceptance Criteria | Priority | Notes |
|----|-------------|---------------------|----------|-------|
| REQ-001 | Agent Chat tách riêng manual chat và mở bằng floating action button ở mọi tab trong side panel. | Có nút nổi mở/đóng Agent Chat, manual chat cũ vẫn còn. | High | Không phá chat hiện có. |
| REQ-002 | Agent Chat dùng OpenAI-compatible API từ config/storage. | Base URL, API key, model, max loop, context limit cấu hình được và có nút test connection. | High | Không hardcode secret. |
| REQ-003 | Backend/main process của extension chạy agentic tool loop. | LLM nhận tools, gọi tool thật, append result, lặp đến final hoặc max loop. | High | Chạy trong background service worker. |
| REQ-004 | UI hiển thị user, assistant, thinking/steps, tool call name, input, result/error, running state. | Mỗi session thấy được tool calls/results và final answer có markdown đẹp, không raw. | High | Có copy từng message và copy session. |
| REQ-005 | Có skills `fk-*`, gợi ý dưới header và tạo skill riêng. | Skill library có my/community/system, tạo skill mới lưu local `my-skills`. | Medium | Skill chưa có handler được inject vào prompt. |
| REQ-006 | Có context size management. | Hiển thị estimated context/current limit, tự cắt/summarize khi vượt ngưỡng. | Medium | Dùng estimate token theo heuristic client-side. |
| REQ-007 | Có Agent Search và Codex CLI bridge. | Agent gọi được web search tool và gửi prompt đến Codex bridge URL cấu hình được. | Medium | Codex bridge cần local endpoint bên ngoài extension. |

## Assumptions

- Extension background service worker được xem là backend/main process cho Agent Chat.
- API key được lưu trong `chrome.storage.local`, không ghi vào file tracked.
- Web search dùng DuckDuckGo Instant Answer API làm tool không cần key.
- Codex CLI không thể spawn trực tiếp từ Chrome extension, nên dùng bridge URL local.

## Customer Review Needed

- UI review: Có.
- Function review: Có.
