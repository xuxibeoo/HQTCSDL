# Kết quả kiểm thử Galaxy HUFLIT v2

Kiểm thử ngày 10/11/2026 trên Oracle Database Free 23ai `23.9.0.25.7`, schema `CINEMA`, Docker Compose `huflit-cinema-v2`. Không sử dụng lại volume của bản cũ.

## Cơ sở dữ liệu

`tools/verify-schema.py` đối chiếu tên của từng bảng và từng cột trong data dictionary. Kiểm tra đạt 16 bảng, 3 hàm, 5 thủ tục, 3 trigger hợp lệ, 2 view hợp lệ, 1 job mỗi phút, các chỉ mục yêu cầu và 1.500 ghế. `sql/07_tests.sql` chạy thành công qua SQL*Plus.

| Ca | Kết quả thực tế |
|---|---|
| TC-01 | Hai ghế VIP giữ 10 phút; 100.000 × 1,2 + 20.000 = 140.000 đồng/ghế; có hai dòng nhật ký. |
| TC-02 | Lần giữ F5 thứ hai nhận ORA-20021, không ghi đơn dở dang. |
| TC-03 | Phiên B chờ trong lúc A giữ F5 chưa commit; B nhận ORA-20021 sau khi A commit. |
| TC-04 | Mã giảm 10% sinh vé QR và cộng điểm; mã hết lượt nhận ORA-20026. |
| TC-05 | Thanh toán quá hạn nhận ORA-20023; thủ tục đổi vé sang HET_HAN và ghế đặt lại được. |
| TC-06 | Mã giao dịch trùng nhận ORA-20027; đơn thứ hai vẫn giữ ghế. |
| TC-07 | Còn 1 giờ: ORA-20025. Còn hơn 2 giờ: hủy vé và ghi hoàn tiền đúng số tiền. |
| TC-08 | Trùng giờ hoặc cách 10 phút bị chặn với ORA-20031; khoảng nghỉ 20 phút hợp lệ. |
| TC-09 | Quét lần đầu HOP_LE, lần hai DA_SU_DUNG; cập nhật lùi trạng thái nhận ORA-20032. |

## API và kế hoạch thực thi

`tools/verify-contract.ps1` chạy thành công trên API: ba hạng khách demo, danh mục, 100 ghế của suất, tạm tính, giữ ghế, tranh chấp, thanh toán/QR, hoàn tiền, giao dịch trùng, hết hạn/nhả ghế, bốn báo cáo, trigger, audit và execution plan. CORS preflight từ `http://localhost:5173` trả HTTP 200.

`tools/verify.ps1` chạy cả 9 ca và hai phép so sánh bằng `DBMS_XPLAN.DISPLAY_CURSOR`. Hai phương án của mỗi truy vấn dùng cùng tham số và trả cùng kết quả.

| Dữ liệu | Truy vấn A: quét toàn bảng → chỉ mục | Truy vấn B: quét toàn bảng → chỉ mục |
|---|---:|---:|
| Seed nhỏ | 7 → 3 buffer gets | 6 → 4 buffer gets |
| Sau khi nạp thêm 400.000 vé, 300.000 đơn và 6.750 suất lịch sử | 3.986 → 4 buffer gets | 2.115 → 8 buffer gets |

Đây là số lượt đọc khối logic của hai execution plan, không phải số đo thời gian INSERT trước và sau khi tạo chỉ mục.

## Giao diện Edge

`tools/verify-ui-v2.cjs` chạy qua năm phân hệ: đổi phiên khách hàng/soát vé/kỹ thuật, chọn suất, lưới 100 ghế, chọn combo và voucher, giữ ghế, thanh toán, vé QR, hoàn tiền, từ chối quét quá sớm, xem SQL báo cáo, kiểm thử chồng lịch và mở giao diện mobile 390 px. Không ghi nhận ngoại lệ JavaScript. Ảnh nằm trong `docs/evidence-v2`.
