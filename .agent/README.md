# IT Agent Operating Kit

Thư mục `.agent` định nghĩa cách một phòng IT vận hành dự án bằng agent.

## Cấu trúc

| Path | Mục đích |
|------|----------|
| `skills/` | Năng lực/role của đội IT |
| `rules/` | Quy tắc bắt buộc khi xử lý task |
| `workflows/` | Quy trình làm việc lặp lại được |

## Vai trò chính

- Project Manager là người đứng đầu dự án, điều phối task, quyết định ưu tiên và tổng hợp báo cáo.
- Product Owner chuẩn hóa yêu cầu thành scope rõ ràng.
- Developer triển khai theo yêu cầu đã duyệt.
- QA kiểm thử và xác nhận chất lượng.
- UX/Customer Review đại diện khách hàng đánh giá giao diện và chức năng.

## Cách dùng

1. Đọc `.manager/current_task.md` để biết task hiện tại.
2. Chọn skill phù hợp trong `.agent/skills`.
3. Áp dụng rule tương ứng trong `.agent/rules`.
4. Chạy workflow phù hợp trong `.agent/workflows`.
5. Cập nhật kết quả về `.manager/`.
