# 03. Prompt, hướng dẫn MCP và schema tool

## Các lớp prompt/hướng dẫn trong server

| Lớp prompt | Vị trí | Ai đọc | Mục đích |
|---|---|---|---|
| Server instructions | `SERVER_INSTRUCTIONS` trong `src/index.ts` | MCP client/host agent khi initialize | Hướng dẫn flow tổng thể, ID flow, audio async, giới hạn |
| Tool description | `src/tools/definitions/*.ts` | MCP client/LLM khi chọn tool | Giải thích từng tool, khi dùng, ràng buộc |
| Dynamic `ask_question` description | `buildAskQuestionDescription(library)` | MCP client/LLM | Thay đổi theo active notebook |
| Resource description | `src/resources/resource-handlers.ts` | MCP client/LLM | Mô tả thư viện notebook và nhắc hỏi quyền người dùng |
| AI marker/provenance | `src/utils/disclaimer.ts`, dùng trong handler | Người nhận câu trả lời | Gắn nhãn câu trả lời là AI-generated từ NotebookLM |
| Progress message | `sendProgress` trong `src/index.ts` và handlers | MCP client UI | Cập nhật tiến trình tool dài |

## Server instructions: ý đồ prompt

| Phần | Nội dung chính | Tác dụng |
|---|---|---|
| First-run flow | `get_health` -> `setup_auth` -> `add_notebook` -> `ask_question` | Giúp agent tự biết thứ tự setup |
| Notebook ID flow | `list/search/get` trả `id`, dùng cho `select/update/remove/ask/add_source/audio` | Tránh nhầm id với URL |
| Session ID flow | `ask_question` trả `session_id`, tái dùng cho follow-up | Giữ context hội thoại |
| Source ingestion | `add_source` một lần mỗi source, chờ index 5-30 giây | Đặt kỳ vọng đúng cho người dùng |
| Audio async chain | `generate_audio` -> poll `get_audio_status` -> `download_audio` | Tránh chờ RPC quá lâu |
| Constraints | Free quota, session timeout, loại source chưa hỗ trợ | Giảm ảo tưởng năng lực |

## Dynamic prompt của `ask_question`

Khi có active notebook, description được dựng từ metadata trong `library.json`:

| Trường notebook | Dùng trong prompt như thế nào |
|---|---|
| `name` | Hiển thị `Active Notebook` |
| `description` | Hiển thị phần `Content` |
| `topics` | Hiển thị phần `Topics` |
| `use_cases` | Chuyển thành danh sách `When To Use` |
| `id` | Nêu notebook mặc định trong `Notebook Selection` |

Khi chưa có active notebook, prompt chuyển sang hướng dẫn:

- Tạo notebook ở `https://notebooklm.google`.
- Dùng `add_notebook`.
- Dùng `list_notebooks`.
- Dùng `select_notebook`.
- Hỏi người dùng notebook nào cần dùng.

## Nguyên tắc prompt trong tool description

| Tool/nhóm | Nguyên tắc prompt | Lợi ích |
|---|---|---|
| `add_notebook` | Không gọi khi chưa được người dùng xác nhận | Tránh tự ý lưu URL/metadata |
| `update_notebook` | Đề xuất thay đổi rồi chờ xác nhận | Tránh sửa metadata ngoài ý muốn |
| `remove_notebook` | Nhắc xác nhận vì đóng session liên quan | An toàn dữ liệu cục bộ |
| `cleanup_data` | Hai pha preview/delete | Giảm rủi ro xóa nhầm |
| `ask_question` | Tái dùng session cho cùng nhiệm vụ | Tăng chất lượng trả lời từ NotebookLM |
| `generate_audio` | Mô tả rõ async by default | Tránh agent tưởng audio đã tải xong |
| Resources | Nhắc hỏi quyền trước khi tham khảo notebook nếu task không nêu rõ | Tôn trọng quyền kiểm soát của người dùng |

## Schema input theo nhóm

### Nhóm hỏi đáp

| Tool | Required | Optional | Ghi chú |
|---|---|---|---|
| `ask_question` | `question` | `session_id`, `notebook_id`, `notebook_url`, `source_format`, `show_browser`, `browser_options` | `notebook_url` override `notebook_id`; default dùng active notebook |

`source_format`:

| Giá trị | Ý nghĩa | Khi dùng |
|---|---|---|
| `none` | Không trích citation | Chat nhanh |
| `inline` | Thay `[N]` bằng đoạn nguồn inline | Đọc trực tiếp cho người |
| `footnotes` | Thêm block `Sources:` cuối answer | Báo cáo dễ đọc |
| `json` | Answer giữ nguyên, citations nằm trong `sources` | Pipeline xử lý programmatic |

### Nhóm library

| Tool | Required | Optional |
|---|---|---|
| `add_notebook` | `url`, `name`, `description`, `topics` | `content_types`, `use_cases`, `tags` |
| `list_notebooks` | Không có | Không có |
| `get_notebook` | `id` | Không có |
| `select_notebook` | `id` | Không có |
| `update_notebook` | `id` | `name`, `description`, `topics`, `content_types`, `use_cases`, `tags`, `url` |
| `remove_notebook` | `id` | Không có |
| `search_notebooks` | `query` | Không có |
| `get_library_stats` | Không có | Không có |

### Nhóm session

| Tool | Required | Optional | Tác động |
|---|---|---|---|
| `list_sessions` | Không có | Không có | Read-only |
| `close_session` | `session_id` | Không có | Đóng tab/session |
| `reset_session` | `session_id` | Không có | Reload tab, xóa chat history cục bộ |

### Nhóm system

| Tool | Required | Optional | Tác động |
|---|---|---|---|
| `get_health` | Không có | Không có | Read-only |
| `setup_auth` | Không có | `show_browser`, `browser_options` | Mở browser login, xóa auth cũ trong `performSetup` |
| `re_auth` | Không có | `show_browser`, `browser_options` | Đóng session, xóa auth/profile, login lại |
| `cleanup_data` | `confirm` | `preserve_library` | Preview hoặc xóa data/cache/log/profile |

### Nhóm source/audio

| Tool | Required | Optional | Ghi chú |
|---|---|---|---|
| `add_source` | `type`, `content` | `title`, `session_id`, `notebook_id`, `notebook_url`, `show_browser` | `type` chỉ hỗ trợ `url` và `text` |
| `generate_audio` | Không có | `custom_prompt`, `timeout_ms`, `wait_for_completion`, target notebook/session, `show_browser` | Async mặc định |
| `get_audio_status` | Không có | target notebook/session, `show_browser` | Poll an toàn |
| `download_audio` | `destination_dir` | target notebook/session, `show_browser` | Nên truyền absolute path |

## Output wrapper thống nhất

Mọi tool call ở tầng MCP trả `content` dạng text JSON. Bên trong JSON là wrapper:

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `success` | boolean | Tool thành công hay thất bại logic |
| `data` | object | Payload khi thành công |
| `error` | string | Lỗi khi thất bại |

Ví dụ khung:

```json
{
  "success": true,
  "data": {
    "status": "success"
  }
}
```

## MCP annotations

| Annotation | Ý nghĩa | Ví dụ tool |
|---|---|---|
| `readOnlyHint` | Tool chỉ đọc | `get_health`, `list_sessions`, `list_notebooks` |
| `destructiveHint` | Có thể phá hủy/xóa/đóng trạng thái | `remove_notebook`, `close_session`, `cleanup_data`, `re_auth` |
| `idempotentHint` | Gọi lại thường không tạo thêm tác động mới | `select_notebook`, `generate_audio`, `download_audio` |
| `openWorldHint` | Tool tương tác với hệ thống bên ngoài | `ask_question`, `setup_auth`, `add_source`, audio tools |

