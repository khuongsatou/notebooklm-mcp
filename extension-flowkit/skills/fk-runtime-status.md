# fk-runtime-status

## Mục tiêu

Kiểm tra trạng thái runtime, token, request queue/log và lỗi gần nhất.

## Input cần có

- Không bắt buộc.
- Có thể nhận thêm phạm vi kiểm tra nếu user nêu rõ.

## Tools được phép dùng

- `fk_runtime_status`
- `fk_request_log`

## Các bước thực thi

1. Gọi `fk_runtime_status`.
2. Nếu có lỗi hoặc user hỏi log, gọi `fk_request_log` với `action=read`.
3. Tóm tắt state, token, số success/fail và lỗi gần nhất.

## Acceptance/output format

Trả về trạng thái ngắn gọn: runtime, token, metrics, lỗi/blocker, next step.

## Rủi ro/guardrails

- Không suy đoán lỗi nếu tool result không có dữ liệu.
- Không hiển thị token hoặc secret.
