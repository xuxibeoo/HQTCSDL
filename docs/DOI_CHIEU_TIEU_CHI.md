# Đối chiếu tiêu chí đồ án Hệ quản trị cơ sở dữ liệu

Đề tài trong mã nguồn: **Hệ thống quản lý đặt vé rạp chiếu phim Galaxy HUFLIT**. Tài liệu này giúp nhóm biết phần nào đã có, phần nào phải bổ sung khi nộp bài; không phải bảng tự chấm điểm.

## 1. Cách đọc trạng thái

**Bản rà soát ngày 13/11/2026:** báo cáo Word và hướng dẫn vấn đáp đã được bổ sung trong `bao-cao/`, đối chiếu lại với source và bản khởi động sạch. Xem [kết luận và phần còn cần chuẩn bị](REVIEW_BAO_CAO_20261113.md).

**Cập nhật sau kiểm tra ngày 12/11/2026:** đã chạy lại ứng dụng với Oracle 23.9, 9/9 ca, API contract, schema, Edge và hai plan A/B sau bản sửa bố cục; ngày 11/11 đã xác nhận tắt/mở giữ dữ liệu. Xem [kết quả mới và giới hạn đã xác nhận](qa-student/KET_QUA_BAN_HOC_TAP.md). Các nhận xét “cần chạy lại” bên dưới là checklist cần lặp trước buổi bảo vệ, không phủ nhận lần kiểm tra mới này.

- **Có trong mã nguồn:** đã đọc thấy phần cài đặt tương ứng trong thư mục này.
- **Có minh chứng cũ:** `ket-qua-kiem-thu-v2.md` ghi kết quả ngày 10/11/2026, kèm ảnh trong `evidence-v2/`. Không coi số đo cũ là số đo của lần chạy mới.
- **Cần kiểm tra/bổ sung:** chưa có đủ hiện vật hoặc chưa chạy lại trong lần kiểm kê này. Khi kiểm kê trước khởi động, API 8080 chưa phản hồi; đây không phải kết luận hệ thống không chạy được.

Nguồn SQL thống nhất là `sql/`. Các tên tệp trong `database/` được giữ để tương thích với điểm vào Docker, không phải một lược đồ thứ hai để đưa vào báo cáo. Không tự chạy các bản SQL cũ ngoài gói hiện tại.

## 2. Các yêu cầu kỹ thuật bắt buộc

| Yêu cầu | Cài đặt thực tế | Trạng thái và cách xác nhận |
|---|---|---|
| Oracle Database 23ai | `compose.yaml` dùng Oracle Free 23.9; `backend/db.py` từ chối phiên bản không bắt đầu bằng 23 | Có cấu hình/mã kiểm tra. Sau mở app, xem `/api/health`; không chỉ chụp tên image để khẳng định DB đang hoạt động. |
| Tối thiểu 5 bảng quan hệ | `sql/01_schema.sql` có 16 bảng, trong đó 14 bảng ngoài 2 bảng nối `phim_the_loai`, `don_combo` | Đủ số lượng theo source. `tools/verify-schema.py` đối chiếu chính xác bảng/cột trong Oracle. |
| Ít nhất 1 package | `PKG_DAT_VE`, specification và body tại `sql/02_pkg_dat_ve.sql` | Có trong source; phải kiểm tra VALID/USER_ERRORS khi chạy. |
| Ít nhất 2 trigger | `TRG_SUAT_CHIEU_KHONG_TRUNG`, `TRG_VE_CHUYEN_TRANG_THAI`, `TRG_VE_NHAT_KY` | Có 3 trigger, gồm 1 compound trigger. |
| Ít nhất 3 procedure/function, có exception | Package công khai 3 function và 5 procedure; có NO_DATA_FOUND, DUP_VAL_ON_INDEX, SAVEPOINT và ROLLBACK TO | Đủ theo source. Cần chỉ được vị trí và giải thích khi vấn đáp. Không tính package spec/body thành 2 package. |
| Dữ liệu mẫu đủ minh họa | `sql/05_seed_small.sql`; tải lớn tùy chọn `sql/06_seed_perf.sql` | Seed nhỏ phục vụ nghiệp vụ; seed tải lớn phục vụ tối ưu, không bắt buộc nạp lại mỗi lần mở app. |
| Ít nhất 5 ca kiểm thử phần lõi, có biên/lỗi |9 ca TC-01..TC-09 tại `backend/diagnostics.py`, được gọi bởi `tools/verify.ps1` | Có ca tự động và kết quả cũ. Phải chạy lại, giữ log thật. `sql/07_tests.sql` chỉ kiểm tra cấu trúc/object, không thay thế 9 ca nghiệp vụ. |
| Tối thiểu 2 truy vấn quan trọng được phân tích tối ưu | A: ghế theo suất; B:10 đơn gần nhất theo khách. `sql/08_optimize.sql`, `backend/diagnostics.py` | So FULL/INDEX cùng bind, kiểm tra kết quả khớp và lấy `DBMS_XPLAN.DISPLAY_CURSOR(...,'ALLSTATS LAST')`. Có số đo cũ; lần bảo vệ dùng số đo mới. |
| Ứng dụng thao tác thật qua API | React trong `frontend/src`, FastAPI trong `backend`, python-oracledb gọi Oracle | Luồng chọn ghế - giữ - trả tiền demo - QR - hủy/hoàn có source và ảnh cũ. Cần chạy toàn tuyến trên máy bảo vệ. Không chỉ mở Swagger/SQL*Plus. |
| Mã nguồn có thể chạy lại | `KHOI_DONG.bat`, `tools/start-demo.ps1`, Compose, Dockerfile, SQL và lockfile npm | Mở bằng `KHOI_DONG.bat` theo README. Máy cần Docker Desktop hoạt động; lần dựng đầu có thể cần mạng. Không cần cài Node hoặc PowerShell 7 để chỉ mở app. |

### Package cần nắm

| Nhóm | Tên và mục đích |
|---|---|
|3 function công khai | `fn_tinh_gia_ve`: tính giá theo suất/loại ghế; `fn_tinh_giam`: tính giảm hợp lệ; `fn_duoc_huy_ve`: kiểm tra điều kiện thời gian hủy. |
|5 procedure công khai | `sp_giu_cho`, `sp_thanh_toan`, `sp_huy_ve`, `sp_soat_ve`, `sp_giai_phong_het_han`. |
| Tự động hóa hỗ trợ | `JOB_GIAI_PHONG_GHE` mỗi phút;2 view `V_LICH_CHIEU`, `V_SO_DO_GHE` tại `sql/04_job_views_grants.sql`. |

## 3. Đối chiếu 7 tiêu chí chấm điểm

| Tiêu chí | Điểm | Minh chứng đã có trong thư mục | Việc nhóm phải hoàn tất |
|---|---:|---|---|
| Phân tích và thiết kế CSDL |15| DDL 16 bảng, PK/FK/UNIQUE/CHECK; sơ đồ quan hệ mức khái quát trong `bao-ve.md` | Hoàn thiện ERD có khóa/bội số và bảng phụ thuộc hàm; giải thích 1NF-2NF-3NF, BCNF khi phù hợp. Không nhận rằng chỉ có ID tự tăng là đủ chứng minh BCNF. |
| Cài đặt kỹ thuật trọng tâm |20| Package, compound trigger, trigger trạng thái/audit; CTE, Window Function, CONNECT BY; xử lý tranh chấp ghế | Đối chiếu đúng tên đề tài đã đăng ký; chỉ rõ tình huống khó cần công nghệ trọng tâm. Không tự thêm JSON/Graph/Vector nếu không thuộc đề tài. |
| Chất lượng code và tối ưu |10| SQL tách tệp, bind parameter, exception, giao dịch;2 phép đo plan | Lưu kết quả mới cho cả A/B; giải thích operation, buffer gets, đánh đổi chi phí ghi khi thêm index. |
| Ứng dụng giao diện + API + DB |15| React/FastAPI/Oracle; đặt vé, thanh toán demo, QR, hoàn, báo cáo, phòng lab | Demo thành công từ web đến dữ liệu Oracle. Phải nói rõ thanh toán chỉ là mô phỏng, không kết nối ngân hàng/cổng thanh toán thật. |
| Báo cáo đồ án |10| Có bản Word v3 trong `bao-cao/`, hình giữ từ v2 và số liệu đã kiểm chứng | Nhóm đọc lại bản v3, đối chiếu thêm Mục 4 đầy đủ nếu giảng viên có yêu cầu khác; xác nhận phân công cá nhân. Không tự nhận đủ điểm chỉ vì có báo cáo. |
| Slide và trình bày |10| Có kịch bản tại `KICH_BAN_BAO_CAO.md` | Chưa thấy PPTX/PDF slide trong HQTCSDL. Nhóm dựng khoảng 8 slide, tập trình bày 8-10 phút. |
| Vấn đáp |20| Có câu hỏi gợi ý và vị trí mã để giải thích | Chưa thể xác nhận năng lực bằng công cụ. Mỗi thành viên phải tự chạy, giải thích và sửa được phần mình phụ trách. |

**Không tính điểm dự kiến.** Đủ số tệp không đồng nghĩa đủ điểm. Hệ thống không chạy hoặc không giải thích được code khi bảo vệ là rủi ro nghiêm trọng theo rubric.

## 4. Danh sách 16 bảng để dùng thống nhất trong báo cáo

| Nhóm | Bảng | Vai trò |
|---|---|---|
| Rạp/phòng/ghế | `rap`, `phong_chieu`, `loai_ghe`, `ghe` | Tổ chức cụm rạp, phòng, vị trí và phụ thu ghế. |
| Phim/lịch | `phim`, `the_loai`, `phim_the_loai`, `suat_chieu` | Danh mục phim, quan hệ nhiều-nhiều thể loại, lịch chiếu. `the_loai` hiện là danh mục phẳng, không có `ma_cha`. |
| Khách/ưu đãi | `khach_hang`, `khuyen_mai` | Thông tin khách, hạng thành viên, điểm, hiệu lực/hạn mức ưu đãi. |
| Đơn/vé/tiền | `don_dat_ve`, `ve`, `thanh_toan` | Giữ chỗ, từng ghế theo suất, giao dịch thanh toán và hoàn tiền. |
| Mua kèm/audit | `combo`, `don_combo`, `nhat_ky_ve` | Danh mục combo, dòng mua chốt giá, lịch sử trạng thái vé. |

Không dùng các tên lược đồ cũ như `giao_dich_thanh_toan`, `phieu_hoan_tien`, `combo_bap_nuoc`, `nhan_vien_tai_khoan`, `nhat_ky_he_thong` để mô tả schema 16 bảng hiện tại. Hoàn tiền hiện là dòng `thanh_toan.trang_thai='HOAN_TIEN'`, có `ma_ve` tham chiếu.

## 5. Tự kiểm tra trước khi nộp

1. Chạy `KHOI_DONG.bat`; mở `http://127.0.0.1:8080/?demo=1` và kiểm tra health. Nếu đổi cổng, dùng URL launcher/README cung cấp.
2. Dùng 9 ca lab hoặc `tools/verify.ps1`, chạy contract/schema check theo README và lưu log mới. Các ca có ghi thử dữ liệu demo; không chạy trên dữ liệu thật.
3. Đo A/B trên cùng bộ dữ liệu, lưu plan và số đọc khối. FULL/INDEX là so hai phương án có kiểm soát, không chứng minh rằng optimizer mặc định luôn chọn cùng phương án.
4. Chụp ít nhất: ERD, giữ ghế/đơn, vé QR, ca lỗi trùng ghế hoặc trùng lịch, hai query plan.
5. Hoàn thiện báo cáo và slide; ghi đúng tên nhóm/mã sinh viên, phân công thật, ngày đo thật. Không điền số liệu chưa đo.
6. Nộp source và hướng dẫn; không cần đóng gói `node_modules`, cache Python, `dist` có thể dựng lại. Vẫn giữ lockfile, SQL, bootstrap Docker và ảnh bằng chứng. Không xóa volume Oracle để làm nhẹ bài.
