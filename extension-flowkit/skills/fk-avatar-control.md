# fk-avatar-control

## Mục tiêu

Điều khiển avatar/overlay/speech bubble/idle activity nếu local bridge hỗ trợ.

## Input cần có

- Action mong muốn: show, hide, set action, speech bubble, idle.
- Tham số phụ như text hoặc action name.

## Tools được phép dùng

- `fk_bridge_request`
- `fk_runtime_status`

## Các bước thực thi

1. Xác định action và tham số.
2. Kiểm tra runtime nếu cần.
3. Gọi bridge endpoint phù hợp nếu có.
4. Tóm tắt kết quả.

## Acceptance/output format

Action đã thực hiện, trạng thái overlay/avatar và lỗi nếu có.

## Rủi ro/guardrails

- Nếu chưa có bridge endpoint, trả action plan thay vì bịa kết quả.
