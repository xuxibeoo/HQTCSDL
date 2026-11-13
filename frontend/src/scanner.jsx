import React, { useEffect, useState } from "react";
import { api } from "./api";
import { QrCode, CheckCircle2, XCircle, AlertCircle, Clock, ShieldCheck, Sparkles, RefreshCw } from "lucide-react";

export function GateScanner({ session, initialCode = "" }) {
  const [qrCode, setQrCode] = useState(initialCode);
  const [result, setResult] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [listError, setListError] = useState("");

  useEffect(() => {
    let active = true;
    setRecentTickets([]);
    setScanHistory([]);
    setResult(null);
    setTicket(null);
    setQrCode(initialCode);
    setListError("");
    if (session?.token) api("/soat-ve/ve-da-phat-hanh", session.token)
      .then(items => { if (active) setRecentTickets(items); })
      .catch(e => { if (active) setListError(e.clean_message || e.message); });
    return () => { active = false; };
  }, [session?.token, initialCode]);

  async function handleScan(codeToScan) {
    const code = (codeToScan || qrCode).trim();
    if (!code || !session?.token || loading) return;
    setLoading(true);
    setResult(null);
    setTicket(null);
    setError("");
    try {
      const data = await api("/soat-ve", session.token, {
        body: { ma_qr: code }
      });
      const outcome = data.ket_qua || "KHONG_HOP_LE";
      const scanItem = {
        time: new Date().toLocaleTimeString("vi-VN"),
        qr: code,
        outcome,
      };
      setResult(outcome);
      setTicket(data.ve);
      setScanHistory(prev => [scanItem, ...prev.slice(0, 19)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig = {
    HOP_LE: {
      color: "green",
      title: "HỢP LỆ · MỜI VÀO PHÒNG CHIẾU",
      desc: "Vé hợp lệ, phòng chiếu đã mở cửa. Oracle 23ai đã chuyển trạng thái vé sang 'DA_SU_DUNG'.",
      icon: CheckCircle2,
      badge: "passed",
    },
    DA_SU_DUNG: {
      color: "red",
      title: "CẢNH BÁO: VÉ ĐÃ SỬ DỤNG!",
      desc: "Vé này đã được quét kiểm tra trước đó! Cơ chế chống gian lận và sử dụng vé 2 lần (BR-08).",
      icon: XCircle,
      badge: "error",
    },
    CHUA_DEN_GIO: {
      color: "yellow",
      title: "CHƯA ĐẾN GIỜ CHIẾU",
      desc: "Cổng soát vé chỉ mở cửa trước giờ chiếu 30 phút. Vui lòng quay lại sau.",
      icon: Clock,
      badge: "warning",
    },
    KHONG_HOP_LE: {
      color: "gray",
      title: "MÃ VÉ KHÔNG HỢP LỆ",
      desc: "Mã QR không tồn tại trong hệ thống hoặc vé đã bị hủy / hết hạn thanh toán.",
      icon: AlertCircle,
      badge: "error",
    },
    KHONG_TON_TAI: {
      title: "KHÔNG TÌM THẤY VÉ",
      desc: "Mã QR không tồn tại trong Oracle.",
      icon: AlertCircle,
      badge: "error",
    },
    HET_HAN: {
      color: "gray",
      title: "VÉ ĐÃ HẾT HẠN",
      desc: "Suất chiếu của vé này đã kết thúc.",
      icon: AlertCircle,
      badge: "error",
    }
  };

  const currentStatus = statusConfig[result] || null;

  return (
    <div className="gate-scanner-container">
      <div className="section-title">
        <div>
          <p className="eyebrow text-orange">KIỂM SOÁT VÀO CỬA TỰ ĐỘNG (SP_SOAT_VE)</p>
          <h2>Cổng Soát Vé Điện Tử QR</h2>
        </div>
        <span className="badge-plsql">PKG_DAT_VE.SP_SOAT_VE</span>
      </div>

      <div className="scanner-grid">
        {/* Left Column: Scanner Terminal */}
        <div className="panel scanner-terminal">
          <div className="terminal-header">
            <QrCode size={28} className="text-orange" />
            <div>
              <h3>Máy Quét Cửa Phòng Chiếu</h3>
              <p className="muted">Nhập mã QR hoặc click chọn nhanh vé vừa mua bên dưới để thử nghiệm</p>
            </div>
          </div>

          <form
            className="scanner-form"
            onSubmit={e => {
              e.preventDefault();
              handleScan();
            }}
          >
            <div className="qr-input-wrap">
              <input
                type="text"
                aria-label="Mã QR"
                placeholder="Dán chuỗi mã QR hex (RAWTOHEX(SYS_GUID()))..."
                value={qrCode}
                onChange={e => setQrCode(e.target.value)}
                required
                className="qr-input"
              />
              <button
                type="submit"
                disabled={!session?.token || loading || !qrCode.trim()}
                className="primary scan-button"
              >
                {loading ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
                Kiểm tra vé
              </button>
            </div>
          </form>
          {!session?.token && <p className="muted">Đăng nhập để soát vé.</p>}
          {error && <p className="error-alert" role="alert">{error}</p>}

          {/* Rapid Test Section */}
          <div className="rapid-qr-section">
            <span className="rapid-label">
              <Sparkles size={14} className="text-orange" /> Chọn nhanh vé để test kiểm thử:
            </span>
            <div className="rapid-qr-buttons">
              {recentTickets.length > 0 ? (
                recentTickets.map(t => (
                  <button
                    key={t.ma_ve}
                    type="button"
                    className="rapid-qr-pill"
                    onClick={() => setQrCode(t.ma_qr)}
                  >
                    <span>Vé #{t.ma_ve} ({t.hang}{t.so_ghe})</span>
                    <small>{t.ten_phim}</small>
                  </button>
                ))
              ) : (
                <span className="muted text-sm">
                  {listError || "Chưa có vé đã phát hành trong phạm vi phiên hiện tại."}
                </span>
              )}
              <button type="button" className="rapid-qr-pill" onClick={() => setQrCode(`QR-KIEM-THU-${crypto.randomUUID()}`)}>Thử mã QR không tồn tại</button>
            </div>
          </div>

          {/* Visual Indicator Light (Beacon) */}
          <div className="scanner-beacon-area">
            <div className={`beacon-light ${result ? result.toLowerCase() : "idle"}`}>
              {currentStatus ? (
                <currentStatus.icon size={48} className="beacon-icon" />
              ) : (
                <QrCode size={48} className="beacon-icon text-muted" />
              )}
            </div>

            {currentStatus ? (
              <div className={`beacon-result ${currentStatus.badge}`}>
                <h3>{currentStatus.title}</h3>
                <p>{currentStatus.desc}</p>
                {ticket && <p>Vé #{ticket.ma_ve} · {ticket.ten_phim} · {ticket.ten_phong} · ghế {ticket.hang}{ticket.so_ghe}</p>}
                <div className="result-code-tag">
                  Mã kết quả Oracle: <code>p_ket_qua = '{result}'</code>
                </div>
              </div>
            ) : (
              <div className="beacon-result idle">
                <h3>Sẵn sàng quét vé</h3>
                <p className="muted">Đưa mã QR trước máy quét hoặc nhập mã bên trên để kiểm tra hợp lệ.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scan History & PL/SQL Explanation */}
        <div className="scanner-sidebar">
          <div className="panel rule-box">
            <h4>Quy tắc nghiệp vụ Soát vé (BR-08)</h4>
            <ul className="rule-list">
              <li>
                <strong>Cơ chế khóa hàng:</strong> Gọi <code>SELECT ... FOR UPDATE</code> trên bảng <code>VE</code> để chống tranh chấp nhiều máy quét đồng thời.
              </li>
              <li>
                <strong>Chống sử dụng 2 lần:</strong> Chỉ cho phép vé có trạng thái <code>DA_THANH_TOAN</code> đổi sang <code>DA_SU_DUNG</code>. Khi quét lần thứ hai, Oracle nhận diện ngay trạng thái đã sử dụng và trả về <code>DA_SU_DUNG</code>.
              </li>
              <li>
                <strong>Audit Log tự động:</strong> Trigger <code>TRG_VE_NHAT_KY</code> tự động ghi lại thời điểm và nhân viên thực hiện soát vé.
              </li>
            </ul>
          </div>

          <div className="panel history-box">
            <h4>Lịch sử soát vé tại cổng</h4>
            {scanHistory.length === 0 ? (
              <p className="muted text-sm">Chưa có lượt quét nào trong phiên.</p>
            ) : (
              <ul className="scan-history-list">
                {scanHistory.map((item, idx) => (
                  <li key={idx} className={`history-item ${item.outcome.toLowerCase()}`}>
                    <div>
                      <strong className="code-font">{item.time}</strong> · Mã:{" "}
                      <span className="code-font">{item.qr.slice(0, 12)}...</span>
                    </div>
                    <span className={`status-pill ${item.outcome === "HOP_LE" ? "success" : "error"}`}>
                      {item.outcome}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

