# HQTCSDL - Galaxy HUFLIT

**Đồ án môn Hệ quản trị cơ sở dữ liệu, dùng để học và bảo vệ bài.** React - FastAPI - Oracle Database 23ai. Thanh toán, hoàn tiền và mã QR phục vụ minh họa; không thu tiền hoặc bán vé thật.

## 1. Mở bài bằng một lần bấm

1. Cài **Docker Desktop**, mở được Docker Engine/WSL2. Máy cần Internet trong lần chạy đầu.
2. Giữ nguyên toàn bộ thư mục này, bấm đúp **KHOI_DONG.bat**.
3. Đợi cửa sổ báo sẵn sàng. Trình duyệt mở ứng dụng cùng **Hướng dẫn demo**.

Không cần tự cài Node.js, Python, Oracle hoặc PowerShell 7. Lần đầu có thể mất 5-15 phút để tải image/thư viện; lần sau dùng lại dữ liệu và cache. Không đóng cửa sổ khởi động khi đang chuẩn bị.

- Ứng dụng: http://127.0.0.1:8080/?demo=1
- Swagger API: http://127.0.0.1:8080/docs
- Oracle: `127.0.0.1:1521/FREEPDB1`, schema `CINEMA`.
- Hết buổi: bấm **DUNG_UNG_DUNG.bat**. Dữ liệu vẫn được giữ.

Launcher kiểm tra Docker, build Web/API, chờ API kết nối thật tới Oracle 23ai rồi mới mở trình duyệt. **Không xóa bảng, không reset schema, không xóa volume.**

## 2. Dùng để demo và báo cáo

Nút **Hướng dẫn demo** có năm chặng, tổng 8-10 phút:

1. **Khách hàng:** chọn phim/suất/ghế, combo hoặc voucher, giữ 10 phút, thanh toán mô phỏng và xem QR.
2. **Vé của tôi:** xem đơn vừa đặt, thử hoàn một vé ở suất còn xa.
3. **Soát QR:** đổi sang nhân viên soát vé. Vé chưa đến giờ phải trả CHUA_DEN_GIO, không phải lỗi.
4. **Báo cáo:** mở SQL gốc, chỉ CTE/Window Functions và các ngày/tháng không phát sinh.
5. **Lab:** chạy TC-03 tranh cùng ghế, TC-08 trùng lịch, TC-09 quét lại vé; mở execution plan trước/sau.

Các nút hướng dẫn tự mở đúng phân hệ và phiên demo; bạn vẫn tự chọn ghế, giữ và thanh toán để giải thích được luồng dữ liệu. Không cần nhập email/mật khẩu cho mỗi bước.

Ứng dụng chuẩn bị suất còn thiếu theo ngày hiện tại, nhưng **không dời lịch cũ hoặc thêm phòng**. Khi phòng đang kín lịch, hướng dẫn có lối vào TC-09/TC-07 trong Lab để minh họa QR/điều kiện hoàn mà không phải chờ. Không tự chạy test chỉ vì mở hướng dẫn.

Tài liệu nên mở trước buổi báo cáo:

- [Kịch bản báo cáo 9 phút, bố cục báo cáo/slide và câu hỏi vấn đáp](docs/KICH_BAN_BAO_CAO.md).
- [Đối chiếu từng tiêu chí môn học, phần có và phần cần bổ sung](docs/DOI_CHIEU_TIEU_CHI.md).
- [Giải thích thiết kế và luồng UI - API - Oracle](docs/bao-ve.md).
- [Kết quả kiểm tra bản học tập](docs/qa-student/KET_QUA_BAN_HOC_TAP.md).

**Báo cáo Word, slide và khả năng giải thích khi vấn đáp không tự hoàn thành chỉ vì ứng dụng chạy.** Bảng đối chiếu nêu rõ các phần này để nhóm chuẩn bị, không tự chấm đạt.

## 3. Chỉ học một bộ SQL

Bộ chính thức nằm trong **sql/**:

| File | Mở khi cần giải thích |
|---|---|
| 00_users.sql | Tài khoản và quyền Oracle |
| 01_schema.sql |16bảng, PK/FK/CHECK/UNIQUE, chỉ mục chống trùng ghế |
| 02_pkg_dat_ve.sql |1package:3hàm +5thủ tục, transaction/exception |
| 03_triggers.sql |3trigger: lịch chiếu, trạng thái vé, audit |
| 04_job_views_grants.sql | Scheduler nhả ghế và2view |
| 05_seed_small.sql | Dữ liệu minh họa nghiệp vụ |
| 06_seed_perf.sql | Nạp dữ liệu lớn khi cần đo tối ưu |
| 07_tests.sql | Kiểm tra cấu trúc/object, không thay9ca nghiệp vụ |
| 08_optimize.sql | Chỉ mục và thống kê phục vụ execution plan |

`database/` chỉ còn bootstrap và file dẫn tương thích sang bộ SQL trên. Các định nghĩa SQL cũ lệch lược đồ đã được sao lưu ngoài project, không dùng để báo cáo.

## 4. Kiểm tra nhanh trước khi lên lớp

Sau khi ứng dụng đã mở, chạy trong PowerShell tại thư mục này:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-contract.ps1
Get-Content -Raw .\tools\verify-schema.py | docker compose exec -T web python -
```

Các script kiểm thử có tạo giao dịch minh họa, chỉ dùng trên database demo. Hoặc dùng từng nút ngay trong Lab, không cần nhớ lệnh. Test kiểm tra dữ liệu/Oracle thật, không chỉ kết quả build.

Kiểm tra cấu hình mà chưa chạy ứng dụng:

```powershell
.\KHOI_DONG.bat -Action Check -NoBrowser
```

Nếu cần tải lớn (không tự chạy mỗi lần mở app):

```powershell
docker compose exec -T oracle bash -lc 'cd /sql && sqlplus -L -s "cinema/$CINEMA_DB_PASSWORD@//localhost:1521/FREEPDB1" @06_seed_perf.sql'
```

Script tải lớn có nhận diện đã nạp để không nhân đôi. Giữ cả dữ liệu nghiệp vụ, không xóa 400.000 vé chỉ để mở demo nhanh hơn.

## 5. Khi không mở được

| Hiện tượng | Cách xử lý |
|---|---|
| Chưa có Docker | Cài Docker Desktop và bật WSL2, không chỉ cài Docker CLI |
| Engine chưa chạy | Đợi Docker Desktop báo sẵn sàng; launcher có thể tự mở Docker |
| Cổng 8080/1521 bị chiếm | Dừng ứng dụng đang dùng cổng, hoặc đặt WEB_PORT/ORACLE_PORT khác trong .env. Không tự tắt chương trình khác. |
| Oracle đang khởi tạo | Xem `docker compose logs --tail 80 oracle web`; lần đầu cần chờ lâu hơn |
| Cần xem log khởi động | Mở `.runtime/startup-errors.log`, `.runtime/startup.log` |
| Demo QR chưa hợp lệ | Kiểm tra giờ suất; dùng TC-09 trong Lab để minh họa quét lần 1/lần 2 |
| Điểm/trạng thái cũ vẫn còn | Đúng thiết kế: tắt/mở không reset dữ liệu |

Đừng chạy `docker compose down -v` hoặc cài lại schema chỉ để sửa lỗi khởi động. Các lệnh đó không nằm trong bộ khởi động nhanh.

## 6. Giữ bài gọn và an toàn

- Container/project: `huflit-cinema-v2`, volume riêng; không đụng FinWorkshop hoặc container Oracle bản cũ.
- Ảnh và font cần cho giao diện được đóng gói cục bộ.
- `.runtime/`, cache, dependency/build là file sinh lại; không đưa vào gói nộp source.
- Source, package-lock, SQL, kiểm thử và ảnh bằng chứng báo cáo được giữ.
- [Nhật ký dọn dẹp và chỗ khôi phục file](docs/DON_DEP.md).
- [Kết quả v2 ngày 10/11](docs/ket-qua-kiem-thu-v2.md) và kết quả đời trước chỉ là lịch sử, không thay cho log lần chạy mới.

Mật khẩu/kết nối mặc định trong compose chỉ phục vụ máy demo. Không đưa dữ liệu cá nhân, mật khẩu thật hoặc giao dịch thật vào ứng dụng học tập.
