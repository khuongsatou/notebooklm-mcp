# fk-speech-test

## Mục tiêu

Test voice/TTS và audio queue nếu local bridge hỗ trợ.

## Input cần có

- Câu test voice/TTS nếu có.
- Engine hoặc voice name nếu user chỉ định.

## Tools được phép dùng

- `fk_bridge_request`
- `fk_codex_prompt`
- `fk_request_log`

## Các bước thực thi

1. Kiểm tra runtime/log nếu user muốn debug.
2. Nếu có endpoint bridge, gọi bridge với action speech test.
3. Nếu chưa có endpoint thật, tạo checklist test và báo rõ giới hạn.

## Acceptance/output format

Pass/fail, lỗi quan sát được, bước xử lý tiếp theo.

## Rủi ro/guardrails

- Không giả lập kết quả TTS nếu tool không trả dữ liệu.
