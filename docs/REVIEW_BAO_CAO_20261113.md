# Rà soát báo cáo và source HQTCSDL ngày 13/11/2026

## Kết luận

Hoàn tất kiểm tra tài liệu và chạy lại phần lõi ngày 14/11/2026: báo cáo v3 77 trang, hướng dẫn vấn đáp 12 trang. Cập nhật mục lục/số trang bằng Microsoft Word; giữ đủ 30 hình, 20 bảng và 6 section, toàn bộ tệp ảnh, style và numbering của bản gốc. Xem [biên bản kiểm tra bản cuối](qa-20261113/final-artifact-review.json).

Phần cài đặt Oracle, ứng dụng và kiểm thử đã có đủ thành phần kỹ thuật tối thiểu được yêu cầu và đã được chạy lại. Báo cáo v3 được đồng bộ với source canonical trong `sql/`, giữ định dạng, hình ảnh và cấu trúc của bản v2. Không tự quy đổi thành điểm hoặc coi vấn đáp, slide và tính nguyên gốc là những mục đã được công cụ xác nhận đạt.

## Đối chiếu bảy tiêu chí

| Tiêu chí | Điểm tối đa | Kết quả rà soát | Nhóm cần làm trước bảo vệ |
|---|---:|---|---|
| Phân tích và thiết kế | 15 | Báo cáo có BR-01..12, 16 bảng, quan hệ, chuẩn hóa và ràng buộc; đã đồng bộ tên schema, đối tượng và triển khai | Tự giải thích ERD, khóa dự tuyển, phụ thuộc hàm; không chỉ đọc kết luận 3NF/BCNF |
| Kỹ thuật cốt lõi | 20 | Oracle 23.9; 1 package gồm 3 hàm/5 thủ tục công khai, 3 trigger, 2 view và job; không có object invalid hoặc lỗi compile | Chỉ đúng phần công nghệ của đề tài đã đăng ký; JSON/Graph/Vector là hướng mở rộng, không nhận đã cài |
| Code và tối ưu | 10 | Có exception/savepoint/khóa dòng, kiểm tra đồng thời, hai plan thực tế với kết quả khớp | Giải thích FULL/INDEX có kiểm soát và đánh đổi chi phí ghi; không dùng thời gian INSERT chưa đo |
| Web và API | 15 | Đã thử luồng Edge đến FastAPI đến Oracle trên bản hiện tại và bản source tách riêng có volume mới | Tập demo trên máy bảo vệ; tài khoản, thanh toán và hoàn tiền là mô phỏng |
| Báo cáo | 10 | Có bản v3 giữ hình/format, đồng bộ SQL, quy tắc, bảng test và số liệu đã xác minh | Nhóm kiểm lại yêu cầu Mục 4 đầy đủ của giảng viên nếu có chi tiết ngoài rubric được cung cấp; xác nhận phân công cá nhân |
| Slide và trình bày | 10 | Có hướng dẫn Word, kịch bản 9 phút và gợi ý tám slide | Chưa được cung cấp deck slide để rà; nhóm phải làm slide và tập thời lượng |
| Vấn đáp | 20 | Có hướng dẫn DBeaver, file SELECT chỉ đọc, 9 TC, hai phiên, ba vòng hỏi và bài tập gõ trực tiếp | Mỗi người tự giải thích và thực hành; không có công cụ nào xác nhận thay năng lực vấn đáp |

## Những gì đã sửa

1. **SQL voucher:** trước đây thời điểm 00:00 của ngày hạn được so với giờ hiện tại nên mã hết hạn quá sớm. Hàm `tinh_giam` nay so ngày địa phương bằng TRUNC, tính cả ngày cuối. Đã kiểm tra năm biên ngày, không đổi schema hoặc reset dữ liệu.
2. **Báo cáo:** dùng đúng Oracle image, schema CINEMA, source package/trigger/job/view hiện có; bỏ mô tả quyền CINEMA_OWNER/CINEMA_API chưa triển khai. Đồng bộ đoạn khóa phòng chống lịch trùng, callback COMMIT, combo ở API và các giới hạn thực tế.
3. **Dữ liệu 400.000 vé:** giữ con số đã xác minh nhưng gọi đúng là dữ liệu lịch sử tổng hợp năm 2023 phục vụ đo plan. Tách khỏi 9 ca nghiệp vụ; không nhận 400.000 phiên/người dùng/giao dịch qua UI đã được kiểm thử.
4. **Hiệu năng:** bảng đo dùng kết quả truy vấn thật, cùng bind và dữ liệu; bỏ số INSERT 4,2/5,8 giây chưa có phép đo. FULL/INDEX có hint không được mô tả như đã DROP index trong ứng dụng.
5. **Giao diện:** nhãn TC trong Lab khớp backend; bốn cửa sổ SQL khớp truy vấn thực thi; sửa lời giải thích CTE không bảo đảm tự động tránh full scan. Phiên cũ được kiểm tra khi mở lại web và khôi phục demo an toàn, không tự gửi lại đặt/thanh toán.
6. **Khởi động:** đọc cấu hình cổng đã được Compose resolve để chấp nhận `.env` có chú thích/quote; thêm `.env.example`. Bản mới tải về tạo dữ liệu nhỏ tự động. Bộ nạp lớn riêng có xác nhận và marker chống nạp lại.

## Minh chứng thực thi

- [Rà soát SQL và 17 kiểm tra bổ sung](qa-20261113/sql-review-results.json): 16 bảng, 0 lỗi compile, 0 object invalid; hoàn/điểm, ngày voucher và khóa đồng thời.
- [Hai execution plan trên dữ liệu hiện tại](qa-20261113/benchmark.json): A 4.031 xuống 4 buffer gets, B 2.127 xuống 12; cùng kết quả. Thời gian là số đo của lần chạy, không phải cam kết throughput.
- [Boot bản source sạch với volume riêng](qa-20261113/fresh-boot-results.json): đúng Oracle 23.9, 16 bảng, 1.500 ghế; dừng/mở giữ dữ liệu. Máy đã có image cache, chưa đo tốc độ tải mạng lạnh.
- [Kiểm tra phiên đăng nhập và SQL hiển thị](qa-20261113/session-ui-results.json): phiên hợp lệ/không hợp lệ, khôi phục demo sau restart, nhãn Lab và bốn SQL modal; không tự gửi lại giao dịch.
- Đã chạy lại 9/9 TC, API contract và Edge đặt/giữ/thanh toán/QR/hoàn/báo cáo/trigger trên cổng 8093 của bản tách riêng. Các ca có tạo thêm giao dịch demo; không ảnh hưởng volume gốc.

Lần kiểm kê dữ liệu gốc có 400.305 vé toàn bộ và đúng 400.000 vé lịch sử của bộ tải. Tổng có thể tăng do kiểm thử về sau; không chỉnh dữ liệu để ép số tổng khớp con số trong báo cáo.

## Tài liệu và thao tác cần dùng

- Báo cáo: `bao-cao/Nhom5_BaoCao_HoanChinh_v3.docx`.
- Hướng dẫn ôn tập: `bao-cao/Huong_Dan_Van_Dap_HQTCSDL.docx`, bản đọc trên GitHub tại [HUONG_DAN_VAN_DAP.md](HUONG_DAN_VAN_DAP.md).
- Mở ứng dụng bằng `KHOI_DONG.bat`; dừng bằng `DUNG_UNG_DUNG.bat`.
- Chỉ khi cần bộ tải: `NAP_DU_LIEU_HIEU_NANG.bat`, đọc và xác nhận trước khi nạp.
- DBeaver: mở `tools/review-oracle.sql`, chạy từng SELECT. Không thực thi `sql/01_schema.sql` chỉ để review.

Source và dữ liệu minh họa phục vụ học tập. Không dùng mật khẩu demo, cơ chế chuyển vai trò hay kết nối một schema của bài cho hệ thống thương mại. Chưa đánh giá bảo mật production hoặc tải hàng trăm phiên đồng thời.
