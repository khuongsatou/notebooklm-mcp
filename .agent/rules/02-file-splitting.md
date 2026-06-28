# Rule: Splitting File

## Công dụng

Chia nhỏ dự án, task và file để dễ bảo trì, dễ review và tránh tràn context size.

## Khi tự động kích hoạt

- File vượt khoảng 300-500 dòng hoặc có nhiều trách nhiệm khác nhau.
- Task có hơn 3 nhóm thay đổi độc lập.
- Một prompt yêu cầu tạo nhiều thành phần như skill, rule, workflow, test, doc.
- Agent cần đọc nhiều file nhưng context bắt đầu lớn.

## Quy tắc

- Tách theo domain hoặc responsibility, không tách cơ học theo số dòng.
- Mỗi file mới phải có mục đích rõ ràng và tên dễ hiểu.
- Khi tạo cấu hình agent, ưu tiên nhiều file nhỏ trong thư mục con thay vì một file rất dài.
- Ghi lại quyết định tách file trong `.manager/implementation.md` nếu ảnh hưởng cấu trúc dự án.

## Kết quả mong đợi

Codebase và tài liệu vận hành dễ đọc, dễ giao việc, dễ audit.
