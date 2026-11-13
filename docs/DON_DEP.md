# Nhật ký dọn bài HQTCSDL - 11/11/2026

Chỉ thao tác trong đồ án Galaxy HUFLIT tại `C:\Users\ASUS TUF\Downloads\HQTCSDL`. Không sửa dự án FinWorkshop, Flutter hoặc tài liệu Word của nhóm.

## 1. File đã đưa ra ngoài project

Không xóa vĩnh viễn. Bản sao lưu nằm tại:

`C:\Users\ASUS TUF\Downloads\HQTCSDL_sao_luu_don_dep_20261111_185755`

| Thành phần | Cách xử lý | Lý do |
|---|---|---|
| `frontend/node_modules` | Chuyển vào `generated/frontend/node_modules` trong bản sao lưu | Docker tự cài từ package-lock khi build; không cần nộp dependency |
| `frontend/dist`, `backend/dist` | Chuyển vào nhánh `generated/` tương ứng | File build sinh lại từ source; tránh dùng nhầm giao diện cũ |
| `backend/__pycache__`, `docs/qa-student/__pycache__` | Chuyển vào nhánh `generated/` tương ứng | Cache Python sinh lại |
| `docs/qa-student/inspect_schedule.py` | Chuyển vào `generated/docs/qa-student/` | Script chẩn đoán tạm; vẫn giữ các script kiểm chứng có thể chạy lại |
| Bảy script SQL cũ trong `database/` | Lưu bản gốc ở `database-cu/`, thay bằng file dẫn đến `sql/` | Tránh hai lược đồ/nhóm tên khác nhau trong cùng bài |

Tổng file sinh lại đã chuyển ra ngoài: **101.081.228 byte, khoảng 101 MB** (bổ sung cache kiểm thử ngày 12/11). Dung lượng ổ đĩa tổng chưa giảm vì bản sao lưu vẫn được giữ.

Danh sách từng đường dẫn, kích thước và SHA256 của SQL gốc:

- [File sinh lại đã di chuyển](qa-student/cleanup-generated.json).
- [SQL gốc đã sao lưu](qa-student/cleanup-originals.json).

## 2. Những gì được giữ nguyên

- Source frontend/backend; package-lock; Dockerfile; Compose; bootstrap Oracle.
- Bộ SQL chính thức trong `sql/`, dữ liệu nghiệp vụ, ảnh/font giao diện.
- Script kiểm thử, lịch sử kết quả và ảnh bằng chứng báo cáo.
- Volume Oracle. Không chạy `down -v`, không cài lại schema, không xóa bảng hoặc dữ liệu để dọn nhẹ bài.

`database/` vẫn giữ điểm vào Docker và các file dẫn tương thích. Muốn đọc hoặc trình bày DDL/PLSQL, dùng `sql/`, không dùng SQL trong bản sao lưu.

## 3. Khởi động sau khi dọn

Bấm đúp `KHOI_DONG.bat` tại thư mục gốc. Chỉ cần Docker Desktop; không cần dependency Node/Python trên máy để chạy ứng dụng. Image được dựng lại từ source, không dựa vào các thư mục build vừa lưu trữ.

Đã thử tắt/mở lại sau khi chuyển các thư mục trên. Số bảng, đơn, vé, phòng và ghế không đổi: [bằng chứng](qa-student/restart-preserves-data.json).

Nếu muốn sửa frontend ngoài Docker, cài Node phù hợp rồi chạy `npm ci` trong `frontend/`. Không cần chép lại node_modules cũ.

## 4. Khôi phục khi cần

1. Mở đúng thư mục bản sao lưu nêu trên.
2. Chép mục cần xem từ `generated/` sang một thư mục kiểm tra riêng, hoặc về đúng đường dẫn gốc tương ứng nếu mục đó chưa tồn tại.
3. Không ghi đè source/SQL hiện tại bằng bản cũ. Với SQL cũ, nên chỉ mở để đối chiếu; chạy chúng có thể tạo lược đồ không khớp ứng dụng.
4. Giữ bản sao lưu đến khi nhóm đã chạy và nộp bài thành công.

Không tự động xóa bản sao lưu. Dọn file source không thay thế việc sao lưu database Oracle.
