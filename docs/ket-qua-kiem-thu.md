# Kết quả kiểm thử HUFLIT Cinema

Môi trường đo ngày 07/11/2026. Oracle Database Free 23ai `23.9.0.25.7` chạy trong Docker, schema `CINEMA`. Bộ dữ liệu thử tải thêm 105.000 đơn và 105.000 vé vào dữ liệu mẫu. Phép đo lấy số liệu ở nút gốc của lần chạy thực tế từ Oracle, cùng biến bind và cùng kết quả giữa hai kế hoạch.

## Kiểm thử nghiệp vụ

| Ca | Kết quả ghi nhận | Trạng thái |
|---|---|---|
| TC-01 | Hạn giữ đúng 10 phút. Thanh toán cập nhật đơn, vé và sinh QR. | Đạt |
| TC-02 | Ghế VIP cuối tuần: (100.000 + 20.000) × 1,16 = 139.200 đồng. | Đạt |
| TC-03 | A khóa F5, B chờ. A COMMIT, B nhận ORA-20021. Chỉ có một vé trong suất thử. | Đạt |
| TC-04 | Đơn quá hạn trả ORA-20023. Hai lần giữ hết hạn vẫn lưu được và có thể giữ lại cùng ghế. | Đạt |
| TC-05 | Voucher giới hạn một lượt từ chối thanh toán thứ hai với ORA-20026. | Đạt |
| TC-06 | Mã giao dịch lặp trả ORA-20027 và đơn thứ hai vẫn giữ ghế. | Đạt |
| TC-07 | Hủy trước một giờ bị từ chối với ORA-20025. Hủy khi còn hơn hai giờ ghi phiếu hoàn. | Đạt |
| TC-08 | Quét lần đầu trả HOP_LE. Quét lại trả DA_SU_DUNG. | Đạt |
| TC-09 | Nghỉ 14 phút bị chặn, đúng 15 phút được chấp nhận. Chuyển vé giữ thẳng sang đã sử dụng trả ORA-20032. | Đạt |

Kiểm thử giao diện trên Chrome đã đi qua chọn phim, rạp, ngày, suất, ghế thường và VIP, áp voucher, mua combo, thanh toán, sinh QR, hủy một vé, quét vé còn lại hai lần và chạy TC-03. Ảnh chụp thao tác nằm trong `docs/evidence`.

## Hai truy vấn trước và sau tối ưu

| Truy vấn | Biến bind | Baseline ép FULL | Tối ưu ép INDEX | Buffer gets | Số dòng |
|---|---:|---|---|---:|---:|
| A · Ghế hiệu lực theo suất | 371 | TABLE ACCESS FULL VE | INDEX RANGE SCAN IX_VE_SUAT_TT_GHE | 1.074 → 4 | 100 |
| B · 10 đơn gần nhất | 1 | TABLE ACCESS FULL và SORT ORDER BY STOPKEY | INDEX RANGE SCAN IX_DON_KH_TG và truy cập theo ROWID | 752 → 7 | 10 |

Ở lần ghi nhận này, buffer gets giảm khoảng 99,63% cho A và 99,07% cho B. Query A đọc trực tiếp các cột từ chỉ mục. Query B vẫn đọc dòng bảng để lấy tổng tiền và trạng thái, nhưng loại được bước sắp xếp của baseline. Thời gian và buffers có thể thay đổi theo dữ liệu, bộ nhớ đệm và phiên đo.

Chạy `tools/verify.ps1` hoặc mở Kỹ thuật IT → Execution plan thực tế để tái lập số liệu. Kế hoạch của mỗi lần chạy có SQL ID, child number, dòng trả về và nội dung `DBMS_XPLAN.DISPLAY_CURSOR`.
