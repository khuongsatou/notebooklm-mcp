# fk-chat-send

## Mục tiêu

Gửi message vào manual/companion chat pipeline backend hiện có.

## Input cần có

- Message cần gửi.
- Model nếu user chỉ định.

## Tools được phép dùng

- `fk_chat_send`

## Các bước thực thi

1. Trích message sau command.
2. Gọi `fk_chat_send`.
3. Đọc response backend.
4. Tóm tắt response hoặc lỗi.

## Acceptance/output format

Trả về kết quả từ manual chat backend và trạng thái HTTP nếu có.

## Rủi ro/guardrails

- Không gửi secret vào manual chat.
- Nếu backend chưa chạy, báo lỗi rõ ràng.
