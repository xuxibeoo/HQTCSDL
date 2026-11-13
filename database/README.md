# Thư mục hỗ trợ Docker

**Bộ SQL chính thức là `../sql/`.** Có một lược đồ 16 bảng và một package, không còn giữ thêm định nghĩa lược đồ cũ trong thư mục này.

- `install.sql` dẫn sang `../sql/install.sql`.
- `bootstrap/` dùng để khởi tạo và kiểm tra Oracle trong Docker. Phải giữ thư mục này.
- Các file SQL mang tên cũ chỉ dẫn sang bộ SQL chính thức để không làm hỏng đường dẫn đã có trong tài liệu.
- `02_indexes.sql` dẫn sang script chỉ mục/tối ưu; `07_views.sql` dẫn sang script view và job.

Khi báo cáo, mở các file `sql/00_users.sql` đến `sql/08_optimize.sql`, không sao chép cả hai bộ vào phụ lục.

Không chạy lại script schema chỉ để chuẩn bị lịch chiếu mới: lệnh cài schema có xóa/tạo bảng. Bộ khởi động học tập không reset schema và không xóa volume.
