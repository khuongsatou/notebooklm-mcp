# 05. Điểm hay, rủi ro và hướng cải tiến

## Điểm hay nổi bật

| STT | Điểm hay | Vị trí | Vì sao tốt |
|---:|---|---|---|
| 1 | Persistent browser context dùng chung | `SharedContextManager` | Giữ cookies/fingerprint ổn định, giống một người dùng thật mở nhiều tab |
| 2 | Tách schema tool khỏi handler | `src/tools/definitions/*` và `handlers.ts` | Dễ đọc, dễ bảo trì, dễ thêm tool |
| 3 | Prompt cấp server rõ flow | `SERVER_INSTRUCTIONS` | Host agent biết thứ tự setup, session id, notebook id, audio async |
| 4 | Dynamic description theo active notebook | `buildAskQuestionDescription` | Tool tự mô tả đúng notebook đang dùng |
| 5 | Chờ answer bằng ổn định text | `waitForStableAnswer` | Ít phụ thuộc loading selector dễ thay đổi |
| 6 | Sanitize UI control leak | `sanitizeAnswer` | Loại `more_vert`, `content_copy`, marker rác khỏi answer |
| 7 | Citation DOM-level | `citations.ts` | Không bắt LLM tự bịa citation, đọc marker và panel nguồn từ UI |
| 8 | Selector registry tập trung | `selectors.ts` | Một nơi quản lý class/icon/locale fallback |
| 9 | Source insert xác minh bằng count | `sources.ts` | Có `sourceCountBefore/After`, không chỉ tin click thành công |
| 10 | Audio async mặc định | `audio.ts` | Không khóa MCP call nhiều phút |
| 11 | Cleanup hai pha | `cleanup_data` | Preview trước khi xóa thật |
| 12 | Multi-account path isolation | `account-switcher.ts` | Mỗi account có profile/auth/library riêng |
| 13 | HTTP transport không cần Express | `transport/http.ts` | Ít dependency, gọn |
| 14 | Browser channel fallback | `chromium-fallback.ts` | Nếu system Chrome lỗi thì dùng bundled Chromium |
| 15 | Watchdog chống page treo | `watchdog.ts` | Tránh busy loop và detect renderer chết |

## Rủi ro kỹ thuật

| Rủi ro | Mức độ | Nguyên nhân | Tác động | Gợi ý giảm rủi ro |
|---|---|---|---|---|
| NotebookLM đổi UI/selector | Cao | Dựa vào DOM automation | Tool hỏi/source/audio có thể lỗi | Thêm test smoke với selector, cập nhật `selectors.ts` |
| Auth Google thay đổi hoặc challenge | Cao | Google login có 2FA/CAPTCHA/challenge | `setup_auth`/auto-login thất bại | Ưu tiên manual login, log rõ screenshot/debug |
| Cookie state bị xem là hết hạn sau 24h | Trung bình | `isStateExpired` dùng tuổi file | Có thể yêu cầu auth lại dù cookie còn sống | Cân nhắc validate cookie trước khi xét tuổi file |
| Mutate global `CONFIG` tạm thời | Trung bình | Handler dùng `Object.assign(CONFIG, effectiveConfig)` | Concurrent tool call có thể ảnh hưởng nhau | Truyền config xuống session/page thay vì global mutable |
| Một context chung cho mọi session | Trung bình | Đổi headless phải đóng tất cả session | `show_browser` có thể phá session đang chạy | Queue/lock khi đổi visibility |
| Cleanup deep rộng | Trung bình | Tìm cả cache/log/editor/trash | Người dùng có thể xóa nhiều hơn kỳ vọng | Luôn dùng preview và mô tả đường dẫn rõ |
| `generate_audio` idempotent theo UI tile | Trung bình | Nếu UI hiển thị tile cũ | Không tạo audio mới khi người dùng muốn regenerate | Thêm option `force_regenerate` nếu UI hỗ trợ |
| `add_source` chỉ dựa source count | Trung bình | Count tăng chậm hoặc header/sidebar lệch | False negative | Sau 90 giây có thể trả `pending` thay vì `false` |
| Auto-login bằng env password | Trung bình | Lưu credential trong env | Rủi ro bảo mật | Khuyến nghị manual login, tránh lưu mật khẩu |
| HTTP transport thiếu auth layer | Trung bình | Bind host tùy chọn | Nếu mở `0.0.0.0` trên mạng không tin cậy có rủi ro | Chỉ bind localhost hoặc đặt reverse proxy auth |

## Rủi ro trải nghiệm

| Vấn đề | Biểu hiện | Gợi ý cải thiện |
|---|---|---|
| Tool trả JSON text thay vì structured content | Client/agent phải parse text | Nếu MCP SDK hỗ trợ, trả thêm structured content |
| Lỗi format/check từ upstream | `npm run check` fail ở Prettier | Chạy `prettier --write src` nếu muốn CI sạch |
| Nhiều log emoji/ANSI | Log dễ đọc với người, nhưng có thể ồn trong MCP log | Có mode `LOG_STYLE=plain` hoặc log level |
| `setup_auth` description nói "returns immediately" nhưng handler chờ login | Tài liệu/tool description hơi lệch thực tế | Sửa description cho khớp: tool chờ tối đa 10 phút |
| `browser_options.timeout_ms` chỉ map `browserTimeout`, không trực tiếp `answerTimeoutMs` | Người dùng tưởng tăng timeout answer | Tách `answer_timeout_ms` rõ ràng trong schema |

## Cơ hội cải tiến chức năng

| Ưu tiên | Cải tiến | Lợi ích |
|---|---|---|
| Cao | Thêm test smoke cho `get_health`, tool schema, HTTP initialize | Bảo vệ server khi refactor |
| Cao | Tạo abstraction `NotebookTargetResolver` thay vì method riêng trong handler | Tránh lặp resolve notebook cho tool mới |
| Cao | Thêm lock khi mutate `CONFIG` hoặc bỏ mutate global | An toàn concurrent tool calls |
| Trung bình | Thêm `answer_timeout_ms` vào `ask_question` schema | Điều khiển timeout chính xác |
| Trung bình | Thêm trạng thái `pending_indexing` cho `add_source` | Giảm false negative khi NotebookLM crawl chậm |
| Trung bình | Thêm tool file upload/Youtube/Drive nếu UI ổn định | Mở rộng use case thực tế |
| Trung bình | Thêm `force_regenerate_audio` | Chủ động tạo lại audio |
| Thấp | Xuất OpenAPI-like docs từ tool schema | Tự động đồng bộ tài liệu |
| Thấp | Thêm telemetry local về selector failure | Dễ biết UI nào hay gãy |

## Đánh giá prompt/pipeline

| Hạng mục | Điểm mạnh | Điểm cần chú ý |
|---|---|---|
| Server instructions | Hướng dẫn cross-tool rất rõ | Nên giữ ngắn nếu client bị hạn chế context |
| Dynamic tool description | Tận dụng metadata notebook | Metadata nhập kém sẽ làm prompt kém |
| Confirmation workflow | Giảm hành động nhạy cảm tự phát | Chỉ là prompt-level, không enforce ở code |
| AI provenance | Nhắc đây là output AI từ tài liệu người dùng | Không ngăn prompt injection trong nguồn, chỉ cảnh báo |
| Citation extraction | Đọc DOM thật | Phụ thuộc marker/panel của UI |
| Audio workflow | Async đúng thực tế | Cần agent nhớ poll, không tự động nền |

## Các điểm cần kiểm tra khi vận hành

| Kiểm tra | Lệnh/tool | Kỳ vọng |
|---|---|---|
| Build | `npm run build` | Không lỗi TypeScript |
| Lint | `npm run lint` | Không error, warning có thể còn |
| HTTP health | `node dist/index.js --transport http --port 3000` rồi `GET /healthz` | `{ status: "ok" }` |
| Auth | `get_health` | `authenticated=true` sau `setup_auth` |
| Library | `list_notebooks` | Có notebook đã đăng ký |
| Chat | `ask_question` | Trả answer và `session_id` |
| Citation | `ask_question(source_format="json")` | Có `sources` nếu NotebookLM trả marker |
| Audio | `generate_audio` -> `get_audio_status` -> `download_audio` | File audio lưu thành công |

