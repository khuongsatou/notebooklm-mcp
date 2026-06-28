# 08. Prompt hành động khi tạo video từ ảnh

> "Khi upload ảnh vào tool video, AI có thể tự tạo shot description: close-up, camera zoom, ánh sáng, mô tả chủ thể. Nhưng nếu không thêm action, video thường chỉ zoom in/out hoặc có lá/hoa rơi nhẹ. Muốn nhân vật đứng dậy, đi, cười, ăn, cắn mất một miếng, phải viết rõ hành động và kết quả."

## Luận điểm trung tâm

Khi tạo video từ một ảnh tĩnh, AI thường hiểu rất tốt phần "ảnh đang có gì": chủ thể, bố cục, ánh sáng, chất liệu, màu sắc, độ gần xa của khung hình. Vì vậy, nếu chỉ upload ảnh và viết prompt chung chung, model có xu hướng tạo chuyển động an toàn: camera zoom nhẹ, parallax, tóc/lá/hoa/khói chuyển động, ánh sáng nhấp nháy, hoặc vài chi tiết nền rung nhẹ.

Nhưng hành động có chủ đích là một việc khác. Muốn nhân vật đứng dậy, đi về phía trước, quay đầu cười, đưa thức ăn lên miệng, cắn mất một miếng, hoặc làm một chuỗi hành động có kết quả nhìn thấy được, prompt phải nói rõ:

- Ai hành động?
- Hành động bắt đầu từ trạng thái nào?
- Hành động diễn ra như thế nào?
- Kết quả cuối cùng phải nhìn thấy gì?
- Camera có đi theo hành động hay đứng yên?
- Những chi tiết nào phải giữ nguyên để tránh biến dạng?

Nói ngắn gọn: ảnh cung cấp hiện trạng, prompt phải cung cấp động từ và hậu quả của động từ.

## Vì sao AI hay chỉ zoom hoặc tạo chuyển động nhẹ

Ảnh tĩnh chỉ chứa một khoảnh khắc. Từ một khoảnh khắc đó, AI không luôn biết điều gì nên xảy ra tiếp theo. Nếu prompt không chỉ đạo hành động, model sẽ chọn phương án ít rủi ro nhất để tạo cảm giác "có video" mà vẫn giữ ảnh giống bản gốc.

Các chuyển động an toàn thường gặp:

| Kiểu chuyển động | Vì sao hay xuất hiện | Khi nào phù hợp |
|---|---|---|
| Zoom in / zoom out | Dễ tạo cảm giác cinematic mà không cần thay đổi hình thể | Poster, chân dung, ảnh sản phẩm, cảnh tĩnh |
| Pan / tilt nhẹ | Tạo chuyển động máy quay, ít làm sai chủ thể | Phong cảnh, nội thất, establishing shot |
| Parallax | Tách lớp tiền cảnh/hậu cảnh để ảnh có chiều sâu | Ảnh có nhiều lớp không gian |
| Lá, hoa, tóc, vải chuyển động nhẹ | Chi tiết mềm, dễ animate mà ít phá cấu trúc | Cảnh ngoài trời, thời trang, fantasy |
| Ánh sáng, khói, bụi chuyển động | Tăng không khí mà không đổi hành động chính | Cảnh mood, cinematic, drama |

Những chuyển động này không sai. Vấn đề là chúng không thay thế được hành động chính. Nếu mục tiêu là nhân vật "làm gì đó", prompt cần đặt hành động làm trung tâm.

## Shot description khác action description

Nhiều người nhầm shot description với action description. Hai phần này liên quan nhưng không giống nhau.

| Thành phần | Trả lời câu hỏi | Ví dụ |
|---|---|---|
| Shot description | Cảnh trông như thế nào? | Close-up portrait, warm soft light, shallow depth of field |
| Camera direction | Máy quay di chuyển ra sao? | Slow dolly in, handheld follow shot, slight pan left |
| Subject description | Chủ thể là ai/cái gì? | A young woman in a red dress sitting at a cafe table |
| Action description | Chủ thể làm gì? | She stands up, smiles, picks up the cup, and takes a sip |
| Result description | Sau hành động, khung hình thay đổi thế nào? | The cup is lower, her smile is visible, the chair is pushed back |

Nếu prompt chỉ có shot description, model sẽ tạo "cảnh đẹp có chuyển động". Nếu prompt có action + result, model có cơ hội tạo "sự kiện xảy ra trong cảnh".

## Công thức prompt video từ ảnh

Một prompt rõ hành động nên có cấu trúc:

```text
[Giữ nguyên chủ thể/bối cảnh từ ảnh].
[Mô tả hành động chính theo thứ tự].
[Mô tả kết quả cuối cùng phải thấy được].
[Chỉ dẫn camera].
[Chỉ dẫn ánh sáng/phong cách nếu cần].
[Ràng buộc tránh lỗi].
```

Ví dụ:

```text
Keep the same character, outfit, face, and cafe background from the reference image.
The woman slowly stands up from the chair, turns toward the camera, smiles naturally, then takes two small steps forward.
By the end, the chair is slightly pushed back and she is standing closer to the camera.
Use a gentle handheld camera that follows her movement, warm afternoon light, realistic motion.
Do not change her face, outfit, hairstyle, or the table layout.
```

## Cấu trúc hành động nên viết thế nào

### 1. Nêu trạng thái bắt đầu

AI cần biết chủ thể đang ở tư thế nào trước khi hành động.

Ví dụ tốt:

- "The man starts seated at the table, holding a sandwich with both hands."
- "The girl starts standing still, facing slightly left."
- "The cake begins whole, with no missing slice."

Ví dụ yếu:

- "The man eats."
- "The girl moves."
- "The cake changes."

### 2. Dùng động từ cụ thể

Động từ càng cụ thể, video càng dễ đúng.

| Mơ hồ | Cụ thể hơn |
|---|---|
| move | walks forward three steps |
| interact | picks up the cup and drinks from it |
| react | laughs and covers her mouth with one hand |
| eat | bites the front edge of the cookie |
| change pose | stands up from the chair and straightens her jacket |

### 3. Chia hành động thành chuỗi ngắn

Với hành động phức tạp, đừng gói tất cả vào một câu mơ hồ. Hãy viết theo trình tự.

Ví dụ:

```text
He looks down at the apple, raises it to his mouth, takes one visible bite, chews once, then smiles.
By the final frame, a clear bite mark is missing from the apple.
```

Chuỗi này rõ hơn nhiều so với:

```text
He eats the apple.
```

### 4. Ghi kết quả cuối cùng

Đây là phần rất quan trọng. Nhiều model có thể diễn hoạt động tác nhưng không làm thay đổi vật thể nếu prompt không yêu cầu kết quả.

Ví dụ:

| Muốn thấy | Prompt cần có |
|---|---|
| Cắn bánh | "A visible bite-shaped piece is missing from the cookie by the end." |
| Uống nước | "The glass is slightly lower and contains less water after the sip." |
| Đứng dậy | "The chair is pushed back and the character is fully standing." |
| Mở cửa | "The door ends partially open, revealing light from the room behind it." |
| Cười | "Her expression changes from neutral to a clear warm smile." |

Nếu không có result description, model có thể chỉ giả vờ chuyển động mà không tạo thay đổi rõ.

## Các mức độ prompt theo độ khó

### Mức 1. Cảnh tĩnh có chuyển động nhẹ

Phù hợp khi muốn tạo ambience.

```text
Animate the image into a calm cinematic shot. Keep the subject still. Add subtle wind movement in the hair and leaves, soft light flicker, and a slow camera push-in.
```

### Mức 2. Một hành động đơn giản

Phù hợp với cười, quay đầu, nhấc tay, nhìn camera.

```text
Keep the same person and background. The woman turns her head toward the camera and smiles gently. Her posture remains mostly the same. Slow close-up camera, natural light, realistic facial motion.
```

### Mức 3. Hành động có thay đổi tư thế

Phù hợp với đứng dậy, bước đi, ngồi xuống.

```text
The man starts seated on the bench. He places one hand on the bench, stands up smoothly, straightens his coat, and takes one step forward. By the end, he is fully standing in front of the bench. Keep his face, clothing, and background consistent.
```

### Mức 4. Hành động tương tác với vật thể

Phù hợp với ăn, uống, cầm, mở, kéo, đặt xuống.

```text
The child starts holding a cookie near the plate. She lifts the cookie to her mouth, takes one visible bite from the edge, lowers it slightly, and smiles. By the final frame, a clear bite mark is missing from the cookie. Keep the plate, table, outfit, and face consistent.
```

### Mức 5. Chuỗi hành động nhiều bước

Phù hợp với mini-scene.

```text
Keep the same kitchen, character, outfit, and lighting. The woman picks up the cup from the table, smells the coffee, smiles, takes a small sip, then places the cup back on the saucer. By the end, the cup is back on the saucer and her expression is relaxed and happy. Use a medium shot with a gentle handheld camera. Avoid changing her face or the kitchen layout.
```

## Công thức "Action + Result"

Khi viết prompt, nên ghép mỗi hành động với kết quả nhìn thấy được:

| Action | Result |
|---|---|
| stands up | chair moves back, body becomes upright |
| walks forward | subject becomes larger/closer or changes position in frame |
| smiles | mouth corners lift, eyes soften |
| bites | visible missing piece appears |
| drinks | cup touches lips, liquid amount slightly decreases if visible |
| opens book | pages spread open |
| throws object | object leaves hand and lands somewhere |
| turns on lamp | lamp glows, nearby surface becomes brighter |

Prompt mạnh là prompt không chỉ nói "làm gì" mà còn nói "sau đó nhìn thấy gì".

## Vai trò của camera

Camera direction nên phục vụ hành động, không lấn át hành động.

| Mục tiêu | Camera nên viết |
|---|---|
| Nhấn cảm xúc gương mặt | close-up, static camera, subtle push-in |
| Theo nhân vật đi | handheld follow shot, slow tracking movement |
| Thấy toàn bộ cơ thể đứng dậy | medium-wide shot, camera stays steady |
| Thấy vật bị cắn/uống/mở | close-up on hands and object |
| Tạo cảm giác điện ảnh nhưng không đổi nội dung | slow dolly, shallow depth of field, soft light |

Nếu hành động là "đứng dậy", không nên chỉ viết "close-up face" vì khung hình quá hẹp sẽ không thấy chân, ghế và chuyển động cơ thể. Nếu hành động là "cắn mất một miếng", nên ưu tiên close-up vào tay, miệng và vật thể.

## Các ràng buộc nên thêm

Khi tạo video từ ảnh, model dễ làm lệch mặt, đổi trang phục, biến dạng tay, đổi đồ vật hoặc thay bối cảnh. Vì vậy, nên thêm ràng buộc ngắn:

- Keep the same face and identity.
- Keep the same outfit and hairstyle.
- Keep the same background layout.
- Keep the object shape consistent except for the intended change.
- Avoid extra fingers, distorted hands, warped mouth, changing text, or new objects.
- Do not change the camera angle too much.

Không nên viết quá nhiều ràng buộc tiêu cực nếu prompt đã dài. Ưu tiên những thứ thật sự quan trọng với cảnh.

## Ví dụ trước và sau

### Ví dụ 1. Nhân vật đứng dậy

Prompt yếu:

```text
Make this image cinematic. The man moves.
```

Khả năng cao:

- Camera zoom nhẹ.
- Áo hoặc tóc chuyển động.
- Nhân vật không thật sự đứng dậy.

Prompt tốt:

```text
Keep the same man, outfit, chair, and room from the reference image. The man starts seated, places both feet on the floor, leans forward, stands up from the chair, and straightens his jacket. By the final frame, he is fully standing and the chair is slightly behind him. Use a stable medium shot so the full movement is visible.
```

### Ví dụ 2. Cắn bánh mất một miếng

Prompt yếu:

```text
The girl eats the cookie.
```

Khả năng cao:

- Bé chỉ đưa bánh gần miệng.
- Bánh không thay đổi.
- Miệng hoặc tay dễ bị méo.

Prompt tốt:

```text
Keep the same girl, cookie, table, and background. She lifts the cookie to her mouth, takes one clear bite from the top edge, lowers the cookie, and smiles. By the end, the cookie has a visible bite-shaped missing piece on the top edge. Use a close-up shot focused on her face, hands, and the cookie. Keep her face and fingers natural.
```

### Ví dụ 3. Nhân vật cười

Prompt yếu:

```text
Make her happy.
```

Khả năng cao:

- Ánh sáng sáng hơn.
- Gương mặt thay đổi nhẹ nhưng không rõ cảm xúc.

Prompt tốt:

```text
Keep the same woman and portrait framing. Her expression changes from neutral to a warm natural smile. Her eyes soften slightly and the corners of her mouth lift. Keep the camera still with a subtle push-in, realistic facial motion, no identity change.
```

### Ví dụ 4. Nhân vật đi

Prompt yếu:

```text
He walks.
```

Khả năng cao:

- Người rung nhẹ tại chỗ.
- Camera trôi nhưng nhân vật không đổi vị trí rõ.

Prompt tốt:

```text
The man starts standing near the doorway. He turns slightly toward the hallway and walks forward three slow steps. By the end, he is farther from the doorway and closer to the camera. Use a medium-wide handheld follow shot, keeping his body fully visible.
```

## Checklist viết prompt video từ ảnh

### Trước khi viết prompt

- Xác định chủ thể chính là ai/cái gì.
- Xác định hành động chính chỉ trong một câu.
- Xác định kết quả cuối cùng phải nhìn thấy.
- Chọn khung hình đủ rộng để thấy hành động.
- Chọn chi tiết nào cần giữ nguyên từ ảnh gốc.

### Khi viết prompt

- Mở đầu bằng "keep the same..." nếu cần giữ nhân dạng/bối cảnh.
- Viết hành động theo thứ tự thời gian.
- Dùng động từ cụ thể.
- Thêm result description.
- Chỉ định camera phù hợp với hành động.
- Thêm ràng buộc chống biến dạng quan trọng.

### Sau khi tạo video

- Hành động có xảy ra thật không?
- Kết quả cuối có nhìn thấy không?
- Nhân dạng/chủ thể có bị đổi không?
- Tay, mặt, miệng, vật thể có bị méo không?
- Camera có che mất hành động không?
- Có chi tiết ngoài ý muốn xuất hiện không?

## Mẫu prompt có thể dùng lại

### Mẫu tổng quát

```text
Keep the same [subject], [identity/outfit/object], and [background] from the reference image.
The [subject] starts [initial state], then [action step 1], [action step 2], and [action step 3].
By the final frame, [visible result].
Use [camera framing/movement] so the action is clearly visible.
Maintain [style/light/mood]. Avoid [important distortions or unwanted changes].
```

### Mẫu cho nhân vật đứng dậy

```text
Keep the same character, outfit, chair, and room. The character starts seated, leans forward, pushes up from the chair, stands fully upright, and takes one small step forward. By the end, the chair is slightly behind the character and the character is clearly standing. Use a medium-wide steady camera. Keep the face and body proportions natural.
```

### Mẫu cho ăn/cắn

```text
Keep the same character, food item, table, and background. The character lifts the food to their mouth, takes one visible bite from the edge, lowers the food slightly, and smiles. By the final frame, a clear bite mark is missing from the food. Use a close-up focused on the face, hands, and food. Keep fingers, mouth, and the food shape natural.
```

### Mẫu cho cười

```text
Keep the same face, hairstyle, outfit, and background. The character slowly changes from a neutral expression into a warm natural smile, with relaxed eyes and subtle cheek movement. Use a stable close-up with a gentle push-in. Do not change identity or facial structure.
```

### Mẫu cho đi bộ

```text
Keep the same character, outfit, and environment. The character starts standing still, turns slightly toward [direction], and walks [number] slow steps to [destination]. By the end, the character is clearly in a new position in the scene. Use a medium-wide tracking shot that keeps the full body visible.
```

## Nguyên tắc quan trọng nhất

Một ảnh upload vào tool video đã nói cho AI biết "cảnh này trông như thế nào". Nhưng nó chưa nói đủ "chuyện gì phải xảy ra". Vì vậy, prompt cần bổ sung phần còn thiếu:

1. Hành động rõ.
2. Trình tự rõ.
3. Kết quả rõ.
4. Camera thấy được hành động.
5. Ràng buộc giữ nguyên những thứ không được đổi.

Nếu thiếu action, AI sẽ tạo chuyển động trang trí. Nếu có action nhưng thiếu result, AI có thể diễn hoạt động tác mà không làm thay đổi trạng thái. Nếu có cả action và result, video có khả năng trở thành một cảnh thật sự có sự kiện, thay vì chỉ là ảnh tĩnh được làm cho "nhúc nhích".
