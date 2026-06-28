# fk-music-control

## Mục tiêu

List/start/stop background music nếu backend hỗ trợ.

## Input cần có

- Action: list, start, stop.
- Track name nếu start track cụ thể.

## Tools được phép dùng

- `fk_bridge_request`
- `fk_runtime_status`

## Các bước thực thi

1. Xác định action âm nhạc.
2. Gọi bridge nếu action rõ.
3. Đọc result trước khi kết luận.
4. Tóm tắt trạng thái nhạc.

## Acceptance/output format

Track/action/status/error.

## Rủi ro/guardrails

- Không bịa danh sách track nếu tool không trả.
