# 04. Phân tích chức năng, đầu vào và đầu ra

## Bảng tổng hợp tool

| STT | Tool | Nhóm | Đầu vào chính | Đầu ra chính | Tác động |
|---:|---|---|---|---|---|
| 1 | `ask_question` | Q&A | `question`, target notebook/session | `answer`, `session_id`, `sources?`, `_provenance` | Gửi câu hỏi tới NotebookLM |
| 2 | `add_notebook` | Library | URL, tên, mô tả, topics | `notebook` | Thêm metadata notebook cục bộ |
| 3 | `list_notebooks` | Library | Không có | `notebooks[]` | Đọc library |
| 4 | `get_notebook` | Library | `id` | `notebook` | Đọc một notebook |
| 5 | `select_notebook` | Library | `id` | `notebook` | Đổi active notebook |
| 6 | `update_notebook` | Library | `id` + field cần sửa | `notebook` | Sửa metadata cục bộ |
| 7 | `remove_notebook` | Library | `id` | `removed`, `closed_sessions` | Xóa metadata và đóng session liên quan |
| 8 | `search_notebooks` | Library | `query` | `notebooks[]` | Tìm metadata |
| 9 | `get_library_stats` | Library | Không có | stats | Đọc thống kê |
| 10 | `list_sessions` | Session | Không có | stats + `sessions[]` | Đọc session đang mở |
| 11 | `close_session` | Session | `session_id` | status/message | Đóng tab/session |
| 12 | `reset_session` | Session | `session_id` | status/message | Reload page, reset chat history |
| 13 | `get_health` | System | Không có | auth/config/session/library summary | Kiểm tra trạng thái |
| 14 | `setup_auth` | System | browser options | authenticated/duration | Mở login Google |
| 15 | `re_auth` | System | browser options | authenticated/duration | Xóa auth cũ, login lại |
| 16 | `cleanup_data` | System | `confirm`, `preserve_library` | preview hoặc result | Dọn dữ liệu trên máy |
| 17 | `add_source` | Sources | `type`, `content`, target notebook | `AddSourceResult` | Thêm source vào NotebookLM |
| 18 | `generate_audio` | Audio | target notebook, prompt audio? | `AudioGenerationResult` | Kích hoạt tạo audio |
| 19 | `get_audio_status` | Audio | target notebook | `AudioGenerationResult` | Kiểm tra trạng thái audio |
| 20 | `download_audio` | Audio | `destination_dir`, target notebook | `DownloadAudioResult` | Lưu file audio |

## Chi tiết `ask_question`

| Mục | Chi tiết |
|---|---|
| Đầu vào bắt buộc | `question: string` |
| Đầu vào tùy chọn | `session_id`, `notebook_id`, `notebook_url`, `source_format`, `show_browser`, `browser_options` |
| Resolve notebook | `notebook_url` > `notebook_id` > active notebook |
| Tạo session | Nếu thiếu `session_id`, tự sinh session mới |
| Cách gửi câu hỏi | Tìm `textarea.query-box-input`, dùng `humanType`, nhấn Enter |
| Cách chờ answer | `waitForStableAnswer` poll mỗi 750 ms, cần text ổn định mặc định 3 lần |
| Citation | Chỉ trích khi `source_format` khác `none` |
| Lỗi đặc biệt | Rate limit được chuyển thành thông báo gợi ý `re_auth`/chờ/upgrade |

Đầu ra `data`:

| Trường | Ý nghĩa |
|---|---|
| `status` | `"success"` |
| `question` | Câu hỏi đã gửi |
| `answer` | Câu trả lời đã thêm AI marker |
| `session_id` | Id dùng cho follow-up |
| `notebook_url` | Notebook được dùng |
| `session_info` | Tuổi session, số message, last activity |
| `_provenance` | Provider/model/via/grounding/ai_generated |
| `source_format` | Format citation hiệu lực |
| `sources` | Danh sách citation nếu có |

## Chi tiết library tools

| Tool | Hàm handler | Đầu ra thành công | Lỗi thường gặp |
|---|---|---|---|
| `add_notebook` | `handleAddNotebook` | `{ notebook }` | Ghi file library lỗi |
| `list_notebooks` | `handleListNotebooks` | `{ notebooks }` | File library hỏng |
| `get_notebook` | `handleGetNotebook` | `{ notebook }` | `Notebook not found` |
| `select_notebook` | `handleSelectNotebook` | `{ notebook }` | `Notebook not found` |
| `update_notebook` | `handleUpdateNotebook` | `{ notebook }` | `Notebook not found` |
| `remove_notebook` | `handleRemoveNotebook` | `{ removed: true, closed_sessions }` | `Notebook not found` |
| `search_notebooks` | `handleSearchNotebooks` | `{ notebooks }` | Hiếm, chủ yếu library lỗi |
| `get_library_stats` | `handleGetLibraryStats` | `LibraryStats` | Hiếm, chủ yếu library lỗi |

`NotebookEntry`:

| Trường | Ý nghĩa |
|---|---|
| `id` | Slug duy nhất |
| `url` | NotebookLM URL |
| `name` | Tên hiển thị |
| `description` | Mô tả nội dung notebook |
| `topics` | Chủ đề dùng cho search/prompt |
| `content_types` | Loại nội dung |
| `use_cases` | Khi nên dùng notebook |
| `added_at`, `last_used`, `use_count` | Theo dõi sử dụng |
| `tags` | Nhãn tùy chọn |

## Chi tiết session tools

| Tool | Đầu vào | Đầu ra | Tác động nội bộ |
|---|---|---|---|
| `list_sessions` | Không có | `active_sessions`, `max_sessions`, `session_timeout`, `oldest_session_seconds`, `total_messages`, `sessions[]` | Không đổi trạng thái |
| `close_session` | `session_id` | `status`, `message`, `session_id` | `page.close()`, xóa khỏi `Map` |
| `reset_session` | `session_id` | `status`, `message`, `session_id` | Reload page, chờ input, reset `messageCount` |

## Chi tiết system tools

| Tool | Đầu vào | Đầu ra | Điểm cần nhớ |
|---|---|---|---|
| `get_health` | Không có | `authenticated`, notebook active, session stats, config flags | Nếu chưa auth có `troubleshooting_tip` |
| `setup_auth` | `show_browser?`, `browser_options?` | `status`, `message`, `authenticated`, `duration_seconds` | Chạy login thủ công tối đa 10 phút |
| `re_auth` | `show_browser?`, `browser_options?` | Tương tự setup | Đóng tất cả session và xóa auth/profile trước |
| `cleanup_data` | `confirm`, `preserve_library?` | `preview` hoặc `result` | `confirm=false` không xóa gì |

`cleanup_data` preview:

| Trường | Ý nghĩa |
|---|---|
| `categories[]` | Nhóm path sẽ xóa |
| `totalPaths` | Tổng số path |
| `totalSizeBytes` | Tổng dung lượng |

`cleanup_data` delete result:

| Trường | Ý nghĩa |
|---|---|
| `deletedPaths[]` | Path đã xóa |
| `failedPaths[]` | Path xóa lỗi |
| `totalSizeBytes` | Dung lượng ước tính |
| `categorySummary` | Thống kê theo nhóm |

## Chi tiết source/audio tools

| Tool | Đầu vào | Đầu ra | Trạng thái/lỗi |
|---|---|---|---|
| `add_source` | `type=url/text`, `content`, `title?` | `success`, `type`, `sourceCountBefore`, `sourceCountAfter`, `message?` | Có thể lỗi nếu source count không tăng hoặc redirect notebook |
| `generate_audio` | `custom_prompt?`, `wait_for_completion?`, `timeout_ms?` | `status`, `alreadyExisted?`, `message?` | `started`, `in_progress`, `ready`, `error` |
| `get_audio_status` | target notebook/session | `status`, `message?` | `ready`, `in_progress`, `not_started`, `error` |
| `download_audio` | `destination_dir` | `success`, `filePath?`, `message?` | Lỗi nếu chưa có audio ready |

## Resources và completions

| Chức năng | Đầu vào | Đầu ra |
|---|---|---|
| List resources | Không có | Resource descriptors cho library/notebook/metadata |
| Read library | `notebooklm://library` | JSON gồm active notebook, notebooks, stats |
| Read notebook | `notebooklm://library/{id}` | JSON `NotebookEntry` |
| Read legacy metadata | `notebooklm://metadata` | Metadata active notebook |
| Complete notebook id | `argument.value` | Tối đa 50 id khớp query |

