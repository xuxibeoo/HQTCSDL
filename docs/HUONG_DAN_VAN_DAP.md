# Hướng dẫn ôn tập và demo đồ án HQTCSDL

Tài liệu dành cho ba thành viên nhóm chuẩn bị bảo vệ hệ thống đặt vé Galaxy HUFLIT. Mục tiêu là tự chạy được ứng dụng, giải thích được SQL và PL/SQL, xử lý tình huống thay đổi và viết truy vấn trực tiếp. Rubric dành 20 điểm cho vấn đáp, 10 điểm cho slide và trình bày; tài liệu hỗ trợ ôn tập, không bảo đảm một mức điểm.

## 1 Nắm bài trong một phút

Ứng dụng React gọi FastAPI; API dùng connection pool python-oracledb để gọi Oracle Database 23ai trong Docker. Khách chọn suất và ghế, giữ chỗ 10 phút, thanh toán mô phỏng để phát QR, sau đó có thể hủy vé nếu đủ điều kiện. Oracle dùng unique index chống bán trùng ghế, package quản lý giao dịch, compound trigger chống trùng lịch, trigger trạng thái và audit, Scheduler nhả ghế hết hạn. Báo cáo dùng CTE và Window Functions.

| Nội dung phải nhớ | Giá trị trong mã nguồn |
|---|---|
| Schema và service | CINEMA và FREEPDB1 |
| Cấu trúc | 16 bảng, 1 package, 3 function công khai, 5 procedure công khai, 3 trigger, 2 view, 1 job |
| Giữ chỗ | 10 phút |
| Hủy vé | Trước giờ chiếu ít nhất 2 giờ; vé đã thanh toán và chưa sử dụng |
| Soát QR | Từ 30 phút trước giờ chiếu đến hết suất; chỉ dùng một lần |
| Dọn phòng | Hai suất cùng phòng cách nhau tối thiểu 15 phút |
| Cuối tuần | Giá cơ bản nhân 1,2 rồi cộng phụ thu ghế; làm tròn đến nghìn đồng |
| Voucher | Ngày bắt đầu và ngày kết thúc đều được tính; kiểm tra lại lượt dùng lúc thanh toán |
| Giao dịch | READ COMMITTED; API hoặc job COMMIT, lỗi thì ROLLBACK |

Không lẫn 10 phút giữ chỗ, 15 phút dọn phòng và 30 phút soát vé. Không gọi thanh toán mô phỏng là tích hợp ngân hàng thật.

## 2 Bạn trong nhóm tải từ GitHub và chạy

1. Tải ZIP từ repository HQTCSDL hoặc clone repository. Giải nén toàn bộ vào thư mục riêng; không chạy trực tiếp trong file ZIP.
2. Cài Docker Desktop, bật WSL 2 và mở Docker Engine. Lần đầu cần Internet để tải image Oracle, Node/Python và thư viện. Không cần cài Oracle, Node hay Python riêng để chạy ứng dụng.
3. Bấm đúp KHOI_DONG.bat. Giữ cửa sổ mở trong khi launcher dựng image và chờ Oracle. Khi sẵn sàng, trình duyệt mở hướng dẫn demo.
4. Mở http://127.0.0.1:8080/?demo=1. Kiểm tra dòng Oracle đã kết nối. Swagger ở http://127.0.0.1:8080/docs chỉ để xem API, không thay phần demo giao diện.
5. Bấm DUNG_UNG_DUNG.bat khi kết thúc. Tắt ứng dụng không xóa volume và dữ liệu. Không dùng docker compose down -v để chữa lỗi khởi động.

Mặc định dùng cổng web 8080 và Oracle 1521. Nếu bị chiếm, sao chép .env.example thành .env, sửa WEB_PORT/ORACLE_PORT rồi chạy lại. Dùng URL và cổng launcher in ra. Không tự tắt phần mềm khác. Không đổi mật khẩu của volume đã tạo mà không có kế hoạch cập nhật tài khoản Oracle.

Lần đầu chỉ nạp dữ liệu nhỏ cho demo; không tự động nạp 400.000 vé. NAP_DU_LIEU_HIEU_NANG.bat là bước tùy chọn để tạo bộ tải lịch sử phục vụ execution plan, không phải điều kiện để đặt vé. Lần đầu có thể mất nhiều phút; các lần sau dùng lại image và volume. Kết quả kiểm tra trên máy đã có image không đại diện tốc độ tải trên máy mới.

## 3 Kết nối Oracle bằng DBeaver

Mở Database rồi New Database Connection, chọn Oracle. Chọn kết nối Basic theo Service name, không chọn SID cho FREEPDB1. Điền các giá trị mặc định dưới đây; nếu có .env riêng thì dùng cổng và mật khẩu của cấu hình đó.

| Trường | Giá trị mặc định của bản demo |
|---|---|
| Host | 127.0.0.1 |
| Port | 1521 |
| Service name | FREEPDB1 |
| Username | CINEMA |
| Password | CinemaLocalApp23_Dev |
| Role | Normal, không chọn SYSDBA |
| JDBC URL nếu cần | jdbc:oracle:thin:@//127.0.0.1:1521/FREEPDB1 |

Bấm Test Connection. Lần đầu DBeaver có thể yêu cầu tải JDBC driver; cho phép tải khi có Internet. Sau khi thành công, mở connection, chọn schema CINEMA. Không dùng tài khoản SYS để thao tác nghiệp vụ.

Trong Database Navigator, mở Tables để xem 16 bảng; mở Packages và PKG_DAT_VE để xem specification/body; mở Triggers, Views, Indexes và Scheduler khi phiên bản giao diện có các mục đó. Có thể dùng trang Source hoặc DDL của đối tượng. Nếu không thấy đúng tab, chạy USER_SOURCE trong tools/review-oracle.sql thay vì đoán theo giao diện.

Tạo SQL Editor gắn với connection CINEMA. Mở tools/review-oracle.sql từ thư mục source, chọn từng SELECT và thực thi. Đây là file chỉ đọc. Không chạy sql/01_schema.sql để xem code vì file này có DROP và sẽ cài lại schema. DBeaver đọc file không đồng nghĩa phải thực thi cả file.

Nếu nhận ORA-12514, kiểm tra Service name và chờ Oracle sẵn sàng. Nếu ORA-01017, đối chiếu tài khoản với cấu hình đã dùng khi tạo volume. Nếu không có bảng, kiểm tra đang ở FREEPDB1 và schema CINEMA, rồi xem log bootstrap. Không xóa volume để thử lại mật khẩu.

## 4 Review code theo đúng thứ tự

| Thứ tự | Mở file | Điều cần giải thích |
|---|---|---|
| 1 | compose.yaml và database/install.sql | Web/API/Oracle được nối như thế nào, volume giữ dữ liệu, thứ tự nạp SQL |
| 2 | sql/01_schema.sql | 16 bảng, PK/FK/CHECK/UNIQUE; tại sao một đơn có nhiều vé |
| 3 | sql/02_pkg_dat_ve.sql | Specification là hợp đồng; body có helper riêng; 3 hàm và 5 thủ tục công khai |
| 4 | sql/03_triggers.sql | Compound trigger, khóa dòng phòng, chuyển trạng thái, ghi audit |
| 5 | sql/04_job_views_grants.sql | Hai view, job mỗi phút, job tự COMMIT sau khi nhả ghế |
| 6 | backend/db.py và backend/main.py | Pool, bind, quyền vai trò, callproc/callfunc, COMMIT/ROLLBACK, ánh xạ lỗi HTTP |
| 7 | backend/diagnostics.py | Mục tiêu từng TC, dữ liệu thử và cách đối chiếu kết quả |
| 8 | sql/08_optimize.sql và Lab | Hai index tối ưu, FULL/INDEX, kết quả khớp và số đọc khối |

Các vai trò chuyển phiên trên web là quyền của ứng dụng, không phải các Oracle user tương ứng. Bản học tập dùng một schema CINEMA; không giới thiệu rằng CINEMA_OWNER/CINEMA_API hoặc Oracle role đã được triển khai nếu source không tạo chúng. Đây là đơn giản hóa có chủ đích, không phải cấu hình production.

PKG_DAT_VE.SP_GIU_CHO giữ và tính tiền vé. API thêm DON_COMBO và cộng tiền combo trong cùng giao dịch trước COMMIT. Khi thanh toán, package chốt số phải trả, phát QR và cộng điểm. Khi hoàn từng vé, package khóa đơn trước rồi khóa vé, phân bổ tiền hoàn lũy kế và thu hồi đúng phần điểm, không hoàn tiền combo theo việc hủy một vé.

## 5 Hiểu lược đồ và chuẩn hóa

Nhóm rạp/phòng/ghế gồm RAP, PHONG_CHIEU, LOAI_GHE, GHE. Nhóm phim/lịch gồm PHIM, THE_LOAI, PHIM_THE_LOAI, SUAT_CHIEU. Nhóm giao dịch gồm KHACH_HANG, KHUYEN_MAI, DON_DAT_VE, VE, THANH_TOAN, COMBO, DON_COMBO, NHAT_KY_VE.

Một ghế vật lý có thể bán trong nhiều suất; điều bị cấm là cùng cặp mã suất và mã ghế có hai vé còn hiệu lực. Vì vậy không đặt UNIQUE chỉ trên ma_ghe. Unique index dựa trên hàm chỉ giữ khóa của GIU_CHO, DA_THANH_TOAN và DA_SU_DUNG; vé DA_HUY/HET_HAN có khóa NULL nên có thể bán lại ghế và vẫn giữ lịch sử.

Ví dụ 1NF: không lưu danh sách thể loại trong một chuỗi, dùng PHIM_THE_LOAI. Ví dụ 2NF: DON_COMBO có khóa kép ma_don/ma_combo, số lượng và giá chốt phụ thuộc cả dòng mua. Ví dụ 3NF: tên rạp ở RAP, tên loại ghế/phụ thu ở LOAI_GHE, không lặp lại trong bảng con. Không khẳng định mọi bảng đạt BCNF chỉ vì có khóa tự tăng; phải nêu phụ thuộc hàm và khóa dự tuyển.

Gia_ve và DON_COMBO.don_gia là giá chốt lịch sử, không tự thay khi bảng giá đổi. DON_DAT_VE.tong_tien/tien_giam là số tổng lưu có chủ đích, do API/package cập nhật cùng transaction. Giải thích lý do lưu và cơ chế giữ nhất quán thay vì nói mọi dữ liệu lặp đều sai.

## 6 Kiểm chứng dữ liệu và số liệu báo cáo

Mở nhóm truy vấn đếm trong tools/review-oracle.sql. Đếm toàn bộ VE không chứng minh rằng đã kiểm thử từng vé. Truy vấn riêng dải lịch sử từ 01/01/2023 08:00 đến trước 01/04/2023 08:00 xác định bộ tải cố định; marker PERF-V2-300000 xác định lần nạp hoàn tất.

Bộ tải gồm 6.750 suất, 300.000 đơn và 400.000 vé tổng hợp để đo đọc dữ liệu. Nạp tải không phải chạy 400.000 người dùng đồng thời, không phải 400.000 lượt thanh toán qua giao diện. Chín TC là bộ kiểm thử nghiệp vụ riêng. Số tổng thực tế có thể lớn hơn do seed nhỏ và giao dịch demo phát sinh.

Báo cáo phim/CTE tính tổng giá vé trước giảm giá của vé còn hiệu lực theo ngày chiếu; đây không phải dòng tiền ròng sau voucher, combo và hoàn tiền. Dữ liệu tải ở năm 2023 không tự xuất hiện trong biểu đồ 12 tháng hiện tại. Biểu đồ bằng 0 ở tháng không có vé phù hợp có thể là kết quả đúng; tạo giao dịch mẫu trong ngày để minh họa sự thay đổi.

Không đọc lại các số Cost hoặc thời gian cũ như số đo mới. Chỉ dùng log/JSON của lần chạy có ghi ngày, cùng bind và cùng dữ liệu; giải thích ý nghĩa thay vì học thuộc số.

## 7 Kịch bản demo trong chín phút

| Thời gian | Thao tác thật | Câu giải thích ngắn |
|---|---|---|
| 0:00 đến 1:00 | Mở web, health, ba lớp và bộ chuyển vai trò | React gọi FastAPI, API kết nối Oracle 23ai; thanh toán là mô phỏng |
| 1:00 đến 3:00 | Khách hàng 1 chọn suất còn xa, ghế, combo/voucher; giữ rồi thanh toán | Sơ đồ ghế đọc Oracle; giá từ hàm; package/unique index giữ chỗ; thanh toán mới phát QR |
| 3:00 đến 4:00 | Xem Vé của tôi; hủy một vé đủ điều kiện | Package kiểm tra mốc hai giờ, ghi hoàn tiền và thu hồi điểm |
| 4:00 đến 5:00 | Chuyển Soát vé; kiểm tra QR phù hợp hoặc mở TC-09 | QR quá sớm bị từ chối là đúng; hợp lệ chỉ dùng một lần |
| 5:00 đến 6:00 | Mở báo cáo và cửa sổ SQL | Chỉ CTE, DENSE_RANK, LAG, SUM OVER và LEFT JOIN bù kỳ trống |
| 6:00 đến 8:00 | IT mở Lab; chọn TC-03/TC-08/TC-09 hoặc hai plan | Chỉ một phiên chiếm ghế; lịch trùng bị chặn; số đọc khối giảm khi dùng index |
| 8:00 đến 9:00 | Mở DBeaver và source package/trigger | Chỉ ra khóa, dòng xử lý lỗi, nơi COMMIT; kết thúc bằng giới hạn thật |

Hướng dẫn demo có shortcut chọn suất theo thời gian hiện tại. Nếu phòng đang kín lịch, hệ thống không tự dời suất cũ để tạo ca đẹp; dùng TC-09 cho QR và TC-07 cho điều kiện hoàn. Nút shortcut chỉ mở phân hệ/đổi phiên, người trình bày tự bấm chạy test hoặc thực hiện giao dịch.

Trước khi demo, mở lại trang sau khi API khởi động. Phiên cũ không hợp lệ được kiểm tra và khôi phục về khách mẫu khi bật demo; hệ thống không tự gửi lại thao tác đặt hoặc thanh toán.

## 8 Chín ca kiểm thử và kết quả cần chỉ ra

| Ca | Thao tác | Kết quả mong đợi |
|---|---|---|
| TC-01 | Giữ hai ghế VIP, kiểm tra hạn và audit | Hai vé GIU_CHO, hạn 10 phút, giá đúng, hai dòng nhật ký |
| TC-02 | Giữ lại cùng ghế theo thứ tự | ORA-20021; không để lại đơn dở dang |
| TC-03 | Hai phiên giữ cùng ghế | Phiên B chờ A; A COMMIT thì B nhận ORA-20021 |
| TC-04 | Thanh toán có voucher và thử mã hết lượt | Phát QR/cộng điểm đúng; mã hết lượt bị ORA-20026 |
| TC-05 | Thanh toán quá hạn rồi giải phóng | ORA-20023; đơn/vé HET_HAN và ghế đặt lại được |
| TC-06 | Dùng lại mã giao dịch ngoài | ORA-20027; không ghi nhận thanh toán hai lần |
| TC-07 | Hủy trước hai giờ và hủy quá sát giờ | Hoàn đúng ở ca hợp lệ; ORA-20025 ở ca không được hủy |
| TC-08 | Lịch trùng, nghỉ 10 phút, nghỉ 20 phút | Hai ca đầu ORA-20031, ca cuối thành công |
| TC-09 | Quét QR hai lần và chuyển lùi trạng thái | HOP_LE rồi DA_SU_DUNG; chuyển lùi bị ORA-20032 |

Mở Lab bằng vai trò Kỹ thuật IT và chạy từng ca để đọc log. Khi cần chạy lại toàn bộ, dùng tools/verify.ps1; dùng tools/verify-contract.ps1 cho luồng API, tools/verify-schema.py cho cấu trúc. Các test có thể tạo dữ liệu minh họa, chỉ chạy ở database học tập. Chặn đúng mã lỗi mong đợi là test đạt, không phải ứng dụng hỏng.

Kiểm tra thêm voucher ngày cuối còn dùng được, hôm sau hết hạn; hoàn hai vé khi đơn có combo và số tiền giảm lẻ không tạo hoặc mất tiền do làm tròn. Kết quả bổ sung ở docs/qa-20261113/ để xem bằng chứng của lần rà soát.

## 9 Thử tranh chấp ghế trong DBeaver

Chỉ thử trên bản demo. Mở hai connection độc lập cùng tài khoản CINEMA, tắt Auto-commit ở cả hai. Chạy SELECT SYS_CONTEXT('USERENV','SID') FROM dual để chắc chắn có hai SID khác nhau; hai editor có thể vẫn dùng chung một phiên nếu không tạo connection riêng.

Dùng truy vấn ghế trống trong tools/review-oracle.sql để chọn cùng ma_suat và ma_ghe. Lấy hai khách tồn tại từ KHACH_HANG. Thay các giá trị ví dụ dưới đây bằng mã đã truy vấn; không mặc định ma_suat=1 còn mở bán sau nhiều ngày.

```sql
-- Phiên A, thay 123 và 456 bằng mã thật vừa tra cứu.
DECLARE
  v_don NUMBER;
BEGIN
  pkg_dat_ve.sp_giu_cho(
    p_ma_kh => 1, p_ma_suat => 123,
    p_ds_ghe => '[456]', p_ma_don => v_don);
  DBMS_OUTPUT.PUT_LINE('Don A=' || v_don);
END;
```

Không COMMIT ngay. Ở phiên B chạy cùng block với p_ma_kh=2, cùng suất và ghế. B chờ khóa của A. Để thử mà không lưu giao dịch, chạy ROLLBACK ở A: B tiếp tục giữ thành công; sau đó ROLLBACK ở B. Nếu chọn COMMIT ở A, B phải nhận ORA-20021; biến thể này có ghi dữ liệu demo của A. Không bấm chạy nhiều lần khi đang chờ khóa.

Khi chạy PL/SQL bằng DBeaver, chọn toàn bộ DECLARE đến END; và dùng thao tác Execute SQL Statement của editor; không đưa VARIABLE, EXEC hoặc dấu / của SQL*Plus vào giữa block. Mở DBMS Output cho connection nếu muốn xem PUT_LINE. Đóng phiên không thay thế việc chủ động COMMIT/ROLLBACK.

## 10 Review execution plan mà không phá chỉ mục

Ưu tiên nút Execution Plan trong Lab: API chạy FULL và INDEX trên cùng bind, thu kế hoạch thật và kiểm tra kết quả khớp. Không DROP index đang dùng để tạo ảnh trước/sau. Hai phương án có hint minh họa cách truy cập, không chứng minh optimizer mặc định luôn chọn cùng phương án.

Để xem trực tiếp trong DBeaver, chọn một mã suất từ truy vấn ghế và chạy câu A với bind ma_suat. Sau đó lấy SQL_ID/CHILD_NUMBER của chính câu có nhãn HQT_ORAL_A_INDEX trong V$SQL và truyền vào DISPLAY_CURSOR. DBeaver có thể chạy câu nền nên không luôn dựa vào cursor cuối cùng.

```sql
SELECT /*+ GATHER_PLAN_STATISTICS
           INDEX(v IX_VE_SUAT_TT_GHE) */
       /* HQT_ORAL_A_INDEX */ ma_ghe, trang_thai
FROM ve v
WHERE ma_suat=:ma_suat
  AND trang_thai IN ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG');

SELECT sql_id, child_number, last_active_time
FROM v$sql
WHERE sql_text LIKE 'SELECT /*+ GATHER_PLAN_STATISTICS%'
  AND INSTR(sql_text,'HQT_ORAL_A_INDEX')>0
ORDER BY last_active_time DESC;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(
  :sql_id, :child_number, 'ALLSTATS LAST'));
```

Câu A dùng index bao phủ nên có thể không đọc lại bảng VE. Câu B lấy 10 đơn gần nhất theo khách, dùng IX_DON_KH_TG rồi truy cập ROWID khi cần cột ngoài index. Chỉ đúng TABLE ACCESS FULL, INDEX RANGE SCAN, A-Rows, Buffers; Cost là ước lượng, elapsed time là số đo phụ thuộc cache và môi trường. Mở code benchmark ở backend/diagnostics.py để xem đúng hai truy vấn; sql/08_optimize.sql chỉ tạo index và cập nhật thống kê. Không chạy DDL chỉ để đọc plan.

## 11 Ôn ba vòng vấn đáp

### Vòng một Giải thích đoạn code bất kỳ

Hỏi: Vì sao gộp vào package? Trả lời: Specification công khai tám thao tác; body dùng chung hằng số, helper tính giờ/giảm giá và xử lý giao dịch. API không cần biết chi tiết cài đặt; không có nghĩa mọi procedure trong body đều công khai.

Hỏi: Vì sao có cursor tường minh nhưng vẫn dùng FOR loop? Trả lời: c_don được khai báo riêng để khóa FOR UPDATE SKIP LOCKED và UPDATE WHERE CURRENT OF. FOR r IN c_don tự OPEN/FETCH/CLOSE. Không nên nói đồ án tự điều khiển ba lệnh này nếu code không làm vậy.

Hỏi: Function có gọi từ SQL được không? Trả lời: Các hàm tính giá/điều kiện chỉ đọc và trả giá trị có thể gọi từ SELECT. Function có DML hoặc COMMIT không tùy tiện gọi trong truy vấn vì có hạn chế ngữ cảnh SQL. Không suy rộng rằng mọi function đều dùng ở SELECT được.

Hỏi: Ngoại lệ bị bỏ qua thì sao? Trả lời: Không in lỗi rồi tiếp tục như thành công. SP_GIU_CHO đặt SAVEPOINT, bắt DUP_VAL_ON_INDEX, ROLLBACK TO rồi trả mã nghiệp vụ; API hoàn tác giao dịch khi lỗi. Lỗi một câu lệnh không đồng nghĩa mọi thao tác trước đó của phiên tự bị rollback.

Hỏi: Vì sao cần compound trigger? Trả lời: Đọc SUAT_CHIEU trong row trigger của chính bảng có nguy cơ ORA-04091. AFTER EACH ROW chỉ gom mã, AFTER STATEMENT kiểm tra. Trigger còn khóa PHONG_CHIEU theo mã phòng trước câu truy vấn xung đột để các phiên cùng phòng được xử lý tuần tự.

Hỏi: Ai COMMIT? Trả lời: API khi hoàn thành toàn bộ transaction; job có block gọi nhả ghế rồi COMMIT. Package không tự COMMIT từng bước để caller vẫn có thể rollback cả thao tác.

### Vòng hai Tình huống thay đổi

Hỏi: Bỏ unique index thì sao? Trả lời: Hai phiên có thể cùng thấy ghế trống rồi cùng INSERT. SELECT COUNT(*) trước INSERT không thay ràng buộc duy nhất. Phải giữ kiểm soát tại DB, không chỉ khóa nút giao diện.

Hỏi: Đổi giữ chỗ từ 10 thành 5 phút? Trả lời: Đổi c_phut_giu_cho trong specification, compile lại package/body và kiểm tra hạn đơn mới, UI đếm từ han_thanh_toan API, job quá hạn và các test. Không chỉ đổi chữ trên giao diện. Đơn cũ giữ hạn đã chốt nếu không có yêu cầu di chuyển riêng.

Hỏi: Hai người dùng lượt voucher cuối cùng? Trả lời: Giữ chỗ chưa giữ riêng lượt voucher. Khi thanh toán, khóa dòng khuyến mãi rồi kiểm tra lại hạn/lượt; một giao dịch tăng lượt, giao dịch sau có thể bị từ chối. Không hứa voucher chắc chắn còn chỉ vì báo giá trước đó hợp lệ.

Hỏi: Hoàn hai vé cùng đơn có sai điểm không? Trả lời: Khóa đơn trước để tuần tự; tiền hoàn theo tỷ lệ phần vé sau giảm và làm tròn lũy kế; điểm trừ theo chênh lệch trước/sau. Combo không bị hoàn theo vé. Chỉ bằng floor từng vé riêng có thể để sót điểm khi có số tiền lẻ.

Hỏi: Vì sao không dùng SERIALIZABLE? Trả lời: READ COMMITTED kết hợp unique index và khóa dòng xử lý các xung đột cần thiết. SERIALIZABLE có thể phát sinh ORA-08177 và cần retry; nâng mức cô lập không thay tất cả ràng buộc nghiệp vụ.

Hỏi: Vì sao biểu đồ có tháng bằng 0 dù có 400.000 vé? Trả lời: Bộ tải ở 2023; biểu đồ lọc 12 tháng hiện tại. LEFT JOIN lịch tháng cố ý giữ kỳ trống. Xem đúng bộ lọc và quy tắc doanh thu trước khi kết luận thiếu dữ liệu.

### Vòng ba Viết và sửa trực tiếp

Tự gõ lại truy vấn sau, giải thích JOIN và COUNT(v.ma_ve) thay vì COUNT(*) để suất chưa bán có kết quả 0. Sau đó thử thêm điều kiện rạp hoặc lọc ngày theo yêu cầu giám khảo.

```sql
SELECT s.ma_suat, p.ten_phim, COUNT(v.ma_ve) so_ve
FROM suat_chieu s
JOIN phim p ON p.ma_phim=s.ma_phim
LEFT JOIN ve v ON v.ma_suat=s.ma_suat
  AND v.trang_thai IN ('DA_THANH_TOAN','DA_SU_DUNG')
WHERE s.gio_bat_dau>=TRUNC(SYSDATE)
  AND s.gio_bat_dau<TRUNC(SYSDATE)+1
GROUP BY s.ma_suat,p.ten_phim
ORDER BY so_ve DESC,s.ma_suat;
```

SYSDATE trong ví dụ dựa vào múi giờ máy Oracle; bản chạy Docker đặt Asia/Ho_Chi_Minh. Trong API, dùng biểu thức giờ Việt Nam tường minh ở backend/db.py. Nếu triển khai ở múi giờ khác thì phải giữ cùng quy ước, không sửa bừa ở từng màn hình.

Luyện thêm hai câu không cần đổi dữ liệu: liệt kê đơn chờ đã quá hạn; xếp hạng phim trong từng tháng bằng DENSE_RANK. Với yêu cầu viết PL/SQL, giải thích đầu vào, giá trị OUT, ngoại lệ và transaction trước khi gõ. Không chạy CREATE OR REPLACE lên package chung khi chỉ đang minh họa ý tưởng; dùng bản demo riêng hoặc block thử có ROLLBACK.

## 12 Checklist trước buổi bảo vệ

1. Chạy bằng đúng máy sẽ demo, mở health, web và DBeaver trước giờ trình bày.
2. Có suất còn xa cho hoàn vé; có QR gần giờ hoặc fallback TC-09; không dùng mã suất cố định từ slide.
3. Mở sẵn đúng package/body, unique index, compound trigger, job và hai query plan.
4. Mỗi thành viên tự gõ một truy vấn và tự giải thích một function/procedure; cả ba nắm luồng UI đến API đến Oracle.
5. Slide khoảng tám trang: bài toán, ERD, ràng buộc/khó, package/trigger, kiến trúc, test, plan, kết luận. Không chép toàn bộ báo cáo lên slide.
6. Chỉ trình bày số đo có bằng chứng. Nêu thật thanh toán mô phỏng, tài khoản demo, chưa thử hàng trăm người đồng thời và chưa đánh giá bảo mật production.
7. Giữ bản source và hướng dẫn offline; không cần tải lại thư viện khi image đã có. Đừng xóa volume trước buổi bảo vệ.

## 13 Tài liệu tra cứu chính thức

Source trong repository là căn cứ cho tên đối tượng và nghiệp vụ của bài. Các liên kết sau dùng tra cú pháp/cách thao tác, truy cập ngày 13/11/2026.

- Oracle Database PL/SQL Language Reference bản 23: https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/database-pl-sql-language-reference.pdf
- Oracle DBMS_XPLAN: https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/DBMS_XPLAN.html
- DBeaver cấu hình kết nối Oracle: https://dbeaver.com/docs/dbeaver/Connecting-to-Oracle-databases/
- DBeaver quản lý driver: https://dbeaver.com/docs/dbeaver/Driver-Manager/

Một số URL HTML Oracle hiện chuyển sang tài liệu 26ai. Đây không phải nâng phiên bản đồ án: runtime được kiểm tra vẫn là Oracle 23.9.0.25.7, và cú pháp SQL/PLSQL phải chạy được trên runtime này.
