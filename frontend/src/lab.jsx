import React, { useState, useEffect } from "react";
import { api, vnd, dateLabel, clock } from "./api";
import { FlaskConical, AlertTriangle, CheckCircle2, Play, RefreshCw, Cpu, Database, ShieldAlert, ArrowRight, Clock } from "lucide-react";

export function OracleLab({ session }) {
  const [activeTab, setActiveTab] = useState("triggerLich");
  const [triggerResult, setTriggerResult] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [stateTestResult, setStateTestResult] = useState(null);
  const [giaiPhongResult, setGiaiPhongResult] = useState(null);
  const [auditError, setAuditError] = useState("");
  const [benchmarkError, setBenchmarkError] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [busy, setBusy] = useState("");
  const canLab = session?.user?.role === "ROLE_IT_ADMIN";

  // TC-01 to TC-09
  const testNames = [
    "TC-01: Giữ ghế 10 phút, giá VIP cuối tuần (+20% giá cơ bản) & audit",
    "TC-02: Giữ trùng ghế F5 bị chặn, không ghi đơn dở dang (ORA-20021)",
    "TC-03: Hai phiên tranh chấp cùng 1 ghế F5 (ORA-20021)",
    "TC-04: Voucher 10%, thanh toán sinh QR / tích điểm & hết lượt (ORA-20026)",
    "TC-05: Quá hạn thanh toán, giải phóng ghế & đặt lại (ORA-20023 / HET_HAN)",
    "TC-06: Chống trùng mã giao dịch ngoài (ORA-20027)",
    "TC-07: Hủy vé trước 2 giờ & Từ chối < 2 giờ (ORA-20025)",
    "TC-08: Trigger kiểm soát lịch chiếu & thời gian dọn phòng (ORA-20031)",
    "TC-09: Quét QR 2 lần & chặn chuyển lùi trạng thái vé (ORA-20032)",
  ];
  const [testResults, setTestResults] = useState({});
  const [runningTests, setRunningTests] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [runningBenchmark, setRunningBenchmark] = useState(false);

  const fetchAuditLogs = async () => {
    if (!canLab) return;
    setLoadingAudit(true);
    try {
      const logs = await api("/lab/nhat-ky-ve", session?.token);
      setAuditLogs(logs || []);
      setAuditError("");
    } catch (e) {
      setAuditError(e.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    setAuditLogs([]);
    setTicketId("");
    if (activeTab !== "triggerTrangThai" || !canLab) return;
    fetchAuditLogs();
    const poll = setInterval(fetchAuditLogs, 10000);
    return () => clearInterval(poll);
  }, [session?.token, activeTab]);

  const latest = new Map();
  for (const row of auditLogs) if (!latest.has(row.ma_ve)) latest.set(row.ma_ve, row);
  const stateTickets = [...latest.values()].filter(r => ["DA_SU_DUNG", "DA_THANH_TOAN"].includes(r.trang_thai_moi));

  // Lab 1: Test Compound Trigger Schedule Overlap
  const runTriggerTest = async (scenario) => {
    setTriggerResult(null);
    setBusy("schedule");
    try {
      const res = await api("/lab/them-suat-chieu", session?.token, { body: { scenario } });
      setTriggerResult({
        scenario,
        passed: scenario === "gap20",
        oraCode: null,
        message: res.message || "Oracle chấp nhận lịch thử nghiệm. Dữ liệu thử được hoàn tác.",
      });
    } catch (err) {
      setTriggerResult({
        scenario,
        passed: scenario !== "gap20" && Math.abs(err.ora_code) === 20031,
        oraCode: err.code,
        message: err.clean_message || err.message,
        plsql: err.plsql_object || "TRIGGER TRG_SUAT_CHIEU_KHONG_TRUNG",
      });
    } finally { setBusy(""); }
  };

  // Lab 2: Test State Machine Trigger
  const runStateTransitionTest = async () => {
    setStateTestResult(null);
    setBusy("state");
    try {
      await api("/lab/ep-chuyen-trang-thai-ve", session?.token, { body: { ma_ve: Number(ticketId), tt_moi: "GIU_CHO" } });
      setStateTestResult({
        passed: false,
        message: "Không có lỗi (không mong muốn)",
      });
    } catch (err) {
      setStateTestResult({
        passed: Math.abs(err.ora_code) === 20032,
        oraCode: err.code,
        message: err.clean_message || err.message,
        plsql: err.plsql_object || "TRIGGER TRG_VE_CHUYEN_TRANG_THAI",
      });
    } finally { setBusy(""); }
    fetchAuditLogs();
  };

  // Lab 3: Test Expired Hold Release
  const runGiaiPhongTest = async () => {
    setGiaiPhongResult(null);
    setBusy("release");
    try {
      const res = await api("/lab/giai-phong-ghe-het-han", session?.token, { method: "POST" });
      setGiaiPhongResult({
        ...res,
        passed: true,
        message: res.message || "Đã chạy thủ tục giải phóng ghế hết hạn.",
      });
    } catch (err) {
      setGiaiPhongResult({
        passed: false,
        message: err.message,
      });
    } finally { setBusy(""); }
    fetchAuditLogs();
  };

  // Run 9 Tests
  const runAllTests = async () => {
    setRunningTests(true);
    for (let i = 1; i <= 9; i++) {
      try {
        const res = await api(`/admin/tests/${i}`, session?.token, { method: "POST" });
        setTestResults(prev => ({ ...prev, [i]: res }));
      } catch (err) {
        setTestResults(prev => ({ ...prev, [i]: { passed: false, log: err.message } }));
      }
    }
    setRunningTests(false);
  };

  // Run Benchmark
  const runBenchmark = async () => {
    setRunningBenchmark(true);
    setBenchmarkError("");
    try {
      const res = await api("/lab/execution-plan", session?.token);
      setBenchmarkData(res);
    } catch (e) {
      setBenchmarkError(e.message);
    } finally {
      setRunningBenchmark(false);
    }
  };

  if (!canLab) return <div className="panel lab-panel"><h2>Phòng Lab Oracle 23ai</h2><p className="muted">Chọn tài khoản Kỹ thuật IT trong bộ chuyển phiên để chạy ca kiểm thử và xem dữ liệu vận hành.</p></div>;

  return (
    <div className="oracle-lab-page">
      <div className="section-title">
        <div>
          <p className="eyebrow text-orange">KHU VỰC VẤN ĐÁP & BẢO VỆ ĐỒ ÁN (ORACLE 23ai LAB)</p>
          <h2>Phòng Thí Nghiệm Kiểm Thử Ràng Buộc & PL/SQL</h2>
        </div>
        <div className="lab-tab-nav">
          <button
            className={`tab-btn ${activeTab === "triggerLich" ? "active" : ""}`}
            onClick={() => setActiveTab("triggerLich")}
          >
            1. Compound Trigger (ORA-20031)
          </button>
          <button
            className={`tab-btn ${activeTab === "triggerTrangThai" ? "active" : ""}`}
            onClick={() => setActiveTab("triggerTrangThai")}
          >
            2. State Machine & Audit Log (ORA-20032)
          </button>
          <button
            className={`tab-btn ${activeTab === "giaiPhongHetHan" ? "active" : ""}`}
            onClick={() => setActiveTab("giaiPhongHetHan")}
          >
            3. FOR UPDATE SKIP LOCKED
          </button>
          <button
            className={`tab-btn ${activeTab === "allTests" ? "active" : ""}`}
            onClick={() => setActiveTab("allTests")}
          >
            4. 9 Ca Kiểm Thử Tự Động & Execution Plan
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: Compound Trigger */}
      {activeTab === "triggerLich" && (
        <div className="panel lab-panel">
          <div className="lab-header">
            <div>
              <h3>Test Compound Trigger Chống Chồng Lịch Chiếu (TRG_SUAT_CHIEU_KHONG_TRUNG)</h3>
              <p className="muted">
                Kiểm chứng quy tắc nghiệp vụ BR-09: Hai suất chiếu trong cùng phòng chiếu phải cách nhau tối thiểu 15 phút dọn phòng.
              </p>
            </div>
            <span className="badge-plsql">COMPOUND TRIGGER (AFTER STATEMENT)</span>
          </div>

          <div className="lab-explanation">
            <h4>💡 Cơ chế kỹ thuật nâng cao trên Oracle 23ai:</h4>
            <p>
              Trigger kiểm tra xung đột lịch thường gặp lỗi kinh điển <strong><code>ORA-04091: table is mutating, trigger/function may not see it</code></strong> nếu dùng Trigger Row-level (FOR EACH ROW) đọc lại bảng <code>SUAT_CHIEU</code>.
            </p>
            <p>
              <strong>Giải pháp của nhóm:</strong> Dùng <strong>Compound Trigger</strong> ghi nhận các suất bị thay đổi ở mức dòng và đối chiếu lịch trong phần <code>AFTER STATEMENT</code>.
            </p>
          </div>

          <div className="test-buttons-row">
            <button
              className="btn-lab-test danger"
              disabled={Boolean(busy)}
              onClick={() => runTriggerTest("overlap")}
            >
              <AlertTriangle size={16} /> (a) Test Trùng Giờ Chiếu (Kỳ vọng: ORA-20031)
            </button>
            <button
              className="btn-lab-test warning"
              disabled={Boolean(busy)}
              onClick={() => runTriggerTest("gap10")}
            >
              <Clock size={16} /> (b) Test Nghỉ 10 Phút &lt; 15 Phút (Kỳ vọng: ORA-20031)
            </button>
            <button
              className="btn-lab-test success"
              disabled={Boolean(busy)}
              onClick={() => runTriggerTest("gap20")}
            >
              <CheckCircle2 size={16} /> (c) Test nghỉ 20 phút (Kỳ vọng: Thành công)
            </button>
          </div>

          {triggerResult && (
            <div className={`lab-result-card ${triggerResult.passed ? "passed" : "error"}`}>
              <div className="result-card-header">
                {triggerResult.passed ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                <div>
                  <h4>
                    {triggerResult.passed ? "Đúng kỳ vọng" : "Không đúng kỳ vọng"}{triggerResult.oraCode ? ` · ${triggerResult.oraCode}` : ""}
                  </h4>
                  <p>{triggerResult.message}</p>
                </div>
              </div>
              {triggerResult.plsql && (
                <div className="plsql-intercepted">
                  Đối tượng PL/SQL thực thi: <code>{triggerResult.plsql}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: State Machine Trigger & Audit Log */}
      {activeTab === "triggerTrangThai" && (
        <div className="panel lab-panel">
          <div className="lab-header">
            <div>
              <h3>Trigger trạng thái vé & nhật ký (NHAT_KY_VE)</h3>
              <p className="muted">
                Kiểm chứng Trigger <code>TRG_VE_CHUYEN_TRANG_THAI</code> và Trigger ghi vết <code>TRG_VE_NHAT_KY</code>.
              </p>
            </div>
            <span className="badge-plsql">TRIGGER BEFORE UPDATE + AFTER INSERT/UPDATE</span>
          </div>

          <div className="state-machine-flow">
            <span className="state-node">GIU_CHO</span>
            <ArrowRight size={16} />
            <span className="state-node">DA_THANH_TOAN</span>
            <ArrowRight size={16} />
            <span className="state-node">DA_SU_DUNG</span>
            <span className="state-node alt">DA_HUY</span>
            <span className="state-node alt">HET_HAN</span>
          </div>

          <div className="state-test-action">
            <select aria-label="Vé kiểm tra chuyển trạng thái" value={ticketId} onChange={e => setTicketId(e.target.value)}>
              <option value="">Chọn vé đã thanh toán hoặc đã sử dụng</option>
              {stateTickets.map(t => <option key={t.ma_ve} value={t.ma_ve}>Vé #{t.ma_ve} · {t.trang_thai_moi}</option>)}
            </select>
            <button
              className="btn-lab-test danger"
              disabled={Boolean(busy) || !ticketId}
              onClick={runStateTransitionTest}
            >
              <ShieldAlert size={16} /> Thử cập nhật lùi trạng thái vé từ 'DA_SU_DUNG' về 'GIU_CHO' (Test ORA-20032)
            </button>
          </div>

          {stateTestResult && (
            <div className={`lab-result-card ${stateTestResult.passed ? "passed" : "error"}`}>
              <div className="result-card-header">
                <AlertTriangle size={24} />
                <div>
                  <h4>{stateTestResult.passed ? "Đúng kỳ vọng" : "Không đúng kỳ vọng"}{stateTestResult.oraCode ? ` · ${stateTestResult.oraCode}` : ""}</h4>
                  <p>{stateTestResult.message}</p>
                </div>
              </div>
              <div className="plsql-intercepted">
                Đối tượng PL/SQL: <code>{stateTestResult.plsql}</code>
              </div>
            </div>
          )}

          {/* Live Audit Log */}
          <div className="audit-log-section">
            <div className="section-title">
              <div>
                <h4>Live Audit Log: Nhật Ký Biến Động Vé Thời Gian Thực</h4>
                <p className="muted">Truy vấn: <code>SELECT * FROM nhat_ky_ve ORDER BY thoi_gian DESC FETCH FIRST 30 ROWS ONLY</code></p>
              </div>
              <button
                className="btn-refresh-audit"
                onClick={fetchAuditLogs}
                disabled={loadingAudit}
              >
                <RefreshCw size={14} className={loadingAudit ? "spin" : ""} /> Làm mới nhật ký
              </button>
            </div>
            {auditError && <p className="error-alert" role="alert">{auditError}</p>}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mã NK</th>
                    <th>Mã Vé</th>
                    <th>Hành Động Chuyển Trạng Thái</th>
                    <th>Thời Gian (Asia/Ho_Chi_Minh)</th>
                    <th>Người Thực Hiện (CLIENT_IDENTIFIER)</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center muted">Chưa có bản ghi nhật ký nào.</td>
                    </tr>
                  ) : (
                    auditLogs.map(l => (
                      <tr key={l.ma_nk}>
                        <td className="code-font">#{l.ma_nk}</td>
                        <td className="code-font">Vé #{l.ma_ve}</td>
                        <td>
                          <span className="action-tag">{l.trang_thai_cu || "Khởi tạo"} → {l.trang_thai_moi || l.hanh_dong}</span>
                        </td>
                        <td className="code-font">{String(l.thoi_gian).replace("T", " ").slice(0, 19)}</td>
                        <td><strong>{l.nguoi_thuc_hien}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Explicit Cursor with FOR UPDATE SKIP LOCKED */}
      {activeTab === "giaiPhongHetHan" && (
        <div className="panel lab-panel">
          <div className="lab-header">
            <div>
              <h3>Thu Hồi Ghế Quá Hạn 10 Phút (SP_GIAI_PHONG_HET_HAN)</h3>
              <p className="muted">
                Thao tác con trỏ Explicit Cursor kết hợp <code>FOR UPDATE SKIP LOCKED</code> và <code>WHERE CURRENT OF</code>.
              </p>
            </div>
            <span className="badge-plsql">PKG_DAT_VE.SP_GIAI_PHONG_HET_HAN</span>
          </div>

          <div className="lab-explanation">
            <h4>💡 Cơ chế kỹ thuật chống nghẽn (Lock Contention) trên Oracle 23ai:</h4>
            <p>
              Khi hàng trăm khách hàng đang đặt vé cùng lúc, job định kỳ giải phóng ghế hết hạn không được phép khóa chặn (deadlock) các phiên đặt vé hợp lệ.
            </p>
            <p>
              Bằng cách dùng cú pháp <code>FOR UPDATE SKIP LOCKED</code>, Oracle chỉ khóa và xử lý những đơn đã hết hạn mà các giao dịch khác không đang giữ khóa, giúp hệ thống hoạt động mượt mà, thông suốt 24/7.
            </p>
          </div>

          <div className="test-buttons-row">
            <button
              className="primary btn-giai-phong"
              disabled={Boolean(busy)}
              onClick={runGiaiPhongTest}
            >
              <Cpu size={16} /> Chạy SP_GIAI_PHONG_HET_HAN
            </button>
          </div>

          {giaiPhongResult && (
            <div className={`lab-result-card ${giaiPhongResult.passed ? "passed" : "error"}`}>
              <div className="result-card-header">
                <CheckCircle2 size={24} />
                <div>
                  <h4>{giaiPhongResult.passed ? "Thực thi thành công" : "Không thực thi được"}</h4>
                  <p>{giaiPhongResult.message}</p>
                  {giaiPhongResult.so_don != null && <p>{giaiPhongResult.so_don} đơn · {giaiPhongResult.so_ghe} ghế đã nhả</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: 9 Automated Test Cases */}
      {activeTab === "allTests" && (
        <div className="panel lab-panel">
          <div className="lab-header">
            <div>
              <h3>9 Ca Kiểm Thử Nghiệp Vụ Toàn Diện (TC-01 Đến TC-09)</h3>
              <p className="muted">Tự động kiểm tra đầy đủ các ràng buộc, trigger, chỉ mục điều kiện và package PL/SQL.</p>
            </div>
            <button
              className="primary"
              disabled={runningTests}
              onClick={runAllTests}
            >
              {runningTests ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
              {runningTests ? "Đang chạy 9 ca..." : "Chạy cả 9 ca kiểm thử"}
            </button>
          </div>

          <div className="test-list-grid test-list">
            {testNames.map((name, idx) => {
              const caseNum = idx + 1;
              const res = testResults[caseNum];
              return (
                <div key={caseNum} className="test-card">
                  <div className="test-card-header">
                    <strong>{name}</strong>
                    <button
                      className="btn-run-single"
                      disabled={runningTests}
                      onClick={async () => {
                        try {
                          const r = await api(`/admin/tests/${caseNum}`, session?.token, { method: "POST" });
                          setTestResults(prev => ({ ...prev, [caseNum]: r }));
                        } catch (err) {
                          setTestResults(prev => ({ ...prev, [caseNum]: { passed: false, log: err.message } }));
                        }
                      }}
                    >
                      Chạy
                    </button>
                  </div>
                  {res && (
                    <div className={`test-card-body ${res.passed ? "passed" : "error"}`}>
                      <div className="status-label">
                        {res.passed ? "✅ ĐẠT (PASSED)" : "❌ LỖI (FAILED)"}
                      </div>
                      <pre className="test-log-pre">{res.log}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Benchmark Section */}
          <div className="benchmark-section">
            <div className="section-title">
              <div>
                <h4>Đo Lường Execution Plan Thực Tế (DBMS_XPLAN.DISPLAY_CURSOR)</h4>
                <p className="muted">So sánh chi phí Buffer Gets giữa TABLE ACCESS FULL vs INDEX SCAN.</p>
              </div>
              <button
                className="btn-lab-test warning"
                disabled={runningBenchmark}
                onClick={runBenchmark}
              >
                {runningBenchmark ? "Đang đo..." : "Đo Query A & Query B"}
              </button>
            </div>

            {benchmarkData && (
              <div className="plans-display">
                {Object.entries(benchmarkData).map(([key, item]) => (
                  <div key={key} className="plan-card">
                    <h4>Query {key} · Bảng <code>{item.table}</code></h4>
                    <p className="text-sm muted">
                      {item.result_match ? "Khớp kết quả giữa hai phương án" : "Cần kiểm tra"}
                    </p>
                    <div className="plans-grid">
                      {item.plans.map(p => (
                        <div key={p.hint} className="plan-detail">
                          <div className="plan-meta">
                            <strong>{p.hint}</strong>
                            <span>{p.buffer_gets} buffers · {p.elapsed_ms} ms</span>
                          </div>
                          <pre className="plan-pre">{p.plan}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

