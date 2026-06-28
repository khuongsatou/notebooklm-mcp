# Skill Pack: Agent Chat

## Mục tiêu

Vận hành Agent Chat cho extension hiện tại: chat tự nhiên, tool calling, context management, Agent Search, custom skills và Codex CLI bridge.

## Command prefix

Tất cả skill dành cho extension dùng prefix `fk-*` để phân biệt với skill vận hành trong `.agent`.

## Skills chính

- `fk-runtime-status`
- `fk-runtime-start-stop`
- `fk-chat-send`
- `fk-speech-test`
- `fk-avatar-control`
- `fk-music-control`
- `fk-config-update`
- `fk-logs-debug`
- `fk-provider-check`
- `fk-release-qa`

## Guardrails

- Không hardcode hoặc hiển thị API key/token.
- Khi action có tool thật và đủ thông tin, gọi tool thay vì chỉ mô tả.
- Không bịa kết quả tool.
- Luôn đọc tool result trước khi kết luận.
