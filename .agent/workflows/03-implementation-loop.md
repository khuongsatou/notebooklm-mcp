# Workflow: Implementation Loop

## Mục tiêu

Triển khai thay đổi theo yêu cầu đã duyệt.

## Các bước

1. Developer đọc `.manager/current_task.md` và `.manager/requirements.md`.
2. Áp dụng Rule Splitting File nếu task hoặc file lớn.
3. Thực hiện thay đổi nhỏ theo từng requirement.
4. Ghi file đã sửa, quyết định kỹ thuật và rủi ro vào `.manager/implementation.md`.
5. Chuyển sang QA khi build hoặc kiểm tra cơ bản qua.

## Done khi

Implementation map được về requirement và sẵn sàng kiểm thử.
