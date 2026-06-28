# fk-runtime-start-stop

## Mục tiêu

Start, stop hoặc restart runtime bridge an toàn.

## Input cần có

- Action: `start`, `stop`, `restart`, hoặc `status`.

## Tools được phép dùng

- `fk_runtime_start_stop`
- `fk_runtime_status`

## Các bước thực thi

1. Xác định action user muốn làm.
2. Nếu action chưa rõ, hỏi lại.
3. Gọi tool điều khiển runtime.
4. Đọc lại status nếu cần xác nhận.

## Acceptance/output format

Tóm tắt action đã chạy, state mới và lỗi nếu có.

## Rủi ro/guardrails

- Không stop runtime nếu user chỉ hỏi trạng thái.
- Báo rõ khi runtime đang reconnect.
