# Rule: Test Before Done

## Khi kích hoạt

Kích hoạt trước khi đánh dấu task hoàn tất.

## Quy tắc

- Chạy kiểm tra phù hợp với mức độ thay đổi.
- Với dự án này, ưu tiên `npm run build`, `npm run lint`, hoặc `npm run check` khi có sửa code TypeScript.
- Nếu không chạy được test, ghi rõ lý do và rủi ro còn lại.
- QA phải ghi kết quả vào `.manager/test-report.md`.

## Kết quả mong đợi

Không đóng task chỉ dựa trên cảm giác.
