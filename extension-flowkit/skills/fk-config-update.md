# fk-config-update

## Mục tiêu

Đọc/cập nhật config Agent Chat an toàn, không ghi secret.

## Input cần có

- Key config và value cần đổi.

## Tools được phép dùng

- `fk_provider_check`
- `fk_bridge_request`

## Các bước thực thi

1. Kiểm tra config hiện tại nếu user yêu cầu.
2. Chỉ cập nhật key không nhạy cảm.
3. Test lại provider nếu đổi base URL/model.

## Acceptance/output format

Config đã đổi, trạng thái test nếu có, cảnh báo nếu cần.

## Rủi ro/guardrails

- Không đọc/ghi API key bằng markdown skill.
- Không in secret ra UI/log.
