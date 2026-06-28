# 01. Tổng quan kiến trúc NotebookLM MCP

## Mục tiêu dự án

`notebooklm-mcp` là một MCP server cho Google NotebookLM. Server không gọi API chính thức của NotebookLM, mà điều khiển Chrome thật bằng Patchright để:

- Đăng nhập Google và lưu trạng thái trình duyệt.
- Mở notebook trong NotebookLM.
- Hỏi đáp với Gemini 2.5 dựa trên nguồn trong notebook.
- Thêm nguồn dạng URL hoặc văn bản.
- Trích dẫn citation từ DOM.
- Tạo, kiểm tra trạng thái và tải Audio Overview.
- Quản lý thư viện notebook cục bộ.

## Sơ đồ lớp chính

| Lớp | File chính | Vai trò | Ghi chú |
|---|---|---|---|
| MCP server | `src/index.ts` | Khởi tạo `Server`, đăng ký tools/resources, chọn transport `stdio` hoặc HTTP | Có `SERVER_INSTRUCTIONS` làm prompt cấp server |
| Tool schema | `src/tools/definitions/*` | Mô tả tool, input schema, annotations | Tách schema khỏi logic xử lý |
| Tool handler | `src/tools/handlers.ts` | Nhận arguments, resolve notebook/session, gọi lớp thấp hơn, đóng gói kết quả | Trả về `{ success, data, error }` |
| Session manager | `src/session/session-manager.ts` | Quản lý nhiều session, giới hạn số phiên, tự dọn phiên hết hạn | Mỗi session là một tab |
| Shared browser context | `src/session/shared-context-manager.ts` | Tạo một persistent browser context dùng chung | Giữ fingerprint ổn định |
| Browser session | `src/session/browser-session.ts` | Điều khiển một tab NotebookLM | Hỏi đáp, reset, thêm source, audio, citation |
| NotebookLM DOM modules | `src/notebooklm/*.ts` | Logic thao tác UI NotebookLM | Chat, source, audio, citations, selectors |
| Auth manager | `src/auth/auth-manager.ts` | Đăng nhập, lưu cookies/sessionStorage, kiểm tra hết hạn | Lưu `state.json` và `session.json` |
| Library manager | `src/library/notebook-library.ts` | Quản lý `library.json` cục bộ | Notebook id, metadata, active notebook |
| Resource handlers | `src/resources/resource-handlers.ts` | MCP resources cho thư viện notebook | `notebooklm://library` |
| HTTP transport | `src/transport/http.ts` | Streamable HTTP MCP transport | `POST /mcp`, `GET /healthz` |
| Settings | `src/utils/settings-manager.ts` | Profile tool: `minimal`, `standard`, `full` | Có thể tắt tool theo env hoặc file |
| Cleanup | `src/utils/cleanup-manager.ts` | Preview/xóa dữ liệu auth, profile, cache, log | Có `preserve_library` |

## Luồng khởi động server

| Bước | Thành phần | Hành động | Đầu ra |
|---:|---|---|---|
| 1 | `src/index.ts` | Đọc CLI flags, account, transport | `TransportOptions` |
| 2 | `applyAccountToConfig` | Nếu có `--account`, đổi data path sang account riêng | Config path theo account |
| 3 | `NotebookLMMCPServer` | Tạo `AuthManager`, `SessionManager`, `NotebookLibrary`, `SettingsManager` | Các manager sẵn sàng |
| 4 | `buildToolDefinitions` | Gom tool schema và dynamic description cho `ask_question` | Danh sách tool thô |
| 5 | `SettingsManager.filterTools` | Lọc tool theo profile/disabled tools | Danh sách tool active |
| 6 | `setupHandlers` | Đăng ký `tools/list`, `tools/call`, resources | MCP endpoint hoạt động |
| 7 | `start` | Chọn `stdio` hoặc HTTP | Server sẵn sàng nhận request |

## Cấu hình runtime quan trọng

| Nhóm | Biến/thuộc tính | Mặc định | Ý nghĩa |
|---|---|---:|---|
| Browser | `HEADLESS` | `true` | Chạy trình duyệt ẩn |
| Browser | `BROWSER_TIMEOUT` | `30000` ms | Timeout thao tác browser |
| Answer | `ANSWER_TIMEOUT_MS` | `600000` ms | Timeout chờ câu trả lời NotebookLM |
| Session | `MAX_SESSIONS` | `10` | Số session tối đa |
| Session | `SESSION_TIMEOUT` | `900` s | Tự đóng phiên không hoạt động |
| Auth | `AUTO_LOGIN_ENABLED` | `false` | Cho phép login bằng email/password env |
| Stealth | `STEALTH_ENABLED` | `true` | Bật hành vi giống người dùng |
| Browser channel | `BROWSER_CHANNEL` / `NOTEBOOKLM_BROWSER_CHANNEL` | `chrome` | Có fallback sang bundled Chromium |
| Tool profile | `NOTEBOOKLM_PROFILE` | `full` | Lọc tool theo profile |
| Tool disable | `NOTEBOOKLM_DISABLED_TOOLS` | rỗng | Tắt tool theo tên |
| Multi-account | `NOTEBOOKLM_ACCOUNT` hoặc `--account` | rỗng | Tách profile/account |

## Điểm thiết kế cốt lõi

| Điểm | Cách làm | Giá trị |
|---|---|---|
| Một browser context dùng chung | `SharedContextManager` tạo persistent context cho toàn bộ session | Fingerprint ổn định, ít giống bot hơn |
| Mỗi session là một tab | `BrowserSession` mở page riêng trong context chung | Giữ hội thoại riêng, vẫn dùng chung auth |
| Tool schema tách logic | `definitions/*` chỉ mô tả, `handlers.ts` xử lý | Dễ đọc, dễ thêm tool |
| Library cục bộ | `library.json` lưu notebook metadata | Host agent chọn notebook theo ngữ cảnh |
| Prompt cấp server | `SERVER_INSTRUCTIONS` trong `index.ts` | Client hiểu flow cross-tool |
| Selector registry | `selectors.ts` gom selector đa ngôn ngữ | Giảm rủi ro khi NotebookLM đổi UI |
| Async audio mặc định | `generate_audio` trả `started`, rồi poll | Tránh RPC chờ 2-10 phút |

