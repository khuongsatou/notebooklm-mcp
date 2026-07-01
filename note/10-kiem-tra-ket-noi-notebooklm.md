# Kiểm tra kết nối NotebookLM

Thời gian kiểm tra: 2026-06-29 01:02:13 +07

## Kết quả

- MCP NotebookLM phản hồi được: server đang hoạt động.
- Trạng thái đăng nhập Google/NotebookLM: chưa authenticated.
- Notebook active: chưa có.
- Tổng notebook trong local library: 0.
- Session đang mở: 0.

## Kết luận

Hiện tại chưa thể tạo ghi chú trực tiếp trong NotebookLM vì tài khoản chưa đăng nhập và chưa có notebook nào được đăng ký/chọn làm active.

Tích hợp hiện có hỗ trợ thêm nội dung dạng text vào notebook thông qua `add_source`; sau khi đăng nhập và chọn notebook, có thể dùng cách này để lưu một ghi chú như một nguồn văn bản trong NotebookLM.

## Bước tiếp theo

1. Đăng nhập NotebookLM bằng luồng Setup Auth trong app Electron hoặc MCP.
2. Thêm hoặc chọn một notebook trong local library.
3. Tạo ghi chú bằng cách thêm text source vào notebook.
