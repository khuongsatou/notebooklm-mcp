# fk-release-qa

## Mục tiêu

Chạy checklist QA phù hợp trước release.

## Input cần có

- Phạm vi release nếu user nêu rõ.

## Tools được phép dùng

- `fk_release_qa`
- `fk_runtime_status`
- `fk_request_log`
- `fk_provider_check`

## Các bước thực thi

1. Chạy `fk_release_qa`.
2. Đọc các check pass/fail.
3. Nếu fail, nêu blocker.
4. Nếu pass, tóm tắt rủi ro còn lại.

## Acceptance/output format

Checklist dạng pass/fail, evidence, decision release.

## Rủi ro/guardrails

- Không đánh dấu release OK nếu provider/runtime không kiểm tra được.
