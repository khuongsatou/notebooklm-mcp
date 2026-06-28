# README - Questions for NotebookML

Thư mục này chứa các bộ câu hỏi dùng để phân tích tài liệu trong NotebookML.

Các file được chia thành hai nhóm:

- `nên làm`: câu hỏi kiểm tra hướng triển khai đúng, output cần có và tiêu chuẩn đạt.
- `không nên làm`: câu hỏi kiểm tra lỗi, rủi ro, dấu hiệu lệch hướng và các điều cần tránh.

Mỗi file `.json` có cấu trúc:

```json
{
  "title": "Tên bộ câu hỏi",
  "question": [
    "Câu hỏi 1",
    "Câu hỏi 2"
  ]
}
```

## Cách dùng

1. Chọn thư mục `nên làm` nếu muốn phân tích hướng triển khai đúng.
2. Chọn thư mục `không nên làm` nếu muốn soi lỗi, rủi ro hoặc các dấu hiệu cần tránh.
3. Chọn file câu hỏi đúng với deep dive cần phân tích.
4. Đưa nội dung deep dive hoặc transcript vào NotebookML.
5. Dùng các câu hỏi trong file JSON để yêu cầu NotebookML trả lời theo từng ý.
6. Khi NotebookML trả lời, ưu tiên trích dẫn từ tài liệu đã nạp vào notebook.
7. Nếu dữ kiện trong notebook chưa đủ, NotebookML có thể tham khảo URL mẫu bên dưới để bổ sung bối cảnh.

## URL tham khảo mẫu

```text
file:///Users/apple/Desktop/project_3/mtips5s_drive_down/workspace/video-transcripts/k07-master-youtube-ai-video-2025-core-rules/preview.html#deep-dive-1-tu-duy-dao-dien-ai
```

URL này là bản preview của tài liệu `K07 Master YouTube AI Video 2025 - Phân tích sâu cốt lõi các quy tắc`.

Khi cần tham khảo thêm, có thể đổi phần anchor sau dấu `#` theo deep dive tương ứng, ví dụ:

```text
#deep-dive-2-phan-loai-chu-de-truoc-khi-research
#deep-dive-3-research-sau-truoc-keyword
#deep-dive-4-phan-tich-doi-thu-de-biet-minh-co-canh-tranh-duoc-khong
#deep-dive-5-micro-niche-va-vai-tro-kenh
#deep-dive-6-master-prompt-khong-phai-mot-cau-lenh-dai
#deep-dive-7-script-phai-keo-duoc-visual-khong-chi-keo-duoc-loi
#deep-dive-8-storyboard-anh-la-diem-khoa-chat-luong
#deep-dive-9-prompt-video-phai-la-thiet-ke-chuyen-dong
#deep-dive-10-khong-animate-vo-nghia
#deep-dive-11-am-thanh-la-nua-con-lai-cua-hinh-anh
#deep-dive-12-seo-la-boi-canh-khong-phai-meo
#deep-dive-13-doc-analytics-thay-vi-doan
#deep-dive-14-ngach-suc-khoe-dong-y-phai-an-toan-hon-ngach-thuong
```

## Lưu ý khi NotebookML thiếu dữ kiện

Khi câu trả lời không đủ chắc, yêu cầu NotebookML làm theo thứ tự:

1. Nêu rõ dữ kiện nào đã có trong notebook.
2. Nêu rõ dữ kiện nào còn thiếu.
3. Tham khảo URL mẫu hoặc deep dive tương ứng để bổ sung bối cảnh.
4. Phân biệt phần trích từ tài liệu với phần suy luận.
5. Không tự bịa dữ kiện, ví dụ, case study, số liệu hoặc kết luận nếu nguồn không nói rõ.

Prompt gợi ý:

```text
Hãy trả lời bộ câu hỏi này dựa trên dữ liệu trong notebook. Nếu notebook chưa đủ dữ kiện, hãy tham khảo URL preview/deep dive tương ứng do tôi cung cấp. Khi trả lời, phân biệt rõ: dữ kiện có trong nguồn, dữ kiện còn thiếu, và phần suy luận hợp lý. Không bịa số liệu hoặc ví dụ nếu nguồn không có.
```

Prompt gợi ý khi dùng thư mục `không nên làm`:

```text
Hãy dùng bộ câu hỏi này để soi lỗi và rủi ro trong nội dung/kế hoạch hiện tại. Với mỗi câu hỏi, trả lời theo 3 phần: có dấu hiệu lỗi không, bằng chứng nằm ở đâu trong nguồn, và nên sửa như thế nào. Nếu nguồn chưa đủ dữ kiện, hãy nói rõ thiếu gì và tham khảo URL deep dive tương ứng.
```
