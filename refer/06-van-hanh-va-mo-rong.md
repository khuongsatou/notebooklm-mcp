# 06. Vận hành, cấu hình và mở rộng

## Cách chạy

| Mục đích | Lệnh |
|---|---|
| Chạy stdio MCP | `node dist/index.js` |
| Chạy HTTP MCP | `node dist/index.js --transport http --port 3000 --host 127.0.0.1` |
| Chạy từ package | `npx notebooklm-mcp@latest` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Format check | `npm run format:check` |
| Full check | `npm run check` |

## Kết nối MCP client

| Client | Cấu hình/lệnh |
|---|---|
| Codex CLI local clone | `codex mcp add notebooklm node /Users/apple/Desktop/ex_project_8/mtips5s_mcp_ml/dist/index.js` |
| Codex CLI package | `codex mcp add notebooklm npx notebooklm-mcp@latest` |
| HTTP client | Khởi động HTTP, gửi JSON-RPC tới `POST /mcp` |

## Flow vận hành khuyến nghị

| Bước | Tool | Mục tiêu |
|---:|---|---|
| 1 | `get_health` | Kiểm tra auth, active notebook, session |
| 2 | `setup_auth` nếu chưa auth | Đăng nhập Google và lưu cookies |
| 3 | `add_notebook` | Đăng ký NotebookLM share URL vào library |
| 4 | `select_notebook` | Chọn notebook mặc định |
| 5 | `ask_question` | Hỏi câu đầu, lấy `session_id` |
| 6 | `ask_question` với cùng `session_id` | Follow-up theo cùng ngữ cảnh |
| 7 | `add_source` nếu cần | Thêm URL/text vào notebook |
| 8 | `generate_audio` | Kích hoạt Audio Overview |
| 9 | `get_audio_status` | Poll cho tới `ready` |
| 10 | `download_audio` | Tải file audio |

## Vị trí dữ liệu trên macOS

| Dữ liệu | Đường dẫn mặc định |
|---|---|
| Data dir | `~/Library/Application Support/notebooklm-mcp/` |
| Chrome profile | `~/Library/Application Support/notebooklm-mcp/chrome_profile/` |
| Browser state | `~/Library/Application Support/notebooklm-mcp/browser_state/` |
| Library | `~/Library/Application Support/notebooklm-mcp/library.json` |
| Settings | `~/Library/Preferences/notebooklm-mcp/settings.json` |
| Multi-account | `~/Library/Application Support/notebooklm-mcp/accounts/<account>/` |

## Profile tool

| Profile | Tool được bật | Khi dùng |
|---|---|---|
| `minimal` | `ask_question`, `get_health`, `list_notebooks`, `select_notebook`, `get_notebook` | Giảm token/tool surface |
| `standard` | Minimal + auth/session/library cơ bản | Dùng thường ngày, ít tool phá hủy |
| `full` | Tất cả tool | Phát triển, debug, source/audio/cleanup |

Lệnh cấu hình:

```bash
node dist/index.js config get
node dist/index.js config set profile standard
node dist/index.js config set disabled-tools cleanup_data,re_auth
node dist/index.js config reset
```

## Quy tắc thêm tool mới

| Bước | Việc cần làm | File liên quan |
|---:|---|---|
| 1 | Thêm tool definition với schema và annotations | `src/tools/definitions/*.ts` |
| 2 | Export/gom vào danh sách tool | `src/tools/definitions.ts` |
| 3 | Thêm case trong MCP switch | `src/index.ts` |
| 4 | Thêm handler logic | `src/tools/handlers.ts` |
| 5 | Nếu cần browser action, thêm module ở `src/notebooklm/` | `src/notebooklm/*.ts` |
| 6 | Nếu cần selector mới, thêm vào registry | `src/notebooklm/selectors.ts` |
| 7 | Cập nhật server instructions nếu là cross-tool flow mới | `src/index.ts` |
| 8 | Chạy build/lint/smoke | `npm run build`, `npm run lint` |

## Quy tắc thêm NotebookLM DOM action

| Nguyên tắc | Lý do |
|---|---|
| Ưu tiên selector class/icon ổn định trước text theo locale | UI đa ngôn ngữ dễ đổi nhãn |
| Gom selector vào `selectors.ts` | Dễ cập nhật khi UI đổi |
| Tạo hàm thao tác ở module riêng | Tránh làm `BrowserSession` phình to |
| Có timeout và fallback | DOM NotebookLM có animation/network delay |
| Trả lỗi rõ ràng thay vì im lặng | Agent/client biết bước nào thất bại |
| Nếu thao tác lâu, thiết kế async/poll | MCP call dài dễ timeout |

## Quy tắc sửa prompt/tool description

| Việc nên làm | Lý do |
|---|---|
| Đặt flow cross-tool ở `SERVER_INSTRUCTIONS` | Tránh lặp trong từng tool |
| Giữ description từng tool tập trung vào một hành động | Giảm nhiễu khi model chọn tool |
| Nêu rõ precondition/postcondition | Ví dụ `download_audio` cần audio `ready` |
| Nêu rõ destructive/idempotent annotation | Giúp MCP client lập kế hoạch an toàn |
| Không hứa chức năng chưa có | File/YouTube/Drive source chưa hỗ trợ |

## Checklist smoke test sau thay đổi

| STT | Kiểm tra | Kỳ vọng |
|---:|---|---|
| 1 | `npm run build` | TypeScript build thành công |
| 2 | `npm run lint` | Không error |
| 3 | Start HTTP | Server in `/mcp` và `/healthz` |
| 4 | `curl /healthz` | JSON `status=ok` |
| 5 | MCP `tools/list` | Tool mới/xóa/lọc đúng profile |
| 6 | `get_health` | Không crash khi chưa auth |
| 7 | Nếu sửa browser action | Test với `show_browser=true` | Quan sát UI thật |
| 8 | Nếu sửa cleanup/auth | Luôn test preview trước | Không xóa nhầm library |

## Gợi ý tài liệu tiếp theo

| Tài liệu | Nội dung nên bổ sung |
|---|---|
| `07-selector-map.md` | Bảng mapping selector theo chức năng UI |
| `08-test-plan.md` | Test case thủ công và tự động cho từng tool |
| `09-api-contract.md` | Contract JSON đầy đủ cho từng tool result |
| `10-troubleshooting.md` | Lỗi thường gặp: Chrome lock, auth expired, rate limit, NotebookLM UI đổi |

