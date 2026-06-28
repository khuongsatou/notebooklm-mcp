# Feedback Workflow

## Mục tiêu

Thư mục `.feedback` là nơi Codex tạo, nhận và quản lý feedback khi cần giao việc hoặc phản hồi cho Antigravity.

## Cấu trúc file

| File | Mục đích |
|------|----------|
| `inbox.md` | Nơi ghi feedback mới |
| `responses.md` | Nơi ghi phản hồi chính thức gửi Antigravity |
| `action-plan.md` | Nơi chuyển feedback thành kế hoạch xử lý |
| `qa_coverage.json` | Nơi lưu coverage/checklist QA dạng JSON |

## Quy trình 4 bước xử lý feedback

1. Ghi feedback mới vào `inbox.md` với mã dạng `FB-YYYYMMDD-AREA-001`.
2. Đánh giá feedback và ghi quyết định trong `responses.md`.
3. Nếu chấp nhận, chuyển thành task trong `action-plan.md`.
4. Cập nhật trạng thái đến khi `Done` và giữ lại lịch sử xử lý.
