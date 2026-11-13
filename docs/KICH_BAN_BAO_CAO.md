# Kịch bản viết báo cáo và bảo vệ Galaxy HUFLIT

Mục tiêu là bài sinh viên năm 3: dễ hiểu, chạy được và giải thích được cơ chế CSDL. Đây là hướng dẫn soạn bài/tập demo, không phải xác nhận báo cáo Word, slide hoặc buổi bảo vệ đã hoàn thành.

## 1. Đoạn giới thiệu có thể dùng cho đề tài

> Nhóm xây dựng hệ thống quản lý đặt vé cho một cụm rạp chiếu phim mô phỏng với nhiều rạp, phòng và suất chiếu. Khách hàng chọn ghế, giữ chỗ 10 phút, thanh toán mô phỏng và nhận vé có mã QR. Hệ thống phải tránh bán trùng ghế khi nhiều người đặt cùng lúc, không cho lịch chiếu chồng nhau và ghi nhận đúng thanh toán, hủy vé, hoàn tiền. Ứng dụng React gọi FastAPI để thao tác với Oracle Database 23ai chạy bằng Docker. Trọng tâm của đồ án là tính toàn vẹn dữ liệu, giao dịch PL/SQL và truy vấn báo cáo, không phải xây dựng cổng thanh toán thật.

Tên phim, khách và giao dịch trong bản demo là dữ liệu minh họa. Không giới thiệu đây là hệ thống chính thức của một chuỗi rạp thương mại.

## 2. Bố cục báo cáo gọn, đủ nội dung

Ưu tiên cấu trúc giảng viên đã quy định. Nếu chưa có mẫu chi tiết, có thể tổ chức 5 chương sau; không bắt buộc viết dài bằng cách dán toàn bộ code vào phần nội dung.

### Chương 1. Bài toán và yêu cầu

Nêu bối cảnh, đối tượng sử dụng và phạm vi. Chọn ba tình huống làm trọng tâm:

1. Hai khách đồng thời giữ cùng ghế của cùng suất: chỉ một giao dịch được thành công.
2. Hai suất trong cùng phòng phải không trùng và có ít nhất 15 phút dọn phòng.
3. Thanh toán phải còn hạn, không lặp mã giao dịch; vé chỉ quét hợp lệ một lần và hủy theo điều kiện thời gian.

Phạm vi có thể trình bày ngắn: chọn phim/suất/ghế, giữ chỗ, combo/voucher, thanh toán demo, QR, hủy/hoàn, báo cáo, lab kiểm thử. Chưa có thanh toán ngân hàng thật, phát hành hóa đơn pháp lý hoặc vận hành cụm rạp thật.

### Chương 2. Phân tích và thiết kế CSDL

- Giới thiệu 16 bảng tại `sql/01_schema.sql`; dùng đúng tên trong [bảng đối chiếu tiêu chí](DOI_CHIEU_TIEU_CHI.md).
- Vẽ một ERD tổng thể có PK, FK và bội số. Hai sơ đồ Mermaid trong `bao-ve.md` hỗ trợ giải thích nhóm quan hệ nhưng chưa thay thế ERD đầy đủ thuộc tính.
- Trình bày quy tắc toàn vẹn: PK không trùng; FK đúng rạp/phòng/phim/đơn; giá không âm; loại/trạng thái thuộc tập cho phép; email, QR và mã giao dịch ngoài có UNIQUE.
- Giải thích 3NF bằng một số phụ thuộc hàm tiêu biểu rồi hoàn thiện bảng phụ thuộc cho cả lược đồ. Ví dụ `ma_phim -> ten_phim, thoi_luong_phut, do_tuoi, ngay_khoi_chieu`; `ma_phong -> ma_rap, ten_phong, loai_phong`; khóa ghép `phim_the_loai` chỉ gồm hai FK; `ma_combo -> ten_combo, gia`.
- `don_combo.don_gia` và `ve.gia_ve` là giá chốt khi mua, không phải lấy lại giá danh mục mỗi lần xem lịch sử. Tổng tiền/tiền giảm của đơn là dữ liệu tổng hợp có chủ đích; phải nêu nơi tính và cách giữ nhất quán, không gọi là chuẩn hóa chỉ vì có khóa ID.
- Không tuyên bố toàn bộ bảng đạt BCNF nếu chưa liệt kê và kiểm tra các phụ thuộc hàm/candidate key.

### Chương 3. Cài đặt và ứng dụng minh họa

Trình bày kiến trúc bằng một câu: **trình duyệt React gửi HTTP đến FastAPI; FastAPI kiểm tra quyền, bind tham số, gọi SQL/PLSQL trong Oracle và trả kết quả về giao diện.**

| Thành phần cần giải thích | Tệp nên mở khi vấn đáp | Ý chính |
|---|---|---|
| Tạo bảng/chỉ mục | `sql/01_schema.sql` |16 bảng và unique index có điều kiện chống trùng ghế hiệu lực. |
| Nghiệp vụ PL/SQL | `sql/02_pkg_dat_ve.sql` |3 function,5 procedure; savepoint, exception, khóa dòng. |
| Trigger | `sql/03_triggers.sql` | Chồng lịch phải đọc các dòng khác; trạng thái vé và audit. |
| View và job | `sql/04_job_views_grants.sql` | View lịch/ghế; Scheduler nhả đơn hết hạn mỗi phút. |
| API/giao dịch | `backend/main.py`, `backend/db.py` | Bind, phân quyền, COMMIT ở luồng thành công, rollback khi lỗi. |
| Báo cáo/plan/test | `backend/diagnostics.py` | CTE/Window Function;9 ca; đo 2 query plan thật. |

Chỉ trích các đoạn code trọng tâm trong thân báo cáo. Toàn bộ source nộp kèm và ghi cấu trúc tệp ở phụ lục. Không trộn lược đồ cũ với `sql/` hiện tại.

### Chương 4. Kiểm thử và tối ưu

Mỗi ca cần có đầu vào/điều kiện, thao tác, kết quả mong đợi, kết quả thực tế và bằng chứng. Với lỗi được mong đợi, bị từ chối đúng là **PASS**, không phải lỗi chương trình.

| Ca | Nội dung cần chứng minh |
|---|---|
| TC-01 | Giữ hai ghế VIP, giá cuối tuần và nhật ký đúng; thời hạn 10 phút. |
| TC-02 | Giữ lại ghế đang giữ bị ORA-20021; không sinh đơn dở dang. |
| TC-03 | Hai phiên Oracle tranh chấp cùng ghế; phiên B nhận xung đột sau khi A commit. |
| TC-04 | Voucher giảm hợp lệ, tạo QR/cộng điểm; voucher hết lượt bị từ chối. |
| TC-05 | Đơn quá hạn không được thanh toán; giải phóng ghế rồi đặt lại được. |
| TC-06 | Mã giao dịch thanh toán ngoài trùng bị từ chối. |
| TC-07 | Còn 1 giờ không được hủy; còn hơn 2 giờ hủy và hoàn đúng số tiền. |
| TC-08 | Trùng lịch hoặc nghỉ 10 phút bị chặn; nghỉ 20 phút được chấp nhận. |
| TC-09 | QR trong cửa sổ hợp lệ: lần 1 HOP_LE, lần 2 DA_SU_DUNG; cấm chuyển lùi trạng thái. |

Đây là nội dung có trong code test, không phải bảng kết quả mới. Sau chạy, thêm cột kết quả/log/ảnh của chính lần đó. `sql/07_tests.sql` là kiểm tra cấu trúc, không phải 9 ca trên.

Với tối ưu, làm hai bảng nhỏ:

| Truy vấn | Phương án đối chiếu | Ghi những gì |
|---|---|---|
| A: ghế hiệu lực theo suất | FULL trên VE và INDEX `IX_VE_SUAT_TT_GHE` | Bind suất giống nhau; kết quả khớp; operation, buffer gets, elapsed_ms từ lần chạy. |
| B:10 đơn mới nhất của khách | FULL trên DON_DAT_VE và INDEX `IX_DON_KH_TG` | Bind khách giống nhau; kết quả khớp; operation, buffer gets, elapsed_ms. |

Không chỉ ghi "index nhanh hơn". Nói index giúp tìm theo cột lọc, tránh đọc nhiều dòng không cần thiết; đổi lại INSERT/UPDATE phải cập nhật index và cần dung lượng. Không đổi buffer gets thành giây hay lấy số cũ làm số vừa đo. Cách FULL/INDEX bằng hint là phép so sánh có kiểm soát, không phải tự nhận optimizer luôn dùng index.

### Chương 5. Kết luận và hướng phát triển

Tóm tắt những chức năng đã demo được, những ràng buộc Oracle bảo vệ và giới hạn còn lại. Nêu việc chưa làm như kết nối thanh toán thật, vận hành production hoặc kiểm thử tải quy mô lớn. Nếu chưa đo throughput/response time với công cụ tải, không viết đã kiểm thử hiệu năng đầy đủ.

Sau phần kết luận: tài liệu tham khảo từ tài liệu Oracle, python-oracledb và các thư viện đã dùng; phụ lục cấu trúc source, cách chạy, phân công thực tế. Dùng ngày truy cập thật.

## 3. Chuẩn bị trước ngày bảo vệ

1. Cài và mở Docker Desktop. Chạy thử `KHOI_DONG.bat` đủ sớm để việc tải image/build/khởi tạo Oracle không chiếm thời gian trình bày. Mở `http://127.0.0.1:8080/?demo=1` theo URL thực tế launcher.
2. Xác nhận health ghi phiên bản 23.x. Nếu thay cổng hoặc máy khác, sửa theo README, không đoán từ cổng cũ.
3. Chọn suất còn hơn 3 giờ cho lượt mua/hủy; dùng tài khoản khách mẫu, một ghế còn trống và voucher đang hiệu lực. Ghi lại mã đơn/vé dùng trong buổi demo.
4. Chuẩn bị riêng một vé gần giờ chiếu cho soát vé. Bộ SQL chuẩn hiện đặt cửa sổ bắt đầu 30 phút trước suất (c_phut_soat_som trong sql/02_pkg_dat_ve.sql); shortcut chọn suất còn khoảng 10 phút để thao tác thuận tiện. Vé mua cho suất còn hơn 3 giờ trả CHUA_DEN_GIO khi quét ngay; đó là hành vi đúng. Nếu phòng kín lịch, dùng nút TC-09 trong hướng dẫn để minh họa quét lần 1/lần 2 qua Lab, không cần đổi lịch cũ.
5. Chạy trước 9 ca và A/B plan; lưu log/ảnh dự phòng. Không nạp 400.000 vé hoặc reset schema giữa buổi thuyết trình.
6. Không chạy `down -v` hoặc lệnh cài lại schema để "tắt app". Dùng `DUNG_UNG_DUNG.bat` nếu có, hoặc cách dừng giữ dữ liệu trong README.

## 4. Kịch bản bảo vệ 9 phút, khoảng 8 slide

| Mốc | Slide/thao tác | Nội dung nói |
|---|---|---|
|0:00-0:45|1. Tên đề tài, nhóm, bài toán|"Chúng em giải quyết việc bán vé dùng chung ghế, bảo vệ dữ liệu khi có nhiều giao dịch đồng thời."|
|0:45-1:30|2. Phạm vi và kiến trúc|React - FastAPI - Oracle 23ai/Docker; nêu rõ thanh toán mô phỏng.|
|1:30-2:30|3. ERD và thiết kế|Giải thích nhóm rạp/phòng/ghế, đơn/vé/thanh toán; chọn 2-3 quan hệ và một giá chốt lịch sử, không đọc cả 16 bảng.|
|2:30-3:45|4. Demo giữ ghế/thanh toán|Khách chọn suất/ghế, xem tạm tính, giữ chỗ, trả tiền demo, mở QR. Chỉ ra dữ liệu trả về từ API, không chỉ ảnh giao diện.|
|3:45-4:45|5. Tình huống khó|Chạy TC-03: A giữ ghế, B chờ; A commit, B bị từ chối. Giải thích unique index và giao dịch.|
|4:45-5:45|6. Trigger/QR hoặc hoàn|Chạy TC-08 để thấy trùng lịch bị chặn; chọn TC-09 cho quét hợp lệ/lặp, hoặc hoàn vé xa giờ. Tập trước để chỉ demo ngắn 2 nội dung.|
|5:45-7:15|7. Hai truy vấn tối ưu|Hiện A/B cùng kết quả, so operation và buffer gets. Trích số vừa chạy; giải thích vì sao chỉ mục có tác dụng và đánh đổi ghi.|
|7:15-8:15|8. Kết quả và giới hạn|Tổng hợp 9 ca, chức năng chạy được, ràng buộc cốt lõi; tách phần chưa tích hợp thật.|
|8:15-9:00|Mở source chuẩn bị vấn đáp|Mở sẵn package, trigger, API; kết thúc rõ ràng thay vì kéo dài demo.|

Kịch bản có khoảng đệm. Không cần demo cả 9 ca trực tiếp; báo cáo có đủ kết quả, chọn ca tiêu biểu để giải thích sâu. Nếu demo lỗi, nêu lỗi thật và mở log/ảnh dự phòng, không nói một ảnh cũ là kết quả vừa chạy.

## 5. Câu hỏi vấn đáp nên tự trả lời được

| Câu hỏi | Ý chính để tự giải thích |
|---|---|
| Vì sao không SELECT COUNT rồi mới INSERT để chống trùng ghế? | Hai phiên có thể cùng đọc 0. Unique index tại Oracle mới bảo vệ xung đột lúc ghi; package bắt DUP_VAL_ON_INDEX và trả lỗi nghiệp vụ. |
| Vì sao unique index có cả hai biểu thức CASE? | Vé còn hiệu lực mang khóa suất/ghế; vé hủy/hết hạn có toàn bộ khóa biểu thức NULL nên không chiếm khóa B-tree. Lịch sử vẫn giữ lại. |
| Vì sao không dùng CHECK cho chồng lịch? | CHECK của một dòng không đủ kiểm tra các suất khác cùng phòng. Compound trigger đọc sau statement và khóa phòng để xử lý cả tình huống đồng thời. |
| Giữ ghế 10 phút có phải giữ khóa Oracle 10 phút? | Không. Giao dịch giữ khóa ngắn để ghi/commit; hạn 10 phút là dữ liệu han_thanh_toan. Job và lúc thanh toán kiểm tra thời hạn. |
| Vì sao thanh toán kiểm tra lại voucher? | Lúc giữ và lúc trả tiền là hai thời điểm; voucher có thể hết hạn/hết lượt giữa hai lần. |
| API hay package COMMIT? | Các thao tác nghiệp vụ để caller quyết định COMMIT. API commit sau thành công; job có commit riêng. SAVEPOINT/ROLLBACK TO xử lý phần thao tác lỗi. |
| SKIP LOCKED có tác dụng gì? | Job bỏ qua đơn đang được giao dịch khác khóa để không phải chờ toàn bộ hàng đợi; vòng chạy sau xử lý tiếp nếu còn quá hạn. |
| Vì sao quét QR thanh toán xong vẫn CHUA_DEN_GIO? | Cửa sổ hiện đặt 30 phút trước suất trong package; trả tiền xong không có nghĩa được vào mọi lúc. Khi vấn đáp phải chỉ đúng hằng số ở SQL đang chạy, không học thuộc mốc của bản cũ. |
| Refund và combo/voucher tính thế nào? | Mở `sp_huy_ve` và giải thích công thức đang cài: giảm áp vào vé, hoàn có phân bổ/làm tròn lũy kế, ghi dòng HOAN_TIEN và thu hồi điểm. Không đoán từ tên nút. |
| Hai execution plan khác nhau nhưng có đúng cùng kết quả? | Script kiểm tra result_match; cùng bind/dữ liệu rồi mới đối chiếu buffer gets/operation. |
| Vì sao 16 bảng không tự chứng minh 3NF? | Phải xét phụ thuộc hàm và khóa ứng viên; số lượng bảng/ID tự tăng không đủ. Giá chốt giao dịch cần giải thích như dữ liệu lịch sử. |
| Nếu thầy yêu cầu chỉnh một rule? | Xác định rule nằm constraint, package, trigger hay API; sửa trên demo, bổ sung ca biên và chạy lại. Không sửa mù toàn bộ hệ thống. |

Mỗi thành viên nên tự thực hiện ít nhất một luồng UI - API - SQL và giải thích đoạn PL/SQL do mình phụ trách. Không học thuộc toàn bộ bài nhưng phải biết dữ liệu đi đâu, bị kiểm tra ở đâu và vì sao có kết quả đó.
