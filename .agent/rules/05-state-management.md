# Rule: State Management

## Khi kích hoạt

Kích hoạt trong toàn bộ vòng đời task.

## Quy tắc

- Tất cả state dự án phải được cập nhật trong `.manager/`.
- Không thay thế nội dung cũ nếu chưa cần; ưu tiên thêm section/log mới.
- Mỗi vòng lặp phải cập nhật `.manager/iteration_log.md`.
- Khi kết thúc task, PM tổng hợp vào `.manager/final_report.md`.

## Kết quả mong đợi

Agent tiếp theo có thể tiếp tục công việc mà không mất ngữ cảnh.
