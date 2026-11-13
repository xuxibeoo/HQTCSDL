# Kết quả kiểm tra bản học tập - cập nhật 12/11/2026

Đối tượng: HQTCSDL - Galaxy HUFLIT. Kiểm tra trên máy hiện tại, Docker project `huflit-cinema-v2`, Web/API `http://127.0.0.1:8080`, Oracle Database **23.9.0.25.7**, schema `CINEMA`. Không phải kết quả FinWorkshop.

Ngày 12/11 đã dựng lại bản sửa CSS, thử launcher khi Docker đang tắt (sẵn sàng sau 45 giây), chạy lại schema, 9 ca, API contract và hai bộ kiểm thử Edge. [Tóm tắt lần chạy mới](latest-validations.json). Kiểm tra unit/phân quyền chuẩn bị suất và snapshot tắt/mở dữ liệu bên dưới được thực hiện ngày 11/11, giữ nguyên bằng chứng gốc.

## 1. Kết quả đã thực hiện

| Hạng mục | Kết quả thực tế | Điểm vào/bằng chứng |
|---|---|---|
| Khởi động nhanh | Đạt trên Windows PowerShell 5.1; Docker tự build; chờ API kết nối Oracle thật | `KHOI_DONG.bat`, `tools/start-demo.ps1`, `.runtime/last-start.json` |
| Tắt rồi khởi động lại | Đạt; chạy khi host không còn frontend/node_modules hoặc dist | [restart-preserves-data.json](restart-preserves-data.json) |
| Cấu trúc Oracle | Đúng 16 bảng; 1 package với 3 function và 5 procedure; 3 trigger; 2 view; 1 job đang bật | `tools/verify-schema.py` |
| Kiểm thử lõi Oracle | **9/9 ca đạt**, gồm tình huống lỗi/biên và tranh cùng ghế | `tools/verify.ps1`, `backend/diagnostics.py` |
| API contract | Đạt: tính tiền, giữ chỗ, tranh ghế, thanh toán, hoàn, mã giao dịch lặp, hết hạn/nhả ghế, báo cáo, trigger, audit và plan | `tools/verify-contract.ps1` |
| Giao diện Edge kết nối Oracle | Đạt: 5 phân hệ, đổi phiên, sơ đồ 100 ghế, combo/voucher, giữ/thanh toán/QR/hoàn, từ chối QR sớm, báo cáo, trigger và mobile | `tools/verify-ui-v2.cjs`, [ảnh bằng chứng](evidence/) |
| Hướng dẫn demo | Đạt: 5 chặng, 3 thẻ tình huống, mobile 390 px không tràn ngang, Escape/đóng/mở lại, fallback TC-09 mở đúng Lab | [student-guide-results.json](student-guide-results.json), `tools/verify-student-demo.cjs` |
| Bố cục trang chủ | Đã bổ sung CSS còn thiếu; poster đúng tỷ lệ 2:3, danh sách 4 cột desktop/2 cột mobile, giữ nguyên màu/font và nghiệp vụ | [student-guide-results.json](student-guide-results.json), `frontend/src/style.css` |
| Không tự chạy nghiệp vụ khi mở hướng dẫn | Đạt; không POST chạy test chỉ vì xem hướng dẫn | [student-guide-results.json](student-guide-results.json) |
| Chuẩn bị suất demo | 6/6 unit test; gọi chuẩn bị lặp không tạo thêm suất; anonymous bị 401, khách bị 403, IT được phép | [demo-runtime-results.json](demo-runtime-results.json), `test_demo_schedule.py` |

Các kiểm thử giao dịch chạy trên database demo và có thể tạo đơn/vé minh họa. Đây không phải thử trên production hoặc giao dịch tiền thật.

## 2. Hai phép so sánh execution plan

Số đọc khối đo trong lần kiểm tra này, không lấy lại số đo thời gian trong báo cáo cũ:

| Truy vấn | FULL scan - buffer gets | INDEX - buffer gets | Đối chiếu |
|---|---:|---:|---|
| A: ghế theo suất | 4.037 | 4 | Cùng bind; kết quả khớp; có TABLE ACCESS FULL và INDEX RANGE SCAN |
| B: 10 đơn gần nhất của khách | 2.127 | 13 | Cùng bind; kết quả khớp; có TABLE ACCESS FULL và INDEX RANGE SCAN |

Hai phương án FULL/INDEX được so có kiểm soát. Không suy ra rằng optimizer mặc định luôn chọn đúng một phương án trên mọi dữ liệu hoặc rằng buffer gets tương đương thời gian chạy. Có thể chạy lại trong Lab để lấy plan mới trước khi trình bày.

## 3. Giữ dữ liệu khi tắt/mở

| Đối tượng | Trước tắt | Sau khởi động lại |
|---|---:|---:|
| Bảng | 16 | 16 |
| Đơn đặt vé | 300.054 | 300.054 |
| Vé | 400.301 | 400.301 |
| Ghế | 1.500 | 1.500 |
| Phòng | 15 | 15 |

Đây là snapshot ngày 11/11 sau các kiểm thử có tạo giao dịch demo; không phải số lượng seed ban đầu hay số lượng sau lần chạy ngày 12/11. Volume, bảng và dữ liệu không bị reset.

## 4. Giới hạn phải nói đúng khi demo

- Lúc kiểm tra khoảng 19 giờ ngày 11/11, các phòng rạp 1 đang có suất chiếu nên không tạo được suất QR gần giờ mà vẫn bảo đảm không trùng lịch. Ngày 12/11, hướng dẫn vẫn hiển thị đúng các tình huống hiện có/còn thiếu theo giờ thực. API không dời/hủy suất cũ hoặc thêm phòng để làm đẹp kết quả.
- Hướng dẫn có nút **Kiểm thử QR ngay trong Lab (TC-09)**. Nút chỉ đổi đúng phân hệ/phiên; người trình bày tự bấm chạy ca để chứng minh QR hợp lệ, quét lặp và ràng buộc trạng thái. Dữ liệu thử của ca được rollback.
- Các suất từ chối hoàn/được hoàn phụ thuộc đồng hồ thực và số ghế trống; mở lại hướng dẫn để xem tình trạng mới, không chép cứng mã suất vào slide.
- Thanh toán, hoàn tiền và tài khoản chuyển phiên chỉ phục vụ học tập. Không giới thiệu là ngân hàng/cổng thanh toán thật hoặc hệ thống vận hành thương mại.
- Chưa kiểm chứng cài đặt trên máy Windows sạch chưa có Docker image; lần đầu cần tải image/thư viện. Đã kiểm chứng build từ source và tắt/mở trên máy hiện tại sau khi bỏ dependency/build trên host.

## 5. Phần không được tự nhận đã hoàn thành

Kiểm tra kỹ thuật không thay thế báo cáo Word/PDF, slide, ERD đầy đủ, chứng minh chuẩn hóa hoặc vấn đáp của từng thành viên. Không tạo mới hay chỉnh các tài liệu Word trong công việc dọn project này.

Dùng [bảng đối chiếu tiêu chí](../DOI_CHIEU_TIEU_CHI.md) để biết phần còn cần chuẩn bị và [kịch bản báo cáo](../KICH_BAN_BAO_CAO.md) để tập trình bày 8-10 phút. Không tự chấm điểm hoặc cam kết đạt toàn bộ rubric.
