import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Armchair,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Film,
  MapPin,
  Ticket,
  Lock,
  X,
  AlertTriangle,
  QrCode,
  Sparkles,
  CreditCard,
  RefreshCw,
  Copy,
  ArrowRight,
  ShieldCheck,
  Coins
} from "lucide-react";
import { api, vnd, dateLabel, clock } from "./api";
import { moviePoster } from "./movie-art";

// ---------------------------------------------------------------------------
// SeatMap Component
// ---------------------------------------------------------------------------
export function SeatMap({ showId, selected = [], onToggle, readOnly = false, conflictDemo = false }) {
  const [seats, setSeats] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let pending = false;
    setSeats([]);
    setError("");
    if (!showId) return;
    async function loadSeats() {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        const data = await api(`/suat-chieu/${showId}/ghe`);
        if (active) { setSeats(data); setError(""); }
      } catch (e) {
        if (active) setError(e.clean_message || e.message);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    loadSeats();
    const interval = setInterval(loadSeats, 4000);
    return () => { active = false; clearInterval(interval); };
  }, [showId]);

  return (
    <div className="seat-section">
      {/* Curved Screen with Light Projection */}
      <div className="screen-container">
        <div className="screen-curve" />
        <div className="screen-label">MÀN HÌNH CHIẾU (SCREEN)</div>
        <div className="screen-light-beam" />
      </div>

      {error && <div className="error-alert">{error}</div>}
      {loading && seats.length === 0 && <p className="muted text-center py-6">Đang đọc sơ đồ ghế từ Oracle Database 23ai...</p>}

      {/* 10 x 10 Seat Grid */}
      <div className="seat-grid">
        {seats.map(s => {
          const isSelected = selected.some(x => x.ma_ghe === s.ma_ghe);
          const isOccupied = s.trang_thai !== "TRONG";
          const isHeld = s.trang_thai === "GIU_CHO";
          const seatClass = isSelected ? "selected" : isHeld ? "held" : isOccupied ? "occupied" : s.ten_loai === "VIP" ? "vip" : s.ten_loai === "COUPLE" ? "couple" : "standard";

          return (
            <button
              type="button"
              key={s.ma_ghe}
              className={`seat-btn ${seatClass}`}
              disabled={readOnly || (isOccupied && !conflictDemo)}
              aria-pressed={isSelected}
              aria-label={`Ghế ${s.hang}${s.so_ghe}, ${s.ten_loai}, ${s.trang_thai}`}
              title={`Ghế ${s.hang}${s.so_ghe} · ${s.ten_loai} · ${vnd(s.gia_ve)} (${s.trang_thai})`}
              onClick={() => onToggle(s)}
            >
              <span className="seat-text">{s.hang}{s.so_ghe}</span>
              {isHeld ? <Clock3 size={10} className="seat-lock-icon" /> : isOccupied ? <Lock size={10} className="seat-lock-icon" /> : null}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="seat-legend">
        <div className="legend-item">
          <span className="legend-box standard" />
          <span>Ghế Thường</span>
        </div>
        <div className="legend-item">
          <span className="legend-box vip" />
          <span>Ghế VIP (+20k)</span>
        </div>
        <div className="legend-item"><span className="legend-box couple" /><span>Ghế đôi (+40k)</span></div>
        <div className="legend-item">
          <span className="legend-box selected" />
          <span>Đang chọn</span>
        </div>
        <div className="legend-item">
          <span className="legend-box occupied" />
          <span>Đã bán</span>
        </div>
        <div className="legend-item"><span className="legend-box held" /><span>Đang giữ chỗ</span></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QR Code Display Component
// ---------------------------------------------------------------------------
export function QRCodeCard({ code }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (code) {
      QRCode.toDataURL(code, {
        width: 160,
        margin: 1,
        color: { dark: "#0B0F19", light: "#FFFFFF" }
      }).then(setDataUrl).catch(console.error);
    }
  }, [code]);

  return dataUrl ? (
    <img src={dataUrl} alt="Mã QR vé điện tử" className="qr-image" />
  ) : (
    <div className="qr-placeholder"><QrCode size={40} /></div>
  );
}

// ---------------------------------------------------------------------------
// E-Ticket Card Component
// ---------------------------------------------------------------------------
export function GalaxyTicketCard({ ticket, onCancel, onJumpToScanner }) {
  const [copied, setCopied] = useState(false);

  const copyQR = async () => {
    if (ticket.ma_qr) {
      try {
        await navigator.clipboard.writeText(ticket.ma_qr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  const isPaid = ticket.trang_thai === "DA_THANH_TOAN";

  return (
    <div className={`galaxy-e-ticket ${ticket.trang_thai.toLowerCase()}`}>
      <div className="ticket-notch-top" />
      <div className="ticket-notch-bottom" />

      {/* Left Stub: Movie & Show Details */}
      <div className="ticket-main-stub">
        <div className="ticket-badge-row">
          <span className="ticket-cinema-brand">GALAXY HUFLIT CINEMA</span>
          <span className={`status-pill ${isPaid ? "success" : ticket.trang_thai === "DA_SU_DUNG" ? "purple" : "error"}`}>
            {ticket.trang_thai}
          </span>
        </div>

        <h3 className="ticket-movie-title">{ticket.ten_phim}</h3>

        <div className="ticket-meta-grid">
          <div>
            <span className="meta-label">Ghế ngồi</span>
            <strong className="seat-highlight">{ticket.hang}{ticket.so_ghe}</strong>
          </div>
          <div>
            <span className="meta-label">Mã vé</span>
            <strong className="code-font">#{ticket.ma_ve}</strong>
          </div>
          <div>
            <span className="meta-label">Giờ chiếu</span>
            <strong>{clock(ticket.gio_bat_dau)} · {dateLabel(ticket.gio_bat_dau)}</strong>
          </div>
          {ticket.ten_phong && <div><span className="meta-label">Phòng chiếu</span><strong>{ticket.ten_phong}</strong></div>}
          <div>
            <span className="meta-label">Giá vé</span>
            <strong className="text-orange">{vnd(ticket.gia_ve - (ticket.tien_giam || 0))}</strong>
          </div>
        </div>

        {ticket.ma_qr && isPaid && (
          <div className="qr-string-row">
            <span className="code-font qr-text">{ticket.ma_qr.slice(0, 20)}...</span>
            <button type="button" className="btn-copy-sm" onClick={copyQR} title="Sao chép chuỗi mã QR">
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Đã chép" : "Chép QR"}
            </button>
            {onJumpToScanner && (
              <button
                type="button"
                className="btn-jump-scanner"
                onClick={() => onJumpToScanner(ticket.ma_qr)}
                title="Mở cổng soát vé với mã này"
              >
                <ArrowRight size={12} /> Thử soát vé
              </button>
            )}
          </div>
        )}

        {onCancel && isPaid && (
          <div className="ticket-action-row">
            {ticket.duoc_huy != null && <p className="muted">{Boolean(ticket.duoc_huy) ? "Đủ điều kiện hủy" : "Không đủ điều kiện hủy (còn dưới 2 giờ)"}</p>}
            <button
              type="button"
              className="btn-cancel-ticket"
              onClick={() => onCancel(ticket.ma_ve)}
            >
              Hủy vé & Hoàn tiền (sp_huy_ve)
            </button>
          </div>
        )}
      </div>

      {/* Right Stub: QR Code */}
      <div className="ticket-qr-stub">
        {ticket.ma_qr && isPaid ? (
          <>
            <QRCodeCard code={ticket.ma_qr} />
            <span className="qr-caption">QUÉT TẠI CỬA</span>
          </>
        ) : (
          <div className="ticket-qr-placeholder">
            <QrCode size={36} className="text-muted" />
            <span className="text-xs muted">{ticket.trang_thai}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Booking Module (Tab 1)
// ---------------------------------------------------------------------------
export function Booking({
  catalog,
  shows,
  session,
  preset,
  offer,
  onLogin,
  onOpenScanner,
  resumeOrder,
  onResumeConsumed,
  demo,
  onTransaction,
  customerId,
  site
}) {
  const [film, setFilm] = useState("");
  const [cinema, setCinema] = useState(site ? String(site) : "");
  const [format, setFormat] = useState("ALL");
  const [day, setDay] = useState("");
  const [show, setShow] = useState("");
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [order, setOrder] = useState(resumeOrder);
  const [promo, setPromo] = useState("");
  const [combo, setCombo] = useState("");
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("THE");
  const transactionCode = () => `DEMO-TX-${crypto.randomUUID()}`;
  const [extTxCode, setExtTxCode] = useState(transactionCode);
  const [lastTxCode, setLastTxCode] = useState(() => sessionStorage.getItem("cinema-last-transaction") || "");
  const [errorModal, setErrorModal] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [quote, setQuote] = useState(null);
  const [quotePending, setQuotePending] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [conflictDemo, setConflictDemo] = useState(false);
  const [simulatedExpiry, setSimulatedExpiry] = useState(false);

  const token = session?.token;
  const cashier = session?.user?.role === "ROLE_CASHIER";
  const support = session?.user?.role === "ROLE_CUSTOMER_SUPPORT";

  useEffect(() => { if (resumeOrder) onResumeConsumed?.(); }, [resumeOrder]);

  useEffect(() => {
    if (!preset || order) return;
    if (preset.film) setFilm(String(preset.film));
    if (preset.cinema && !preset.film) setFilm("");
    setCinema(String(site || preset.cinema || ""));
    setDay(preset.day || "");
    setShow(preset.show ? String(preset.show) : "");
    setSelectedSeats([]);
  }, [preset, site]);

  useEffect(() => {
    if (offer && !order) setPromo(offer.code);
  }, [offer]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Filter shows
  const relevantShows = shows.filter(s => {
    if (film && String(s.ma_phim) !== film) return false;
    if (cinema && String(s.ma_rap) !== cinema) return false;
    if (format !== "ALL" && s.dinh_dang !== format) return false;
    return true;
  });

  const availableDays = [...new Set(relevantShows.map(s => s.gio_bat_dau.slice(0, 10)))];
  const matchingShows = relevantShows.filter(s => !day || s.gio_bat_dau.startsWith(day));

  const selectedShow = shows.find(s => String(s.ma_suat) === show);
  const selectedFilm = catalog.phim.find(f => String(f.ma_phim) === (film || String(selectedShow?.ma_phim)));
  const selectedCinema = catalog.rap.find(r => String(r.ma_rap) === (cinema || String(selectedShow?.ma_rap)));

  function quoteInput() {
    return { ma_suat: Number(show), ds_ghe: selectedSeats.map(s => s.ma_ghe), ma_code: promo.trim().toUpperCase() || null,
      ds_combo: combo ? [{ ma_combo: Number(combo), so_luong: qty }] : [] };
  }

  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError("");
    setQuotePending(false);
    if (!show || !selectedSeats.length || order) return;
    setQuotePending(true);
    const wait = setTimeout(async () => {
      try {
        const data = await api("/tinh-tien-tam", token, { body: quoteInput() });
        if (active) setQuote(data);
      } catch (e) {
        if (active) setQuoteError(e.message);
      } finally {
        if (active) setQuotePending(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(wait); };
  }, [show, selectedSeats, promo, combo, qty, order, token]);

  // 10-minute hold countdown
  const deadline = order?.han_thanh_toan || "";
  const deadlineMs = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(deadline) ? deadline : deadline + "+07:00");
  const secondsLeft = Number.isFinite(deadlineMs) ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : 0;
  const timerDisplay = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  // Toggle seat selection
  const handleToggleSeat = seat => {
    setSelectedSeats(prev => {
      if (prev.some(x => x.ma_ghe === seat.ma_ghe)) {
        return prev.filter(x => x.ma_ghe !== seat.ma_ghe);
      }
      if (prev.length >= 8) {
        alert("Chính sách rạp chỉ cho phép chọn tối đa 8 ghế trong một đơn đặt.");
        return prev;
      }
      return [...prev, seat];
    });
  };

  // Hold Seats Action (POST /api/dat-ve/giu-cho -> PKG_DAT_VE.SP_GIU_CHO)
  const handleHoldSeats = async () => {
    if (!token) {
      onLogin?.();
      return;
    }
    if (!show || selectedSeats.length === 0) return;

    setBusy(true);
    setErrorModal(null);

    try {
      const payload = { ...quoteInput(), ma_kh: customerId ? Number(customerId) : null };
      const resultOrder = await api("/don-dat-ve", token, { body: payload });
      setOrder(resultOrder);
    } catch (err) {
      // Visual alert modal with ORA error code
      setErrorModal({
        code: err.code || "LỖI ĐẶT GHẾ",
        message: err.clean_message || err.message,
        plsql: err.plsql_object || "PKG_DAT_VE.SP_GIU_CHO",
      });
      // Deselect conflicting seats
      setSelectedSeats([]);
    } finally {
      setBusy(false);
    }
  };

  // Payment Action (POST /api/dat-ve/thanh-toan -> PKG_DAT_VE.SP_THANH_TOAN)
  const handlePayment = async () => {
    if (!order) return;
    setBusy(true);
    setErrorModal(null);

    try {
      const payload = {
        ma_don: order.ma_don,
        ma_gd_ngoai: extTxCode.trim(),
        phuong_thuc: method,
      };

      const paidOrder = await api(`/don-dat-ve/${order.ma_don}/thanh-toan`, token, { body: payload });
      setLastTxCode(extTxCode.trim());
      sessionStorage.setItem("cinema-last-transaction", extTxCode.trim());
      setOrder(paidOrder);
      onTransaction?.();

      // Loyalty points calculation: +FLOOR(thuc_tra / 10000)
      const thucTra = paidOrder.tong_tien - paidOrder.tien_giam;
      const pointsEarned = Math.floor(thucTra / 10000);
      setSuccessInfo({
        points: pointsEarned,
        thucTra,
        orderId: paidOrder.ma_don
      });
    } catch (err) {
      setErrorModal({
        code: err.code || "LỖI THANH TOÁN",
        message: err.clean_message || err.message,
        plsql: err.plsql_object || "PKG_DAT_VE.SP_THANH_TOAN",
      });
    } finally {
      setBusy(false);
    }
  };

  const simulateExpiry = async () => {
    setBusy(true);
    try {
      const res = await api(`/lab/gia-lap-het-han/${order.ma_don}`, token, { method: "POST" });
      setOrder(current => ({ ...current, han_thanh_toan: res.han_thanh_toan || new Date(Date.now() - 60000).toISOString() }));
      setSimulatedExpiry(true);
    } catch (err) {
      setErrorModal({ code: err.code, message: err.clean_message || err.message, plsql: err.plsql_object });
    } finally { setBusy(false); }
  };

  const resetBooking = () => {
    setOrder(null);
    setSelectedSeats([]);
    setSuccessInfo(null);
    setErrorModal(null);
    setExtTxCode(transactionCode());
    setSimulatedExpiry(false);
  };

  return (
    <div id="booking" className="booking-container">
      {/* Step Indicator */}
      <div className="section-title">
        <div>
          <p className="eyebrow text-orange">ĐẶT VÉ TRỰC TUYẾN CHUẨN GALAXY CINEMA</p>
          <h2>{cashier ? "Bán Vé Tại Quầy (POS)" : "Mua Vé Xem Phim Nhanh"}</h2>
        </div>
        {order && (
          <button type="button" className="btn-secondary-sm" onClick={resetBooking}>
            <RefreshCw size={14} /> Đặt đơn mới
          </button>
        )}
      </div>
      <ol className="booking-stepper" aria-label="Các bước đặt vé">
        {["Phim và suất chiếu", "Ghế, combo và ưu đãi", "Thanh toán và nhận vé"].map((label, i) => (
          <li key={label} aria-current={i === (order ? 2 : show ? 1 : 0) ? "step" : undefined}><b>{i + 1}</b>{label}</li>
        ))}
      </ol>

      {/* FILTER & SELECTOR BAR */}
      {!order && (
        <div className="booking-filter-bar panel">
          {/* Cinema Filter */}
          <div className="filter-group">
            <label>
              <MapPin size={15} className="text-orange" />
              <span>01 · Chọn Cụm Rạp</span>
            </label>
            <select
              aria-label="Cụm rạp"
              value={cinema}
              onChange={e => {
                setCinema(e.target.value);
                setShow("");
                setSelectedSeats([]);
              }}
            >
              <option value="">Tất cả cụm rạp</option>
              {catalog.rap.map(r => (
                <option key={r.ma_rap} value={r.ma_rap}>{r.ten_rap}</option>
              ))}
            </select>
          </div>

          {/* Movie Filter */}
          <div className="filter-group">
            <label>
              <Film size={15} className="text-orange" />
              <span>02 · Chọn Phim</span>
            </label>
            <select
              aria-label="Phim"
              value={film}
              onChange={e => {
                setFilm(e.target.value);
                setShow("");
                setSelectedSeats([]);
              }}
            >
              <option value="">Tất cả phim đang chiếu</option>
              {catalog.phim.filter(p => p.dang_chieu).map(p => (
                <option key={p.ma_phim} value={p.ma_phim}>{p.ten_phim}</option>
              ))}
            </select>
          </div>

          {/* Format Filter */}
          <div className="filter-group">
            <label>
              <Sparkles size={15} className="text-orange" />
              <span>03 · Định Dạng</span>
            </label>
            <select
              aria-label="Định dạng"
              value={format}
              onChange={e => {
                setFormat(e.target.value);
                setShow("");
                setSelectedSeats([]);
              }}
            >
              <option value="ALL">Tất cả định dạng</option>
              <option value="2D">2D Digital</option>
              <option value="3D">3D Kính nổi</option>
              <option value="IMAX">IMAX Laser</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="filter-group">
            <label>
              <CalendarDays size={15} className="text-orange" />
              <span>04 · Ngày Chiếu</span>
            </label>
            <select
              aria-label="Ngày chiếu"
              value={day}
              onChange={e => {
                setDay(e.target.value);
                setShow("");
                setSelectedSeats([]);
              }}
            >
              <option value="">Tất cả ngày</option>
              {availableDays.map(d => (
                <option key={d} value={d}>{dateLabel(d)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* SHOWTIMES PILLS */}
      {!order && matchingShows.length > 0 && (
        <div className="showtime-selection-panel panel">
          <h4 className="showtime-header">
            <Clock3 size={16} className="text-orange" /> Chọn Suất Chiếu Phù Hợp:
          </h4>
          <div className="showtimes-grid">
            {matchingShows.slice(0, 15).map(s => {
              const isSelected = String(s.ma_suat) === show;
              return (
                <button
                  type="button"
                  key={s.ma_suat}
                  data-show-id={s.ma_suat}
                  className={`showtime-pill ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    setShow(String(s.ma_suat));
                    setSelectedSeats([]);
                  }}
                >
                  <span className="showtime-hour">{clock(s.gio_bat_dau)}{s.gio_ket_thuc && `–${clock(s.gio_ket_thuc)}`}</span>
                  <div className="showtime-meta">
                    <span className="format-tag">{s.dinh_dang}</span>
                    <span className="room-name">{s.ten_phong}</span>
                    <span className="site-name">{catalog.rap.find(r => r.ma_rap === s.ma_rap)?.ten_rap}</span>
                  </div>
                  <div className="showtime-pricing">
                    <span className="price">{vnd(s.gia_co_ban)}</span>
                    {Boolean(s.la_cuoi_tuan ?? s.is_cuoi_tuan) && (
                      <span className="weekend-badge">+20% Cuối tuần</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {!order && matchingShows.length === 0 && <p className="panel muted booking-empty">Không có suất đang mở bán theo bộ lọc hiện tại.</p>}

      {/* SEAT MAP & STICKY SUMMARY LAYOUT */}
      {!order && show && (
        <div className="booking-main-grid">
          {/* Left Column: Visual Seat Map */}
          <div className="panel seat-map-box">
            <div className="seat-map-header">
              <div>
                <h3><Armchair className="text-orange" size={20} /> Sơ Đồ Chọn Ghế Ngồi</h3>
                <p className="muted">
                  Phòng chiếu: <strong>{selectedShow?.ten_phong}</strong> · Rạp: <strong>{selectedCinema?.ten_rap}</strong> · Suất: <strong>{clock(selectedShow?.gio_bat_dau)}</strong>
                </p>
              </div>
              <span className="badge-plsql">VIEW V_SO_DO_GHE</span>
            </div>
            {demo && <label className="seat-conflict-toggle"><input type="checkbox" checked={conflictDemo} onChange={e => { setConflictDemo(e.target.checked); setSelectedSeats([]); }} /> Thử tranh chấp ghế (TC-02/TC-03)</label>}

            <SeatMap
              showId={Number(show)}
              selected={selectedSeats}
              onToggle={handleToggleSeat}
              conflictDemo={conflictDemo}
            />
          </div>

          {/* Right Column: Sticky Summary & Checkout */}
          <div className="panel booking-summary-sidebar">
            <h3 className="summary-title">Tóm Tắt Đơn Vé</h3>

            {selectedFilm && (
              <div className="summary-film-card">
                <img src={moviePoster(selectedFilm)} alt="" className="summary-poster" />
                <div>
                  <span className={`age-tag age-${selectedFilm.do_tuoi}`}>{selectedFilm.do_tuoi}</span>
                  <h4>{selectedFilm.ten_phim}</h4>
                  <p className="muted text-sm">{selectedFilm.thoi_luong_phut} phút · {selectedShow?.dinh_dang}</p>
                </div>
              </div>
            )}

            <div className="summary-details">
              <div className="detail-line">
                <span className="label">Rạp chiếu:</span>
                <strong>{selectedCinema?.ten_rap}</strong>
              </div>
              <div className="detail-line">
                <span className="label">Phòng chiếu:</span>
                <strong>{selectedShow?.ten_phong}</strong>
              </div>
              <div className="detail-line">
                <span className="label">Suất chiếu:</span>
                <strong>{clock(selectedShow?.gio_bat_dau)} · {dateLabel(selectedShow?.gio_bat_dau)}</strong>
              </div>
              <div className="detail-line">
                <span className="label">Ghế đang chọn:</span>
                <span className="selected-seats-badge">
                  {selectedSeats.length > 0 ? (
                    selectedSeats.map(s => `${s.hang}${s.so_ghe} (${s.ten_loai})`).join(", ")
                  ) : (
                    <em className="muted">Chưa chọn ghế</em>
                  )}
                </span>
              </div>
            </div>

            {/* Combos selection */}
            <div className="summary-combos">
              <label className="combo-label">Combo bắp nước Galaxy:</label>
              <select
                aria-label="Combo bắp nước"
                value={combo}
                onChange={e => setCombo(e.target.value)}
                className="combo-select"
              >
                <option value="">Không chọn bắp nước</option>
                {catalog.combo.map(c => (
                  <option key={c.ma_combo} value={c.ma_combo}>
                    {c.ten_combo} (+{vnd(c.gia ?? c.don_gia)})
                  </option>
                ))}
              </select>
              {combo && (
                <div className="combo-qty-row">
                  <span>Số lượng combo:</span>
                  <button type="button" className="btn-secondary-sm" disabled={qty <= 1} aria-label="Giảm số lượng combo" onClick={() => setQty(n => n - 1)}>−</button>
                  <input
                    type="number"
                    aria-label="Số lượng combo"
                    min="1"
                    max="8"
                    value={qty}
                    onChange={e => setQty(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="qty-input"
                  />
                  <button type="button" className="btn-secondary-sm" disabled={qty >= 8} aria-label="Tăng số lượng combo" onClick={() => setQty(n => n + 1)}>+</button>
                </div>
              )}
            </div>

            {/* Promo Voucher Code */}
            <div className="summary-promo">
              <label className="promo-label">Mã khuyến mãi / Voucher:</label>
              <div className="promo-input-row">
                <input
                  type="text"
                  aria-label="Mã ưu đãi"
                  placeholder="Nhập mã voucher..."
                  value={promo}
                  onChange={e => setPromo(e.target.value.toUpperCase())}
                  className="promo-input"
                />
              </div>
              <div className="promo-quick-buttons">
                {(catalog.vouchers || []).filter(v => demo || (v.so_luot_con_lai ?? 0) > 0).map(v => (
                  <button key={v.ma_code} type="button" className="btn-quick-promo" onClick={() => setPromo(v.ma_code)}>
                    {v.ma_code} · {v.so_luot_con_lai ?? Math.max(0, v.so_luot_toi_da - v.so_luot_da_dung)} lượt
                  </button>
                ))}
                {demo && <button type="button" className="btn-quick-promo error-test" onClick={() => setPromo("MA_KIEM_THU_KHONG_TON_TAI")}>Thử mã sai</button>}
              </div>
            </div>

            {/* Total Price & CTA */}
            <div className="summary-total-box">
              <div className="total-row">
                <span>Thực trả dự kiến:</span>
                <strong className="text-orange total-price">{quotePending ? "Đang tính…" : quote ? vnd(quote.thuc_tra) : "—"}</strong>
              </div>
              {quote && <p className="muted">Vé {vnd(quote.tong_ve)} · Combo {vnd(quote.tong_combo)} · Giảm {vnd(quote.tien_giam)}</p>}
              {quoteError && <p className="error-alert" role="alert">{quoteError}</p>}
              <p className="muted text-xs">
                * Ghế được giữ chỗ trong 10 phút sau khi xác nhận.
              </p>
              <button
                type="button"
                className="primary w-full btn-hold-seats"
                disabled={selectedSeats.length === 0 || busy || (token && !quote)}
                onClick={handleHoldSeats}
              >
                {busy ? <RefreshCw className="spin" size={18} /> : <Ticket size={18} />}
                {token ? "GIỮ CHỖ NGAY (10 PHÚT)" : "ĐĂNG NHẬP ĐỂ GIỮ CHỖ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: PAYMENT & TIMER (AFTER HOLD SUCCESS) */}
      {order && order.trang_thai === "CHO_THANH_TOAN" && (
        <div className="payment-modal-section panel">
          <div className="payment-header">
            <div>
              <span className="eyebrow text-orange">BƯỚC THANH TOÁN ĐƠN VÉ #{order.ma_don}</span>
              <h2>Xác Nhận Thanh Toán & Cấp Vé Điện Tử</h2>
            </div>
            {/* 10-Minute Hold Countdown Timer */}
            <div className={`countdown-timer-box ${secondsLeft <= 60 ? "urgent" : ""}`}>
              <Clock3 size={22} />
              <div>
                <span className="timer-label">THỜI GIAN GIỮ GHẾ</span>
                <span className="timer-digits">{timerDisplay}</span>
              </div>
            </div>
            {demo && !simulatedExpiry && secondsLeft > 0 && <button className="btn-secondary-sm" type="button" disabled={busy} onClick={simulateExpiry}>Giả lập quá hạn</button>}
          </div>

          <div className="payment-content-grid">
            <div className="payment-info-col">
              <h4>Thông Tin Đơn Vé Giữ Chỗ</h4>
              <p>Mã đơn hàng: <strong className="code-font">#{order.ma_don}</strong></p>
              <p>Ghế giữ: <strong>{order.tickets?.map(t => `${t.hang}${t.so_ghe}`).join(", ")}</strong></p>
              <p>Tổng tiền vé: <strong>{vnd(order.tong_tien)}</strong></p>
              {order.tien_giam > 0 && (
                <p className="text-green">Ưu đãi giảm giá: <strong>-{vnd(order.tien_giam)}</strong></p>
              )}
              <h3 className="final-pay-amount">
                Thực trả: <span className="text-orange">{vnd(order.tong_tien - order.tien_giam)}</span>
              </h3>
            </div>

            <div className="payment-form-col">
              <label>Phương thức thanh toán:</label>
              <div className="payment-methods-grid">
                {[
                  ["THE", "Thẻ Ngân Hàng / Visa", CreditCard],
                  ["VI_DIEN_TU", "Ví Điện Tử (MoMo/ZaloPay)", Sparkles],
                  ["CHUYEN_KHOAN", "Chuyển Khoản QR Ngân Hàng", QrCode],
                ].map(([val, label, Icon]) => (
                  <button
                    key={val}
                    type="button"
                    className={`method-select-btn ${method === val ? "active" : ""}`}
                    onClick={() => setMethod(val)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Transaction code with test buttons */}
              <div className="tx-code-input-group">
                <label>Mã giao dịch đối tác (ma_giao_dich_ngoai):</label>
                <div className="tx-input-row">
                  <input
                    type="text"
                    value={extTxCode}
                    onChange={e => setExtTxCode(e.target.value)}
                    required
                    className="tx-input"
                  />
                  <button
                    type="button"
                    className="btn-tx-gen"
                    onClick={() => setExtTxCode(transactionCode())}
                  >
                    Tự sinh mã mới
                  </button>
                  {demo && lastTxCode && (
                    <button
                      type="button"
                      className="btn-tx-dup"
                      onClick={() => setExtTxCode(lastTxCode)}
                      title="Gửi lại mã giao dịch vừa thanh toán để kiểm thử lỗi ORA-20027"
                    >
                      Thử gửi trùng mã cũ (Test ORA-20027)
                    </button>
                  )}
                </div>
              </div>

              <div className="payment-cta-row">
                <button
                  type="button"
                  disabled={busy || (!simulatedExpiry && secondsLeft <= 0) || !extTxCode.trim()}
                  className="primary btn-pay-now"
                  onClick={handlePayment}
                >
                  {busy ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
                  XÁC NHẬN THANH TOÁN (SP_THANH_TOAN)
                </button>
              </div>
              <p className="muted">Thanh toán mô phỏng, không trừ tiền thật.</p>
            </div>
          </div>
        </div>
      )}

      {/* STEP: ORDER COMPLETED & E-TICKETS (DA_THANH_TOAN) */}
      {order && order.trang_thai === "DA_THANH_TOAN" && (
        <div className="tickets-completed-section panel">
          <div className="completed-header">
            <CheckCircle2 size={36} className="text-green" />
            <div>
              <h2>Thanh Toán Thành Công · Đơn Hàng #{order.ma_don}</h2>
              <p className="muted">Oracle Database 23ai đã xác thực giao dịch, sinh mã QR bảo mật và cập nhật điểm tích lũy.</p>
            </div>
          </div>

          {/* Loyalty Points Alert */}
          {successInfo && (
            <div className="loyalty-points-banner">
              <Coins size={22} className="text-orange" />
              <div>
                <strong>+ {successInfo.points} Điểm Tích Lũy G-Star</strong> vừa được cộng vào tài khoản của bạn!
                <span className="muted text-sm"> (Quy tắc BR-11: Mỗi 10.000đ thanh toán nhận 1 điểm tích lũy).</span>
              </div>
            </div>
          )}

          {/* E-Ticket Display */}
          <div className="tickets-grid">
            {order.tickets?.map(t => (
              <GalaxyTicketCard
                key={t.ma_ve}
                ticket={t}
                onJumpToScanner={onOpenScanner}
              />
            ))}
          </div>

          <div className="completed-actions">
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              In Vé Điện Tử
            </button>
            <button type="button" className="primary" onClick={resetBooking}>
              Đặt Vé Phim Khác
            </button>
          </div>
        </div>
      )}

      {/* BUSINESS ERROR MODAL (ORA-20021, ORA-20026, ORA-20027, ETC.) */}
      {errorModal && (
        <div className="modal-backdrop" onClick={() => setErrorModal(null)}>
          <div className="error-dialog-card" onClick={e => e.stopPropagation()}>
            <div className="error-dialog-header">
              <AlertTriangle size={28} className="text-red" />
              <div>
                <span className="error-ora-code">{errorModal.code}</span>
                <h3>Cảnh Báo Ràng Buộc Nghiệp Vụ CSDL</h3>
              </div>
              <button className="icon-btn-close" onClick={() => setErrorModal(null)}>×</button>
            </div>
            <div className="error-dialog-body">
              <p className="error-message-text">{errorModal.message}</p>
              <div className="error-plsql-info">
                <span>Đối tượng CSDL bắt lỗi:</span>
                <code>{errorModal.plsql}</code>
              </div>
            </div>
            <div className="error-dialog-footer">
              <button type="button" className="primary" onClick={() => setErrorModal(null)}>
                Đã hiểu & Tải lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Module (Tab 2: Vé của tôi & Hoàn Hủy Vé)
// ---------------------------------------------------------------------------
export function History({ session, customerId, onOpenScanner, onResume, demo, onTransaction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorModal, setErrorModal] = useState(null);
  const [refundModal, setRefundModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const token = session?.token;

  const loadHistory = () => {
    if (!customerId || !token) { setLoading(false); return; }
    setLoading(true);
    api(`/khach-hang/${customerId}/don-dat-ve`, token)
      .then(res => {
        setData(res);
      })
      .catch(e => setErrorModal({ code: e.code || "LỖI", message: e.clean_message || e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [customerId, token]);

  const handleCancelTicket = async ticketId => {
    if (busy) return;
    if (!window.confirm(`Bạn có chắc chắn muốn hủy Vé #${ticketId} và yêu cầu hoàn tiền?`)) return;

    setBusy(true);
    try {
      const refund = await api(`/ve/${ticketId}/huy`, token, {
        body: {
          ma_ve: ticketId,
          ly_do: "Khách hàng yêu cầu hủy vé trực tuyến",
          ngoai_le: false
        }
      });
      setRefundModal(refund);
      onTransaction?.();
      loadHistory();
    } catch (err) {
      setErrorModal({
        code: err.code || "LỖI HỦY VÉ",
        message: err.clean_message || err.message,
        plsql: err.plsql_object || "PKG_DAT_VE.SP_HUY_VE",
      });
    } finally { setBusy(false); }
  };

  const handleSimulate = async id => {
    setBusy(true);
    try {
      await api(`/lab/gia-lap-het-han/${id}`, token, { method: "POST" });
      loadHistory();
    } catch (e) { setErrorModal({ code: e.code, message: e.clean_message || e.message, plsql: e.plsql_object }); }
    finally { setBusy(false); }
  };

  return (
    <div className="my-tickets-container panel">
      {/* Customer Header */}
      {data?.customer && (
        <div className="customer-profile-card">
          <div className="customer-info-main">
            <h2>{data.customer.ho_ten}</h2>
            {data.customer.email && <p className="muted">Email: {data.customer.email}</p>}
          </div>
          <div className="customer-stats">
            <div className="stat-pill">
              <span className="stat-label">Hạng Thành Viên:</span>
              <strong className={`tier-badge tier-${data.customer.hang_thanh_vien?.toLowerCase()}`}>
                {data.customer.hang_thanh_vien === "BAC" ? "🥈 G-Star Bạc" : data.customer.hang_thanh_vien === "VANG" ? "🥇 G-Star Vàng" : "🥉 G-Star Thường"}
              </strong>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Điểm Tích Lũy:</span>
              <strong className="text-orange">{data.customer.diem_tich_luy} điểm</strong>
            </div>
          </div>
        </div>
      )}

      <div className="section-title">
        <div>
          <p className="eyebrow text-orange">QUẢN LÝ VÉ & HOÀN TIỀN (SP_HUY_VE)</p>
          <h2>Lịch Sử Đặt Vé Của Bạn (Tối ưu bởi IX_DON_KH_TG)</h2>
        </div>
        <button type="button" className="btn-secondary-sm" onClick={loadHistory} disabled={loading || !customerId}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Làm mới
        </button>
      </div>

      {loading && !data && <p className="muted text-center py-6">Đang đọc lịch sử đặt vé từ Oracle...</p>}
      {!customerId && <p className="muted">Chọn phiên khách hàng để xem vé của mình.</p>}

      {data?.orders?.length === 0 && (
        <p className="muted text-center py-8">Bạn chưa có đơn đặt vé nào.</p>
      )}

      {/* Orders & Tickets List */}
      <div className="orders-stack">
        {data?.orders?.map(orderItem => (
          <div key={orderItem.ma_don} className="order-block">
            <div className="order-block-header">
              <div>
                <strong>Đơn Hàng #{orderItem.ma_don}</strong>
                <span className="order-date muted text-sm"> · {dateLabel(orderItem.thoi_gian_dat)} {clock(orderItem.thoi_gian_dat)}</span>
              </div>
              <div className="order-block-pricing">
                <span className={`status-pill ${orderItem.trang_thai === "DA_THANH_TOAN" ? "success" : orderItem.trang_thai === "DA_HUY" ? "error" : "warning"}`}>
                  {orderItem.trang_thai}
                </span>
                <strong className="text-orange">{vnd(orderItem.tong_tien - orderItem.tien_giam)}</strong>
              </div>
            </div>
            {orderItem.trang_thai === "CHO_THANH_TOAN" && <div className="actions order-pending-actions">
              <button type="button" className="primary" disabled={busy} onClick={() => onResume?.(orderItem)}>Thanh toán tiếp</button>
              {demo && <button type="button" className="btn-secondary-sm" disabled={busy} onClick={() => handleSimulate(orderItem.ma_don)}>Giả lập quá hạn</button>}
            </div>}

            {/* Tickets inside order */}
            <div className="order-tickets-list">
              {orderItem.tickets?.map(t => (
                <GalaxyTicketCard
                  key={t.ma_ve}
                  ticket={t}
                  onCancel={busy ? undefined : handleCancelTicket}
                  onJumpToScanner={onOpenScanner}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Refund Success Modal */}
      {refundModal && (
        <div className="modal-backdrop" onClick={() => setRefundModal(null)}>
          <div className="sql-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sql-modal-header">
              <CheckCircle2 size={28} className="text-green" />
              <h3>Hủy Vé & Hoàn Tiền Thành Công</h3>
              <button className="icon-btn-close" onClick={() => setRefundModal(null)}>×</button>
            </div>
            <div className="sql-modal-desc">
              {(refundModal.ma_hoan || refundModal.ma_tt) && <p>Mã phiếu hoàn: <strong className="code-font">#{refundModal.ma_hoan || refundModal.ma_tt}</strong></p>}
              <p>Mã vé hủy: <strong className="code-font">#{refundModal.ma_ve}</strong></p>
              <p>Số tiền hoàn trả: <strong className="text-orange">{vnd(refundModal.so_tien_hoan)}</strong></p>
              {refundModal.diem_tich_luy != null && <p>Điểm tích lũy sau điều chỉnh: <strong>{refundModal.diem_tich_luy}</strong></p>}
              <p className="text-sm muted">Số tiền đã được hoàn trả theo tỷ lệ thực trả sau khi trừ khuyến mãi (BR-07). Ghế đã được giải phóng trên sơ đồ rạp.</p>
            </div>
            <div className="sql-modal-footer">
              <button type="button" className="primary" onClick={() => setRefundModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModal && (
        <div className="modal-backdrop" onClick={() => setErrorModal(null)}>
          <div className="error-dialog-card" onClick={e => e.stopPropagation()}>
            <div className="error-dialog-header">
              <AlertTriangle size={28} className="text-red" />
              <div>
                <span className="error-ora-code">{errorModal.code}</span>
                <h3>Cảnh Báo Nghiệp Vụ CSDL</h3>
              </div>
              <button className="icon-btn-close" onClick={() => setErrorModal(null)}>×</button>
            </div>
            <div className="error-dialog-body">
              <p className="error-message-text">{errorModal.message}</p>
              {errorModal.plsql && (
                <div className="error-plsql-info">
                  <span>Đối tượng PL/SQL:</span>
                  <code>{errorModal.plsql}</code>
                </div>
              )}
            </div>
            <div className="error-dialog-footer">
              <button type="button" className="primary" onClick={() => setErrorModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
