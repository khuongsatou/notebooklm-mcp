# fk-notebooklm-connect

## Mục tiêu

Chẩn đoán và ổn định kết nối NotebookLM qua extension Agent Chat và local NotebookLM desktop bridge.

## Input cần có

- Không bắt buộc.
- Nếu user muốn hỏi notebook, cần `question`.
- Nếu user có notebook cụ thể, nhận thêm `notebook_id` hoặc `notebook_url`.

## Tools được phép dùng

- `fk_notebook_status`
- `fk_notebook_doctor`
- `fk_notebook_ask_safe`
- `fk_notebook_add_source`
- `fk_open_notebooklm`
- `fk_refresh_token`

## Các bước thực thi

1. Gọi `fk_notebook_doctor` để kiểm tra bridge, MCP auth, notebook target và session capacity.
2. Nếu bridge không chạy, báo user mở desktop app hoặc kiểm tra `NotebookLM Bridge` trong Agent settings.
3. Nếu thiếu auth, hướng dẫn chạy MCP auth/reauth trong desktop bridge; có thể gọi `fk_open_notebooklm` hoặc `fk_refresh_token` để làm mới tab hệ thống.
4. Nếu user có câu hỏi và doctor sẵn sàng, gọi `fk_notebook_ask_safe` với `retry=true`.
5. Nếu user muốn thêm source, chỉ gọi `fk_notebook_add_source` sau preflight đạt.
6. Tóm tắt trạng thái, blocker và next step ngắn gọn.

## Acceptance/output format

Trả về:

- Trạng thái bridge/auth/notebook/session.
- Kết quả ask hoặc add source nếu đã chạy.
- Blocker cụ thể nếu chưa sẵn sàng.
- Next step rõ ràng.

## Rủi ro/guardrails

- Không hiển thị token, cookie, API key hoặc Authorization header.
- Không bịa kết quả NotebookLM nếu tool chưa chạy thành công.
- Không gọi add source nếu doctor báo thiếu auth hoặc thiếu notebook target.
