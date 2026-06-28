# 02. Pipeline và luồng dữ liệu

## Pipeline tổng quát

```text
MCP client
  -> tools/list hoặc tools/call
  -> NotebookLMMCPServer.setupHandlers()
  -> ToolHandlers.handleX()
  -> resolve notebook URL
  -> SessionManager.getOrCreateSession()
  -> SharedContextManager.getOrCreateContext()
  -> BrowserSession.init()
  -> NotebookLM DOM action
  -> ToolResult { success, data, error }
  -> MCP content text JSON
```

## Pipeline `ask_question`

| Bước | File/hàm | Đầu vào | Xử lý | Đầu ra |
|---:|---|---|---|---|
| 1 | `index.ts` tool switch | `name="ask_question"`, `arguments` | Ép kiểu args, tạo `sendProgress` nếu có `_meta.progressToken` | Gọi handler |
| 2 | `ToolHandlers.handleAskQuestion` | `question`, `session_id?`, `notebook_id?`, `notebook_url?`, `source_format?` | Resolve notebook URL theo thứ tự: `notebook_url` > `notebook_id` > active notebook | URL notebook |
| 3 | `applyBrowserOptions` | `show_browser?`, `browser_options?` | Tạm áp cấu hình browser, sau đó restore trong `finally` | Config hiệu lực |
| 4 | `SessionManager.getOrCreateSession` | `session_id?`, URL, visibility override | Tái dùng session hoặc tạo session mới | `BrowserSession` |
| 5 | `BrowserSession.ask` | `question` | Kiểm tra auth, snapshot câu trả lời cũ, tìm chat input, gõ giống người, nhấn Enter | Câu trả lời thô |
| 6 | `waitForStableAnswer` | Page, question, ignoreTexts | Poll answer mới cho tới khi text ổn định nhiều lần | Answer đã sanitize |
| 7 | `BrowserSession.detectRateLimitError` | Page | Quét lỗi quota/rate limit | Có thể ném `RateLimitError` |
| 8 | `session.extractCitations` | Answer, `source_format` | Nếu cần, click citation marker, đọc panel nguồn | Answer đã format + `sources` |
| 9 | `applyAiMarker` | Answer | Thêm marker AI/provenance | Answer cuối |
| 10 | Handler | Session info | Đóng gói `AskQuestionResult` | `{ success: true, data }` |

## Pipeline session/browser

| Bước | Thành phần | Chi tiết |
|---:|---|---|
| 1 | Validate URL | `SessionManager` yêu cầu URL tuyệt đối bắt đầu bằng `http` |
| 2 | Sinh session id | Nếu client không truyền `session_id`, tạo id bằng `randomBytes(4).toString("hex")` |
| 3 | Đổi mode browser | Nếu `show_browser/headless` đổi, đóng tất cả session để tạo lại context |
| 4 | Giới hạn số phiên | Nếu đạt `MAX_SESSIONS`, xóa session cũ nhất |
| 5 | Tạo context | `SharedContextManager` mở persistent Chrome profile |
| 6 | Tạo tab | `BrowserSession.init()` gọi `context.newPage()` |
| 7 | Navigate | Mở notebook URL với `domcontentloaded` |
| 8 | Auth check | Kiểm tra cookie, load state, hoặc yêu cầu login |
| 9 | Restore sessionStorage | Đọc `session.json`, restore đúng origin |
| 10 | Ready check | Chờ `textarea.query-box-input` hiển thị |

## Pipeline `add_source`

| Bước | File/hàm | Đầu vào | Xử lý | Đầu ra |
|---:|---|---|---|---|
| 1 | `handleAddSource` | `type`, `content`, `title?`, target notebook | Resolve notebook và session | `BrowserSession` |
| 2 | `BrowserSession.addSource` | `AddSourceInput` | Khởi tạo session nếu cần | Page sẵn sàng |
| 3 | `openAddSourceOverlay` | Page | Dùng dialog hiện có, click Add source, hoặc fallback `?addSource=true` | Dialog nguồn |
| 4 | `pickSourceType` | `url` hoặc `text` | Click type button bằng icon/text selector | Mode nhập source |
| 5 | `fillSourceContent` | Content/title | Điền textarea/input, title riêng nếu có | Form đã điền |
| 6 | `countSources` | Page | Đếm source sidebar/header trước submit | `sourceCountBefore` |
| 7 | `confirmInsert` | Page | Click Insert/Add hoặc nhấn Enter fallback | Gửi source |
| 8 | `waitForOverlayToClose` | Page | Chờ dialog đóng | UI ổn định |
| 9 | UUID redirect check | URL trước/sau | Phát hiện NotebookLM tạo nhầm notebook mới | Lỗi rõ ràng nếu lệch |
| 10 | `waitForSourceCountIncrease` | Count trước | Poll tới 90 giây | `sourceCountAfter` |

## Pipeline Audio Overview

| Tool | Pipeline | Trạng thái đầu ra |
|---|---|---|
| `generate_audio` | Resolve notebook -> session -> `generateAudioOverview` -> nếu audio đã có thì `ready`, nếu đang chạy thì `in_progress`, nếu chưa có thì click tạo | `ready`, `started`, `in_progress`, `error` |
| `get_audio_status` | Resolve notebook -> session -> kiểm tra tile audio, spinner/phrase đang tạo | `ready`, `in_progress`, `not_started`, `error` |
| `download_audio` | Resolve notebook -> session -> xác nhận audio ready -> mở menu ba chấm -> click Download -> lưu file | `success`, `filePath` hoặc `message` |

```text
generate_audio
  -> nếu status started/in_progress
  -> poll get_audio_status mỗi khoảng 30 giây
  -> khi ready
  -> download_audio(destination_dir)
```

## Pipeline authentication

| Flow | Đầu vào | Xử lý | Đầu ra |
|---|---|---|---|
| `setup_auth` | `show_browser?`, `browser_options?` | Xóa auth cũ, mở persistent Chrome, vào Google login, chờ URL NotebookLM, lưu state | `authenticated: true/false`, `duration_seconds` |
| `re_auth` | `show_browser?`, `browser_options?` | Đóng session, xóa auth/profile, chạy setup mới | Auth mới, session cũ bị đóng |
| Runtime re-auth | Session hết hạn | Load state nếu còn hợp lệ, hoặc auto-login nếu bật env | Session tiếp tục hoặc lỗi |
| `cleanup_data` | `confirm`, `preserve_library?` | Preview hoặc xóa data/cache/log/profile | Danh sách path, bytes, lỗi nếu có |

## Pipeline resource

| Request MCP | URI | Đầu ra |
|---|---|---|
| `resources/list` | N/A | `notebooklm://library`, từng `notebooklm://library/{id}`, legacy `notebooklm://metadata` nếu có active notebook |
| `resources/read` | `notebooklm://library` | JSON gồm active notebook, notebooks, stats |
| `resources/read` | `notebooklm://library/{id}` | JSON metadata của notebook |
| `resources/read` | `notebooklm://metadata` | Metadata active notebook kiểu cũ |
| `completion/complete` | Template `notebooklm://library/{id}` | Gợi ý notebook id |

## Pipeline HTTP transport

| Route | Method | Chức năng | Điều kiện |
|---|---|---|---|
| `/healthz` | `GET` | Liveness probe | Trả `{ status: "ok", protocol: "mcp-streamable-http" }` |
| `/mcp` | `POST` | JSON-RPC MCP request/response | Request đầu tiên phải là `initialize` nếu chưa có session |
| `/mcp` | `GET` | SSE stream | Cần header `Mcp-Session-Id` |
| `/mcp` | `DELETE` | Kết thúc MCP session | Cần header `Mcp-Session-Id` |

