# Rule: Security And Secrets

## Khi kích hoạt

Kích hoạt khi đụng đến auth, config, env, token, log hoặc transport.

## Quy tắc

- Không ghi secrets vào repo, log, báo cáo hoặc feedback.
- Biến môi trường phải được mô tả bằng tên, không ghi giá trị thật.
- Thay đổi liên quan auth/session phải có ghi chú rủi ro.
- Nếu phát hiện secret trong file, báo PM trước khi xử lý.

## Kết quả mong đợi

Giảm rủi ro lộ thông tin nhạy cảm khi vận hành agent.
