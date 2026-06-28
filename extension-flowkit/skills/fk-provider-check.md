# fk-provider-check

## Mục tiêu

Kiểm tra provider/model/base URL/config hiện tại.

## Input cần có

- Không bắt buộc.

## Tools được phép dùng

- `fk_provider_check`

## Các bước thực thi

1. Gọi `fk_provider_check`.
2. Kiểm tra base URL, model, API key configured/missing, context limit.
3. Tóm tắt config và next step nếu thiếu.

## Acceptance/output format

Provider status, model, key status, context limit, Codex bridge URL.

## Rủi ro/guardrails

- Không hiển thị API key thật.
