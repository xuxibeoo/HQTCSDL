# Kiểm tra hiển thị hướng dẫn ôn tập và demo

Ngày kiểm tra: 14/11/2026. Phạm vi: đọc từng ảnh PNG toàn trang ở kích thước đầy đủ, không chỉnh sửa Word trong lượt QA này.

- Tài liệu: `bao-cao/Huong_Dan_Van_Dap_HQTCSDL.docx`.
- SHA256 tài liệu: `1B4679C03EA456E4B56FC8EF30BF6DF1BC38BAE7198FB7C473B53F43A4738918`.
- Bản PDF kiểm tra: `.runtime/review-20261113/guide-final.pdf` (Word export, 12 trang).
- SHA256 PDF: `5BEF108803B33C73E6A0B85D504BE7B4DFF69AE5876DF947E7934DA70710F251`.
- Ảnh đã xem: `.runtime/review-20261113/guide-final-render/page-01.png` đến `page-12.png`, đủ 12/12 trang.

## Kết luận

Đạt kiểm tra bố cục: không phát hiện chữ bị cắt hoặc chồng lên nhau, bảng tràn lề, hàng bảng bị cắt, khối mã ngoài lề, tiêu đề mồ côi hoặc số trang sai. Header và footer nhất quán. Không còn trang cuối chỉ có một đoạn tài liệu tham khảo và khoảng trống lớn như bản 13 trang trước đó.

Đây là kiểm tra hiển thị và tính nhất quán của phần hướng dẫn, không thay thế kiểm thử chạy SQL hay bảo đảm điểm vấn đáp. Kết quả kiểm thử phiên đăng nhập, nhãn Lab và SQL hiển thị nằm riêng ở `session-ui-results.json`.

## Kết quả từng trang

| Trang | Nội dung đã xem | Kết quả |
| --- | --- | --- |
| 01 | Tiêu đề, mô tả mục tiêu, bảng cấu trúc và quy tắc nghiệp vụ | Đạt; bảng nằm trọn trong lề, không va footer. |
| 02 | Hướng dẫn launcher, cổng, dữ liệu mẫu và mở kết nối DBeaver | Đạt; tiêu đề DBeaver có đoạn giới thiệu theo sau, không mồ côi. |
| 03 | Bảng cấu hình DBeaver, thao tác xem đối tượng và xử lý lỗi kết nối | Đạt; bảng và đoạn văn rõ. Mã ORA-01017 xuống dòng ở dấu nối nhưng không mất ký tự. |
| 04 | Bảng thứ tự đọc source, phân biệt vai trò ứng dụng với Oracle user | Đạt; ô dài không tràn, các đường dẫn đầy đủ. |
| 05 | Lược đồ, unique index, chuẩn hóa, dữ liệu hiệu năng | Đạt; heading và nội dung liền mạch, không có dòng bị che. |
| 06 | Quy tắc doanh thu, bằng chứng đo và bảng demo chín phút | Đạt; toàn bộ hàng bảng đọc được và giữ trọn trên trang. |
| 07 | Giới hạn shortcut, khôi phục phiên và bảng TC-01 đến TC-09 | Đạt; đủ chín ca. Đường dẫn cuối trang tiếp tục sang trang 08, không mất chữ. |
| 08 | DBeaver với hai connection, block PL/SQL, COMMIT và ROLLBACK | Đạt; block mã đọc rõ, không bị cắt hoặc tràn. |
| 09 | Execution Plan, DBMS_XPLAN, hint và phần vấn đáp vòng một | Đạt; SQL nằm trong khối, heading cuối trang vẫn có nội dung theo sau. |
| 10 | Cursor, function, ngoại lệ, compound trigger, transaction và thay đổi nghiệp vụ | Đạt; đoạn hỏi đáp liên tục, không chồng chữ hoặc va footer. |
| 11 | Voucher, hoàn vé, isolation, tải lịch sử và bài tập SQL | Đạt; truy vấn đầy đủ, lưu ý timezone và transaction đọc được. |
| 12 | Checklist bảo vệ và toàn bộ tài liệu tra cứu | Đạt; danh sách tham khảo và ghi chú runtime cùng nằm trên trang, footer đúng. |

## Giới hạn và lưu ý

- Ngắt dòng tự nhiên ở một vài mã lỗi/đường dẫn không phải mất nội dung; chưa thấy lỗi cần chỉnh thêm.
- Hướng dẫn phân biệt thanh toán mô phỏng với tích hợp ngân hàng thật; 400.000 vé tổng hợp với kiểm thử đồng thời; vai trò ứng dụng với Oracle user; kết quả đo thật với số liệu cũ. Không thấy phát biểu bảo đảm điểm hoặc production readiness.
- Các ảnh render/PDF là bằng chứng cục bộ trong `.runtime`, không phải tài liệu bàn giao bổ sung.
