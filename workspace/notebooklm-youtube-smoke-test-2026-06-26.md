# NotebookLM YouTube smoke test - 2026-06-26

## Thong tin test

- Notebook: The Morning Coffee Echoes
- Notebook URL: https://notebooklm.google.com/notebook/fc93a1cb-7b9e-4b3b-913a-2136311cafcf
- Nguon YouTube: https://www.youtube.com/watch?v=ZqNWf17xcJg
- Nguon trong NotebookLM: "BLVCKVINES 157: Khi Bạn Chưa Làm Ly Cafe Buổi Sáng"
- Tai khoan Chrome/NotebookLM dang dung: vankhuong240499@gmail.com

## Muc tieu

Smoke test workflow NotebookLM qua Chrome profile da dang nhap:

1. Tao notebook moi.
2. Them video YouTube lam nguon.
3. De NotebookLM doc transcript/tom tat nguon.
4. Dung mau prompt trong `note/prompt_buoi_1.txt` de chat tuong tac phan tich.
5. Rut insight va outline video moi.

## Mau prompt goc da dung

File tham chieu: `note/prompt_buoi_1.txt`

Bo prompt tai dung theo y speaker:

1. Phan tich cac nguon/video doi thu trong notebook nay. Cho toi biet moi video dang noi ve chu de gi, cau truc noi dung ra sao, hook mo dau la gi, cac luan diem chinh la gi, va diem nao khien nguoi xem giu lai.
2. Tu cac video doi thu, hay tong hop cac pattern noi dung lap lai: chu de pho bien, angle trien khai, cach dat van de, vi du/case duoc dung, nhip ke chuyen, diem manh va diem yeu.
3. Tim khoang trong noi dung ma cac doi thu chua khai thac tot. De xuat cac goc lam video khac biet hon nhung van bam nhu cau nguoi xem.
4. Bien phan phan tich doi thu thanh outline video moi cho kenh cua toi: khong copy, chi tong hop insight, cau truc lai thanh y tuong rieng, co hook, cac section chinh va huong visual.

Ghi chu: file prompt goc noi ro day la prompt tai dung tu workflow speaker mo ta, khong phai prompt nguyen van trong transcript buoi 2026-06-20.

## Ket qua ingest nguon

NotebookLM them duoc nguon YouTube thanh cong.

NotebookLM tu dat ten notebook la "The Morning Coffee Echoes" va tao tom tat ban dau:

- Video la san pham giai tri ngan tu kenh YouTube BlvckVines Official.
- Chu de duoc suy ra xoay quanh thoi quen uong ca phe buoi sang.
- Noi dung chinh mo ta trang thai thieu tinh tao truoc caffeine va su doi lap voi trang thai nang dong sau khi uong ca phe.
- Phong cach duoc xep vao dang vines/hai ngan, dua tren khoanh khac doi thuong.

## Phat hien quan trong ve transcript

Transcript cua video bi loi nhan dien kha nang nang:

- NotebookLM nhan thay transcript khong mach lac.
- Transcript co nhieu tu tieng Tay Ban Nha roi rac nhu "selva", "hembra", "rafael y movil", "una tierra".
- Co cac am dem/ngat quang nhu "si", "e", "8", "y", "como a ver".
- NotebookLM danh gia day co the la loi phu de tu dong cua YouTube khi co tieng on, tieng lam bam, tieng ngáp, hoac am thanh khong ro.

Ket luan thuc dung: pipeline hoat dong tot, nhung neu can phan tich noi dung chinh xac thi phai xem video truc tiep hoac lay transcript chuan hon.

## Luot chat 1 - Phan tich nguon

Prompt da gui:

```text
Dung workflow phan tich trong prompt mau:
"Phan tich nguon/video trong notebook nay. Cho toi biet video dang noi ve chu de gi, cau truc noi dung ra sao, hook mo dau la gi, cac luan diem/chuyen dong chinh la gi, va diem nao khien nguoi xem giu lai."

Nhung vi nguon hien chi co 1 video YouTube va transcript co dau hieu loi nhan dien, hay tra loi theo 2 lop:
A. Nhung gi co the ket luan truc tiep tu transcript/tom tat nguon.
B. Nhung gi chi la suy luan tu tieu de, ngu canh, va phong cach BLVCKVINES.
Cuoi cau tra loi hay cham muc tin cay 1-5 cho tung ket luan.
```

Ket qua chinh:

### Lop A - ket luan truc tiep tu transcript

- Khong the rut ra chu de, cau truc, hook hay luan diem mach lac tu transcript.
- Transcript gom cac tu/chuoi am thanh roi rac va khong lien ket.
- Diem giu chan nguoi xem khong the xac dinh truc tiep tu van ban transcript.
- Diem co the ket luan chac hon: transcript bi loi nhan dien am thanh/phu de tu dong.

Muc tin cay:

- Y nghia thuc te cua transcript: 1/5.
- Ket luan transcript bi loi nhan dien: 5/5.

### Lop B - suy luan tu tieu de/ngu canh

- Chu de kha chac: trang thai lo do, mat tap trung, nao chua khoi dong khi chua co ly ca phe buoi sang.
- Hook kha nang cao: canh mo dau bang bieu cam bo pho, hanh dong sai trai hoac hau dau de tao cuoi ngay lap tuc.
- Cau truc kha nang cao cua dang Vine/hai ngan:
  - Setup: nhan vat co gang thuc hien thoi quen buoi sang nhung lien tuc that bai.
  - Escalation: su ngo ngan tang dan qua hai hinh the.
  - Punchline: uong ca phe roi "hoi sinh", hoac ket thuc bang hau qua do su dáng tri.
- Diem giu chan: su dong cam, nhip cat nhanh, bieu cam cuong dieu.

Muc tin cay:

- Chu de video: 5/5 do tieu de noi truc tiep.
- Hook/cau truc/chuyen dong/diem giu chan: 4/5 ve nguyen ly format, nhung chi tiet cu the can xem video truc tiep.

## Luot chat 2 - Pattern va content gap

Prompt da gui:

```text
Tiep tuc theo prompt mau:
"Tu video nguon, hay tong hop cac pattern noi dung lap lai: chu de pho bien, angle trien khai, cach dat van de, vi du/case duoc dung, nhip ke chuyen, diem manh va diem yeu. Tim khoang trong noi dung ma nguon nay chua khai thac tot."

Vi chi co 1 nguon va transcript bi loi, hay lam theo dang hypothesis map:
- Pattern chac chan tu tieu de/tom tat.
- Pattern chi suy luan theo format hai ngan/Vine.
- Khoang trong noi dung co the khai thac neu lam video moi cung chu de.
- Dieu can xem lai truc tiep trong video truoc khi khoa kich ban.
```

Ket qua chinh:

### Pattern chac chan

- Chu de: tac dong hai huoc cua viec thieu caffeine buoi sang len nhan thuc va hanh vi.
- Angle: doi thuong, de dong cam, kieu "khi ban chua lam/uong...".
- Diem manh: pain point pho bien voi sinh vien, dan van phong, nguoi co thoi quen ca phe.

### Pattern suy luan

- Dat van de bang tinh huong phi logic ngay giay dau, khong can giai thich dai.
- Nhip ke nhanh, cut lien tuc, day su hau dau len thanh slapstick.
- Co the dung dien thoai/do vat buoi sang lam dao cu gay nham lan.
- Diem yeu cua format: de thanh "thuc an nhanh", vui nhanh nhung de quen neu khong co angle rieng.

### Khoang trong noi dung

- Khai thac tuong tac xa hoi: nhan vat thieu ca phe noi nham/ngon ngu vo nghia khi noi chuyen voi sep, dong nghiep, doi tac.
- Dao goc nhin: POV cua dong nghiep phai chiu dung nguoi chua uong ca phe, hoac POV cua chinh ly ca phe.
- Chia thanh cac level: moi cap do thieu ca phe lam hanh vi ky quai hon.

### Checklist can xem truc tiep

- Punchline goc cua video ket thuc nhu the nao?
- Dao cu/hinh the nao duoc dung that?
- Goc may la can mat hay toan canh?
- Am thanh trong video la loi thoai that, tieng lam bam, tieng on, hay phu de auto tu "tuong tuong" ra?

## Luot chat 3 - Bien insight thanh concept video moi

Prompt da gui:

```text
Ap dung prompt mau cuoi:
"Bien phan phan tich nguon thanh outline video moi cho kenh cua toi: khong copy, chi tong hop insight, cau truc lai thanh y tuong rieng, co hook, cac section chinh va huong visual."

Yeu cau dau ra:
- 3 concept video ngan khac nhau cung chu de "khi chua uong ca phe buoi sang".
- Moi concept co: hook 3 giay dau, beat-by-beat 20-40 giay, punchline, huong visual/action, am thanh, va rui ro can tranh.
- Uu tien insight tu phan tich vua roi: transcript loi/ngon ngu vo nghia, hai hinh the, trang thai nao chua khoi dong.
- Khong copy truc tiep video nguon.
```

Ket qua chinh:

### Concept 1 - "Loi he thong dich thuat"

Y tuong cot loi: khi chua co ca phe, nao bi loi bo go, nhung gi nhan vat noi ra nghe nhu mot ngon ngu ky la.

- Hook: nhan vat vao van phong, dong nghiep hoi "Chao buoi sang, an gi chua?", nhan vat dap bang chuoi am vo nghia.
- Beat:
  - Dong nghiep hoi lai.
  - Nhan vat co gang giai thich nhung cang noi cang vo nghia.
  - Dong nghiep hieu ra va day ly ca phe den.
- Punchline: uong mot ngum, nhan vat noi tieng Viet ro rang: "Cam on nha, nay gio tao noi cai gi vay?"
- Visual/action: can mat bo pho, mat dong nghiep hoang mang, them glitch nhe cho am thanh.
- Rui ro: dien vien noi vo nghia qua guong; can dien nhu minh dang noi that binh thuong.

### Concept 2 - "Tien trinh khoi dong that bai"

Y tuong cot loi: nao dieu khien sai moi hanh dong vat ly truoc khi nap caffeine.

- Hook: bao thuc reo, tay tho ra dap tat nhung dap trung vat khac.
- Beat:
  - Bop sua rua mat len ban chai.
  - Cat chia khoa vao tu lanh.
  - Pha ca phe nhung do nuoc nong vao thung rac.
- Punchline: uong ca phe xong tinh lai, nhung phat hien da ra duong voi quan ao/mac do sai.
- Visual/action: montage nhanh, POV ket hop toan canh, Foley cuong dieu.
- Rui ro: montage de nham neu tinh huong khong du phi logic.

### Concept 3 - "Goc nhin khac ve sinh vat sang som"

Y tuong cot loi: nguoi thieu ca phe duoc quay nhu mot "sinh vat" trong phim tai lieu gia.

- Hook: voiceover nghiem tuc: "Tai moi truong cong so, co mot loai sinh vat cuc ky nguy hiem neu tiep can luc 8 gio sang..."
- Beat:
  - May quay len theo nhan vat zombie.
  - Nhan vat quanh may photocopy, lam bam vo nghia.
  - Dong nghiep day ly ca phe lai nhu cho thu du an.
- Punchline: sau mot ngum ca phe, nhan vat bien thanh nguoi chuyen nghiep: "File Excel thang truoc em gui sep roi nhe."
- Visual/action: mockumentary, zoom bat ngo, mau toi dau video va sang hon sau khi uong ca phe.
- Rui ro: voiceover qua dai lam mat nhip; can cau ngan, manh, di thang vao hanh dong.

## Ket luan workflow

Workflow prompt trong `note/prompt_buoi_1.txt` dung duoc tot voi NotebookLM, dac biet khi chia thanh cac buoc:

1. Phan tich nguon.
2. Rut pattern.
3. Tim content gap.
4. Bien thanh outline moi.

Voi nguon co transcript loi, can them rao chan trong prompt:

- Tach "ket luan tu nguon" va "suy luan".
- Yeu cau cham muc tin cay.
- Yeu cau checklist can xem lai truc tiep truoc khi khoa kich ban.

Day la cach giup NotebookLM van huu ich ma khong bi ao tuong qua muc tu transcript sai.
