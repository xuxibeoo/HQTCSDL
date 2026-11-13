import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Database, Info } from "lucide-react";
import { api, dateLabel, clock } from "./api";
import "./demo-guide.css";

const steps = [
  {
    number: "01", time: "2 phút", title: "Đặt vé và thanh toán thử", target: "booking", role: "CUSTOMER_1", account: "Khách hàng",
    action: "Mở đặt vé", instructions: "Chọn phim, rạp, suất còn mở và ghế trống. Giữ chỗ, thử thêm combo hoặc mã GIAM10 nếu còn hiệu lực, rồi thanh toán giả lập.",
    evidence: "Chỉ ra đơn giữ chỗ có hạn 10 phút, tổng tiền do API tính và mã QR sau thanh toán.",
    oracle: "PKG_DAT_VE: SP_GIU_CHO, FN_TINH_GIA_VE, FN_TINH_GIAM, SP_THANH_TOAN",
  },
  {
    number: "02", time: "1 phút", title: "Xem vé và điều kiện hoàn / hủy", target: "myTickets", role: "CUSTOMER_1", account: "Giữ tài khoản khách đang dùng",
    action: "Mở vé của tôi", instructions: "Mở đơn vừa đặt trong lịch sử. Xem vé, trạng thái và điều kiện hủy. Chỉ thử hủy trên một vé riêng; giữ lại vé khác nếu cần dùng để soát QR.",
    evidence: "Vé chỉ được hủy khi đủ điều kiện; không hủy vé đã sử dụng hoặc sát giờ chiếu.",
    oracle: "PKG_DAT_VE: FN_DUOC_HUY_VE, SP_HUY_VE; giao dịch và hoàn tiền giả lập",
  },
  {
    number: "03", time: "1 phút", title: "Kiểm tra QR đúng thời điểm", target: "scanner", role: "USHER", account: "Nhân viên soát vé",
    action: "Mở soát vé QR", instructions: "Chọn mã vé đã phát hành trong danh sách hoặc dán QR đã lưu. Vé chỉ hợp lệ khi vào cửa trong khoảng cho phép; vé ở suất còn xa trả về Chưa đến giờ.",
    evidence: "Vé hợp lệ chuyển sang DA_SU_DUNG; quét lại bị từ chối. TC-09 ở Lab có ca kiểm thử tự động cho tình huống này.",
    oracle: "PKG_DAT_VE.SP_SOAT_VE; kiểm tra thời gian và trạng thái vé",
  },
  {
    number: "04", time: "1–2 phút", title: "Mở báo cáo và giải thích câu truy vấn", target: "analytics", role: "ACCOUNTING", account: "Kế toán",
    action: "Mở báo cáo", instructions: "Xem Top phim, xu hướng doanh thu và tỷ lệ lấp đầy. Mở phần SQL để giải thích CTE, DENSE_RANK, SUM OVER và LAG trên số liệu trả về từ Oracle.",
    evidence: "Nêu đầu vào, phép nhóm, thứ hạng và ý nghĩa của một dòng kết quả; không chỉ đọc biểu đồ.",
    oracle: "CTE, Window Functions và chuỗi ngày/tháng cho báo cáo",
  },
  {
    number: "05", time: "3 phút", title: "Chứng minh Trigger, kiểm thử và tối ưu", target: "lab", role: "IT_ADMIN", account: "Kỹ thuật IT",
    action: "Mở Lab Oracle", instructions: "Thử lịch trùng và khoảng nghỉ 10/20 phút. Sau đó mở mục 4, chạy 9 ca kiểm thử; chạy Execution Plan khi cần trình bày hai truy vấn trước / sau tối ưu.",
    evidence: "Đọc rõ ca đạt / chưa đạt và mã lỗi kỳ vọng. Giải thích vì sao Oracle chặn dữ liệu; không coi lỗi được chặn đúng là ứng dụng hỏng.",
    oracle: "Compound Trigger, audit, FOR UPDATE SKIP LOCKED, DBMS_XPLAN",
  },
];

export function DemoGuide({ session, health, onGo }) {
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const [scenarios, setScenarios] = useState(null), [scenarioError, setScenarioError] = useState(""), [scenarioLoading, setScenarioLoading] = useState(false);
  useEffect(() => {
    if (!health?.demo) return;
    let active = true;
    setScenarioLoading(true);
    api("/demo/scenarios").then(data => {
      if (!active) return;
      setScenarios(data.scenarios || {});
      setScenarioError(data.ok ? "" : data.message || "Chưa có đủ suất phù hợp. Vẫn có thể chọn suất thủ công hoặc chạy ca tương ứng trong Lab.");
    }).catch(reason => { if (active) setScenarioError(reason.clean_message || reason.message); })
      .finally(() => { if (active) setScenarioLoading(false); });
    return () => { active = false; };
  }, [health?.demo]);
  const open = async step => {
    if (busy) return;
    setBusy(step.target); setError("");
    try { await onGo(step.target, step.role); }
    catch (reason) { setError(reason.clean_message || reason.message || "Chưa mở được phân hệ. Hãy kiểm tra kết nối rồi thử lại."); }
    finally { setBusy(""); }
  };
  const openScenario = async (key, scenario) => {
    if (!scenario || busy) return;
    setBusy(key); setError("");
    try { await onGo("booking", "CUSTOMER_1", scenario); }
    catch (reason) { setError(reason.clean_message || reason.message || "Chưa chọn được suất demo."); }
    finally { setBusy(""); }
  };
  return <div className="academic-demo-guide">
    <p className="eyebrow text-orange"><BookOpen size={17} /> HƯỚNG DẪN BẢO VỆ ĐỒ ÁN</p>
    <h2>Demo trong 8–10 phút</h2>
    <p className="academic-demo-intro">Đi qua nghiệp vụ thật trên giao diện, rồi giải thích luồng <strong>Web → API → Oracle Database 23ai</strong>. Các nút bên dưới mở đúng phân hệ, không tự tạo hay thanh toán đơn.</p>
    <div className="academic-demo-status"><Database size={17} /><span>{health ? `Oracle: ${health.oracle || health.engine || "Đã phản hồi API"}` : "Đang kiểm tra kết nối API và Oracle…"}</span><span>Phiên: {session?.user?.ho_ten || session?.user?.email || "Chưa đăng nhập"}</span></div>
    <div className="academic-demo-note"><Info size={19} /><p><strong>Phạm vi đồ án:</strong> thanh toán và hoàn tiền là giả lập, không trừ tiền ngân hàng. Khi bật chế độ demo, các nút sẽ chuyển sang tài khoản mẫu đúng quyền; bước lịch sử giữ nguyên khách hàng đang dùng. Dùng thanh chọn tài khoản trên cùng để thử thêm phân quyền hoặc hai khách tranh cùng ghế.</p></div>
    {error && <p role="alert" className="academic-demo-error">{error}</p>}
    {health?.demo && <section className="academic-demo-quick" aria-label="Ba suất demo theo thời gian thực"><h3>Không cần tìm suất: chọn đúng tình huống</h3><p>Các suất bên dưới được API chọn theo thời gian hiện tại. Nút chỉ mở sơ đồ ghế; bạn vẫn tự giữ chỗ và thanh toán. Mở kịch bản mới không hủy đơn trước đó; đơn cũ nằm trong Vé của tôi.</p>{scenarioLoading && <p role="status">Đang đọc suất phù hợp từ Oracle…</p>}{scenarioError && <p role="status" className="academic-demo-error">{scenarioError}</p>}<div className="academic-demo-quick-grid">{[
      ["quet_qr", "Quét QR ngay", "Suất gần giờ chiếu, để thử vé hợp lệ và quét lặp."],
      ["tu_choi_hoan", "Thử từ chối hoàn", "Suất sát giờ, để kiểm tra điều kiện không được hủy."],
      ["duoc_hoan", "Đặt và hoàn thành công", "Suất còn đủ xa, để thử hoàn / hủy theo điều kiện."],
    ].map(([key, title, text]) => {
      const scenario = scenarios?.[key];
      const fallback = key === "quet_qr" ? {
        label: "Kiểm thử QR ngay trong Lab (TC-09)",
        text: "Phòng đang bận nên chưa có suất gần phù hợp. Trong Lab, mở mục 4 và chọn TC-09: ca thử tạo tình huống gần giờ, kiểm tra QR lần đầu, quét lặp và chuyển lùi trạng thái; dữ liệu thử được hoàn tác.",
      } : key === "tu_choi_hoan" ? {
        label: "Kiểm thử điều kiện hoàn trong Lab (TC-07)",
        text: "Chưa có suất sát giờ phù hợp. Trong Lab, mở mục 4 và chọn TC-07 để kiểm tra từ chối khi còn 1 giờ và hoàn khi còn hơn 2 giờ; dữ liệu thử được hoàn tác.",
      } : null;
      return <article key={key} className={!scenario && fallback ? "is-fallback" : ""}><h4>{title}</h4><p>{text}</p>{scenario ? <p className="academic-demo-quick-show">{scenario.ten_phim}<br />{scenario.ten_phong} · {clock(scenario.gio_bat_dau)} {dateLabel(scenario.gio_bat_dau)}</p> : <p className="academic-demo-quick-show">{scenarioLoading ? "Đang kiểm tra…" : "Chưa có suất phù hợp"}</p>}
        {!scenario && !scenarioLoading && fallback ? <><p className="academic-demo-fallback-note">{fallback.text}</p><button type="button" className="secondary academic-demo-fallback-button" disabled={Boolean(busy)} onClick={() => open({ target: "lab", role: "IT_ADMIN" })}>{busy === "lab" ? "Đang mở…" : fallback.label}<ArrowRight size={14} /></button></> : <button type="button" className="secondary" disabled={!scenario || Boolean(busy)} onClick={() => openScenario(key, scenario)}>{busy === key ? "Đang mở…" : "Chọn suất này"}<ArrowRight size={14} /></button>}
      </article>;
    })}</div></section>}
    <ol className="academic-demo-steps">{steps.map(step => <li key={step.number}>
      <span className="academic-demo-number">{step.number}</span><div className="academic-demo-step-content"><div className="academic-demo-heading"><h3>{step.title}</h3><span><Clock size={13} /> {step.time}</span></div><p>{step.instructions}</p><p className="academic-demo-evidence"><CheckCircle2 size={15} /> <span>{step.evidence}</span></p><details><summary>Ý cần giải thích khi vấn đáp</summary><p>{step.oracle}</p></details><div className="academic-demo-step-actions"><span>Tài khoản: {step.account}</span><button type="button" className="secondary" disabled={Boolean(busy) || !health} onClick={() => open(step)}>{busy === step.target ? "Đang mở…" : step.action}<ArrowRight size={15} /></button></div></div>
    </li>)}</ol>
    <div className="academic-demo-checklist"><strong>Trước giờ trình bày</strong><p>Kiểm tra dòng Oracle đã kết nối; chọn suất chiếu hiện tại; mở sẵn Inspector ở đáy trang để chỉ ra API và đối tượng PL/SQL. Ảnh và font giao diện được đóng gói cục bộ; vẫn cần Docker / API / Oracle hoạt động.</p></div>
  </div>;
}
