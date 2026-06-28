# fk-logs-debug

## Mục tiêu

Đọc request log, tóm tắt lỗi và đề xuất hướng fix.

## Input cần có

- Phạm vi lỗi nếu có: runtime, provider, token, request type.

## Tools được phép dùng

- `fk_request_log`
- `fk_runtime_status`
- `fk_codex_prompt`

## Các bước thực thi

1. Đọc runtime status.
2. Đọc request log gần nhất.
3. Nhóm lỗi theo type/status.
4. Đề xuất fix ngắn gọn.

## Acceptance/output format

Lỗi chính, bằng chứng từ log, nguyên nhân khả dĩ, next step.

## Rủi ro/guardrails

- Không gửi log chứa secret sang Codex bridge.
