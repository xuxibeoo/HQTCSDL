import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import {
  Film,
  Ticket,
  Play,
  ArrowRight,
  X,
  Search,
  Heart,
  Info,
  MapPin,
  MonitorPlay,
  UserRound,
  Copy,
  ChevronLeft,
  ChevronRight,
  QrCode,
  BarChart3,
  FlaskConical,
  Sparkles,
  ShieldCheck,
  Check
} from "lucide-react";
import { api, vnd } from "./api";
import { moviePoster, movieBackdrop } from "./movie-art";
import { Booking, History } from "./booking";
import { GateScanner } from "./scanner";
import { AnalyticsDashboard } from "./analytics";
import { OracleLab } from "./lab";
import { LiveInspector } from "./inspector";
import { DemoGuide } from "./demo-guide";
import "./style.css";

const filmTabs = ["Phim đang chiếu", "Phim sắp chiếu", "Phim IMAX", "Ưu đãi G-Star"];
const normalize = value => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replaceAll("đ", "d").trim();

function Modal({ children, title, onClose, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"cinema-dialog " + className}
      aria-label={title}
      onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="dialog-content">
        <button type="button" className="close" aria-label="Đóng" onClick={onClose}><X size={20} /></button>
        {children}
      </div>
    </dialog>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("cinema") || "null"); } catch { return null; }
  });
  const [catalog, setCatalog] = useState({ phim: [], rap: [], combo: [], the_loai: [] });
  const [shows, setShows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [demoRole, setDemoRole] = useState(() => sessionStorage.getItem("cinema-demo-role") || "");
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  
  // 5 Main Navigation Tabs: 'booking' | 'myTickets' | 'scanner' | 'analytics' | 'lab'
  const [mainNav, setMainNav] = useState("booking");

  const [filmSubTab, setFilmSubTab] = useState("Phim đang chiếu");
  const [preset, setPreset] = useState(null);
  const [offer, setOffer] = useState(null);
  const [details, setDetails] = useState(null);
  const [slide, setSlide] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cinema-favorites") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const [loginModal, setLoginModal] = useState(false);
  const [demoGuideOpen, setDemoGuideOpen] = useState(() => new URLSearchParams(window.location.search).get("demo") === "1");
  const [scannerPreFill, setScannerPreFill] = useState("");
  const [resumeOrder, setResumeOrder] = useState(null);

  const refreshCatalog = () => Promise.all([api("/catalog"), api("/suat-chieu"), api("/khuyen-mai")])
    .then(([data, schedule, vouchers]) => {
      setCatalog({ ...data, vouchers });
      setShows(schedule);
    })
    .catch(e => setError(e.clean_message || e.message));

  const refreshCustomers = () => api("/khach-hang")
    .then(setCustomers)
    .catch(e => setError(e.clean_message || e.message));

  useEffect(() => {
    api("/health").then(data => {
      setHealth(data);
      if (!data.demo) return;
      refreshCustomers();
      if (!session) switchDemoSession("CUSTOMER_1");
    }).catch(e => setError(e.clean_message || e.message));
    refreshCatalog();
  }, []);

  function installSession(data, demo = "") {
    if (data) sessionStorage.setItem("cinema", JSON.stringify(data));
    else sessionStorage.removeItem("cinema");
    if (demo) sessionStorage.setItem("cinema-demo-role", demo);
    else sessionStorage.removeItem("cinema-demo-role");
    setDemoRole(demo);
    setResumeOrder(null);
    setScannerPreFill("");
    setSession(data);
    setLoginModal(false);
    setError("");
  }

  async function switchDemoSession(roleKey) {
    try {
      const userSession = await api("/auth/demo/" + roleKey, null, { method: "POST" });
      installSession(userSession, roleKey);
      return true;
    } catch (e) {
      setError(e.clean_message || e.message);
      return false;
    }
  }

  function setDemoGuide(open) {
    setDemoGuideOpen(open);
    const url = new URL(window.location.href);
    if (open) url.searchParams.set("demo", "1");
    else url.searchParams.delete("demo");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  async function openDemoStep(target, roleKey, scenario) {
    const keepCustomer = ["booking", "myTickets"].includes(target) && session?.user?.role === "ROLE_CUSTOMER";
    if (health?.demo && !keepCustomer && demoRole !== roleKey) {
      const changed = await switchDemoSession(roleKey);
      if (!changed) throw new Error("Chưa chuyển được tài khoản mẫu. Kiểm tra API rồi thử lại.");
    }
    if (scenario) {
      setResumeOrder(null);
      setPreset({ film: scenario.ma_phim, cinema: scenario.ma_rap, show: scenario.ma_suat, day: scenario.gio_bat_dau?.slice(0, 10), demoKey: Date.now() });
    }
    setMainNav(target);
    setDemoGuide(false);
    requestAnimationFrame(() => target === "booking"
      ? document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })
      : window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function chooseMovie(filmItem, cinemaId) {
    setDetails(null);
    setPreset({ film: filmItem?.ma_phim, cinema: cinemaId });
    setMainNav("booking");
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  }

  function toggleFavorite(id) {
    setFavorites(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);
  }

  useEffect(() => {
    try { localStorage.setItem("cinema-favorites", JSON.stringify(favorites)); } catch { /* Storage */ }
  }, [favorites]);

  const premieres = catalog.phim.filter(f => f.dang_chieu).slice(0, 4);
  const featured = premieres[slide] || premieres[0];
  const searching = Boolean(search.trim()) || onlyFavorites;
  const filteredMovies = catalog.phim.filter(f => {
    if (searching) return (!onlyFavorites || favorites.includes(f.ma_phim)) && normalize(f.ten_phim).includes(normalize(search));
    if (filmSubTab === "Phim sắp chiếu") return !f.dang_chieu;
    if (filmSubTab === "Phim IMAX") return shows.some(s => s.ma_phim === f.ma_phim && s.dinh_dang === "IMAX");
    return f.dang_chieu;
  });

  const movieFormats = movie => [...new Set(shows.filter(s => s.ma_phim === movie.ma_phim).map(s => s.dinh_dang))].join(" · ");
  const movieGenres = movie => {
    const names = movie.the_loai || movie.the_loai_ten || "";
    return Array.isArray(names) ? names.map(n => typeof n === "string" ? n : n.ten_the_loai).filter(Boolean).join(" · ") : names;
  };
  const chooseOffer = code => {
    setOffer({ code });
    setFilmSubTab("Phim đang chiếu");
    requestAnimationFrame(() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" }));
  };
  const stepSlide = offset => { if (premieres.length) setSlide(index => (index + offset + premieres.length) % premieres.length); };
  const member = customers.find(c => c.ma_kh === session?.user?.id && session?.user?.role === "ROLE_CUSTOMER");
  const openScanner = code => {
    setScannerPreFill(code);
    setMainNav("scanner");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="galaxy-cinema-app">
      {/* -------------------------------------------------------------------
          STICKY TOPBAR: GALAXY HUFLIT CINEMA THEME
      ------------------------------------------------------------------- */}
      <header className="galaxy-topbar">
        <div className="topbar-inner shell">
          {/* Brand Logo */}
          <a
            className="galaxy-brand"
            href="/"
            onClick={e => {
              e.preventDefault();
              setMainNav("booking");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span className="brand-galaxy">GALAXY</span>
            <span className="brand-huflit">HUFLIT</span>
            <span className="brand-cinema">CINEMA</span>
            <span className="oracle-brand-badge">Oracle 23ai</span>
          </a>

          {/* 5 Primary Navigation Tabs */}
          <nav className="galaxy-main-nav" aria-label="Điều hướng chính đồ án">
            <button
              className={`nav-tab-btn ${mainNav === "booking" ? "active" : ""}`}
              onClick={() => { setMainNav("booking"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <Ticket size={16} /> Đặt vé xem phim
            </button>
            <button
              className={`nav-tab-btn ${mainNav === "myTickets" ? "active" : ""}`}
              onClick={() => { setMainNav("myTickets"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <Film size={16} /> Vé của tôi & hoàn/hủy
            </button>
            <button
              className={`nav-tab-btn ${mainNav === "scanner" ? "active" : ""}`}
              onClick={() => { setMainNav("scanner"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <QrCode size={16} /> Soát vé QR
            </button>
            <button
              className={`nav-tab-btn ${mainNav === "analytics" ? "active" : ""}`}
              onClick={() => { setMainNav("analytics"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <BarChart3 size={16} /> Báo cáo doanh thu
            </button>
            <button
              className={`nav-tab-btn ${mainNav === "lab" ? "active" : ""}`}
              onClick={() => { setMainNav("lab"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <FlaskConical size={16} /> Phòng Lab kiểm thử
            </button>
          </nav>

          {/* Top Actions: Session Switcher & Account */}
          <div className="galaxy-top-actions">
            <button type="button" className="demo-help-trigger" onClick={() => setDemoGuide(true)}><Info size={16} /> Hướng dẫn demo</button>
            {/* Session Switcher (Khách 1 vs Khách 2) */}
            {health?.demo && <div className="session-switcher-wrap" title="Chuyển nhanh tài khoản để demo tranh chấp ghế hoặc phân quyền">
              <span className="session-icon"><UserRound size={14} /></span>
              <select
                className="session-select"
                aria-label="Chuyển tài khoản demo"
                value={demoRole}
                onChange={e => { if (e.target.value) switchDemoSession(e.target.value); }}
              >
                <option value="" disabled>Chọn tài khoản demo</option>
                <optgroup label="Khách hàng (Demo Tranh Chấp Ghế)">
                  {customers.map(c => <option key={c.ma_kh} value={c.demo_role}>{c.ho_ten} · {c.hang_thanh_vien} · {c.diem_tich_luy} điểm</option>)}
                </optgroup>
                <optgroup label="Nhân viên & Quản lý Cụm rạp">
                  <option value="CASHIER">🎫 Thu ngân POS</option>
                  <option value="USHER">🎟️ Soát vé cửa phòng</option>
                  <option value="CINEMA_MANAGER">🏢 Quản lý rạp</option>
                  <option value="IT_ADMIN">💻 Kỹ thuật IT (Admin)</option>
                  <option value="ACCOUNTING">📊 Kế toán đối soát</option>
                </optgroup>
              </select>
            </div>}

            {session?.user ? (
              <div className="user-logged-info">
                <span className="user-email-chip">{session.user.ho_ten || session.user.email}</span>
                {member && <span className="member-points">{member.hang_thanh_vien} · {member.diem_tich_luy} điểm</span>}
                <button
                  type="button"
                  className="btn-logout"
                  onClick={() => installSession(null)}
                  title="Đăng xuất"
                >
                  Thoát
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="account-button"
                onClick={() => setLoginModal(true)}
              >
                <UserRound size={16} /> Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Error Notice */}
      {error && (
        <div role="alert" className="notice shell">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* -------------------------------------------------------------------
          TAB 1: ĐẶT VÉ TRỰC TUYẾN (ONLINE BOOKING FLOW)
      ------------------------------------------------------------------- */}
      {mainNav === "booking" && (
        <>
          {/* Hero Carousel */}
          <section className="galaxy-hero" aria-label="Phim nổi bật">
            {featured && (
              <img
                className="hero-backdrop"
                key={featured.ma_phim}
                src={movieBackdrop(featured)}
                alt=""
                fetchPriority="high"
              />
            )}
            <div className="hero-inner shell">
              <div className="eyebrow hero-label text-orange">GALAXY HUFLIT CINEMA · SUẤT CHIẾU ĐẶC BIỆT</div>
              <h1>
                {featured?.ten_phim || "Hệ Thống Đặt Vé Xem Phim"}
              </h1>
              {featured && (
                <div className="badges">
                  <span className={`age-tag age-${featured.do_tuoi}`}>{featured.do_tuoi}</span>
                  <span>{featured.thoi_luong_phut} phút</span>
                  {movieFormats(featured) && <span>{movieFormats(featured)}</span>}
                </div>
              )}
              <p>Trải nghiệm rạp chiếu chuẩn quốc tế trên nền tảng Oracle Database 23ai. Đặt vé giữ chỗ 10 phút, cấp mã QR vé điện tử tức thì.</p>
              <div className="actions">
                <button
                  className="primary hero-cta"
                  disabled={!featured}
                  onClick={() => chooseMovie(featured)}
                >
                  <Ticket size={18} /> Đặt vé ngay
                </button>
                <button
                  className="secondary hero-details"
                  disabled={!featured}
                  onClick={() => setDetails(featured)}
                >
                  <Info size={17} /> Chi tiết phim
                </button>
              </div>
            </div>

            {premieres.length > 1 && (
              <div className="hero-control shell">
                <div className="slide-buttons">
                  <button className="icon-button" aria-label="Phim nổi bật trước" onClick={() => stepSlide(-1)}>
                    <ChevronLeft size={18} />
                  </button>
                  <span>{String(slide + 1).padStart(2, "0")} / {String(premieres.length).padStart(2, "0")}</span>
                  <button className="icon-button" aria-label="Phim nổi bật tiếp theo" onClick={() => stepSlide(1)}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Main Booking Panel */}
          <main className="shell main">
            <Booking
              key={(session?.token || "guest") + (preset?.demoKey || "")}
              catalog={catalog}
              shows={shows}
              session={session}
              preset={preset}
              offer={offer}
              onLogin={() => setLoginModal(true)}
              onOpenScanner={openScanner}
              resumeOrder={resumeOrder}
              onResumeConsumed={() => setResumeOrder(null)}
              demo={health?.demo}
              onTransaction={health?.demo ? refreshCustomers : undefined}
            />

            {/* Catalog Section */}
            <section className="section catalog-section" id="catalog">
              <div className="section-title">
                <div>
                  <p className="eyebrow text-orange">TRÊN MÀN ẢNH LỚN GALAXY</p>
                  <h2>{onlyFavorites ? "Phim Yêu Thích Của Bạn" : searching ? "Kết Quả Tìm Kiếm" : "Phim Đang Chiếu Tại Rạp"}</h2>
                </div>
                <div className="tabs">
                  {filmTabs.map(t => (
                    <button
                      key={t}
                      className={filmSubTab === t ? "active" : ""}
                      onClick={() => { setFilmSubTab(t); setSearch(""); setOnlyFavorites(false); }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="catalog-tools">
                <label className="catalog-search"><Search size={17} /><input type="search" aria-label="Tìm phim" value={search} placeholder="Tìm theo tên phim" onChange={e => { setSearch(e.target.value); if (filmSubTab === "Ưu đãi G-Star") setFilmSubTab("Phim đang chiếu"); }} /></label>
                <button type="button" className="btn-secondary-sm" aria-pressed={onlyFavorites} onClick={() => { setOnlyFavorites(active => !active); setFilmSubTab("Phim đang chiếu"); }}><Heart size={16} /> Phim yêu thích</button>
              </div>
              {filmSubTab === "Ưu đãi G-Star" ? <div className="voucher-cards">
                {catalog.vouchers?.map(v => <article key={v.ma_code} className="panel voucher-card">
                  <strong>{v.ma_code}</strong>
                  <p>{v.loai_giam === "PHAN_TRAM" ? `Giảm ${v.gia_tri}%` : `Giảm ${vnd(v.gia_tri)}`}{v.giam_toi_da ? `, tối đa ${vnd(v.giam_toi_da)}` : ""}</p>
                  <p className="muted">Còn {v.so_luot_con_lai} lượt</p>
                  <button type="button" className="btn-secondary-sm" disabled={!health?.demo && !v.so_luot_con_lai} onClick={() => chooseOffer(v.ma_code)}>{v.ma_code} · Dùng mã</button>
                </article>)}
                {!catalog.vouchers?.length && <p className="muted">Chưa có ưu đãi.</p>}
              </div> : <div className="movie-grid">
                {filteredMovies.map((f, i) => (
                  <article className="movie-card" key={f.ma_phim}>
                    <button
                      className="movie-poster"
                      onClick={() => setDetails(f)}
                      aria-label={"Chi tiết " + f.ten_phim}
                    >
                      <img src={moviePoster(f)} alt="" loading={i < 5 ? "eager" : "lazy"} />
                      <span className={`age-tag age-${f.do_tuoi}`}>{f.do_tuoi}</span>
                      <span className="poster-number">{String(i + 1).padStart(2, "0")}</span>
                      <span className="poster-action"><Info size={16} /> Xem chi tiết</span>
                    </button>
                    <div className="movie-caption">
                      <div>
                        <h3><button onClick={() => setDetails(f)}>{f.ten_phim}</button></h3>
                        <small>{f.thoi_luong_phut} phút · {movieGenres(f) || (f.dang_chieu ? (movieFormats(f) || "Đang chiếu") : "Sắp chiếu")}</small>
                      </div>
                      <button
                        className="icon-button heart"
                        aria-label={"Yêu thích " + f.ten_phim}
                        aria-pressed={favorites.includes(f.ma_phim)}
                        onClick={() => toggleFavorite(f.ma_phim)}
                      >
                        <Heart size={19} />
                      </button>
                    </div>
                  </article>
                ))}
                {!filteredMovies.length && <p className="muted">Chưa có phim phù hợp với tiêu chí lọc.</p>}
              </div>}
            </section>
          </main>
        </>
      )}

      {/* -------------------------------------------------------------------
          TAB 2: VÉ CỦA TÔI & HOÀN HỦY VÉ (MY TICKETS & REFUND)
      ------------------------------------------------------------------- */}
      {mainNav === "myTickets" && (
        <main className="shell main pt-8">
          <History
            key={session?.token || "guest"}
            session={session}
            customerId={session?.user?.role === "ROLE_CUSTOMER" ? session.user.id : null}
            onOpenScanner={openScanner}
            onResume={order => { setResumeOrder(order); setMainNav("booking"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            demo={health?.demo}
            onTransaction={health?.demo ? refreshCustomers : undefined}
          />
        </main>
      )}

      {/* -------------------------------------------------------------------
          TAB 3: CỔNG SOÁT VÉ QR (TICKET GATE SCANNER)
      ------------------------------------------------------------------- */}
      {mainNav === "scanner" && (
        <main className="shell main pt-8">
          <GateScanner
            session={session}
            initialCode={scannerPreFill}
          />
        </main>
      )}

      {/* -------------------------------------------------------------------
          TAB 4: BÁO CÁO PHÂN TÍCH DOANH THU (ADVANCED SQL: CTE & WINDOW)
      ------------------------------------------------------------------- */}
      {mainNav === "analytics" && (
        <main className="shell main pt-8">
          <AnalyticsDashboard session={session} />
        </main>
      )}

      {/* -------------------------------------------------------------------
          TAB 5: PHÒNG LAB KIỂM THỬ ORACLE 23ai (ORAL DEFENSE LAB)
      ------------------------------------------------------------------- */}
      {mainNav === "lab" && (
        <main className="shell main pt-8">
          <OracleLab session={session} />
        </main>
      )}

      {/* -------------------------------------------------------------------
          FOOTER
      ------------------------------------------------------------------- */}
      <footer className="shell galaxy-footer">
        <div>
          <strong className="footer-brand">GALAXY <span>HUFLIT</span> CINEMA</strong>
          <p>Đồ án Hệ Quản Trị Cơ Sở Dữ Liệu (Oracle Database 23ai) · Nhóm 5 HUFLIT</p>
        </div>
        <div>
          <strong>Phân Hệ Web</strong>
          <a href="#" onClick={e => { e.preventDefault(); setMainNav("booking"); }}>1. Đặt vé trực tuyến</a>
          <a href="#" onClick={e => { e.preventDefault(); setMainNav("myTickets"); }}>2. Vé & Hoàn hủy</a>
          <a href="#" onClick={e => { e.preventDefault(); setMainNav("scanner"); }}>3. Soát vé QR</a>
        </div>
        <div>
          <strong>Bảo Vệ & Đánh Giá</strong>
          <a href="#" onClick={e => { e.preventDefault(); setMainNav("analytics"); }}>4. Báo cáo CTE & Window</a>
          <a href="#" onClick={e => { e.preventDefault(); setMainNav("lab"); }}>5. Phòng Lab Kiểm Thử 23ai</a>
        </div>
        <div>
          <strong>Trạng Thái CSDL Oracle</strong>
          <span className="oracle-status-pill">
            <span className={`status-dot ${health ? "green" : ""}`} />
            {health ? `${health.oracle} (${health.engine})` : "Đang kiểm tra kết nối Oracle 23ai..."}
          </span>
        </div>
      </footer>

      {/* Movie Details Modal */}
      {demoGuideOpen && <Modal title="Hướng dẫn demo đồ án trong 8–10 phút" className="academic-demo-dialog" onClose={() => setDemoGuide(false)}><DemoGuide session={session} health={health} onGo={openDemoStep} /></Modal>}
      {details && (
        <Modal title={"Chi tiết " + details.ten_phim} onClose={() => setDetails(null)} className="film-dialog">
          <div className="detail-hero">
            <img src={movieBackdrop(details)} alt="" />
            <div>
              <span className={`age-tag age-${details.do_tuoi}`}>{details.do_tuoi}</span>
              <h2>{details.ten_phim}</h2>
            </div>
          </div>
          <div className="detail-body">
            <div>
              <p>{details.mo_ta || "Xem thông tin phim và chọn suất chiếu phù hợp tại hệ thống rạp Galaxy HUFLIT."}</p>
              <div className="actions">
                {details.dang_chieu && (
                  <button className="primary" onClick={() => chooseMovie(details)}>
                    <Ticket size={17} /> Đặt vé ngay
                  </button>
                )}
                {/^https:\/\//i.test(details.trailer_url || "") && <a className="secondary" href={details.trailer_url} target="_blank" rel="noreferrer"><Play size={17} /> Xem trailer</a>}
                <button
                  className="icon-button heart"
                  aria-label="Yêu thích phim này"
                  aria-pressed={favorites.includes(details.ma_phim)}
                  onClick={() => toggleFavorite(details.ma_phim)}
                >
                  <Heart size={18} />
                </button>
              </div>
            </div>
            <dl>
              <dt>Thời lượng</dt>
              <dd>{details.thoi_luong_phut} phút</dd>
              <dt>Định dạng</dt>
              <dd>{movieFormats(details) || "Chưa có suất công bố"}</dd>
              {movieGenres(details) && <><dt>Thể loại</dt><dd>{movieGenres(details)}</dd></>}
            </dl>
          </div>
        </Modal>
      )}

      {/* Login Modal */}
      {loginModal && (
        <Modal title="Đăng nhập tài khoản" onClose={() => setLoginModal(false)} className="login-dialog">
          <img className="login-art" src="/cinema-art/auditorium.jpg" alt="" />
          <form
            className="login-form"
            onSubmit={async e => {
              e.preventDefault();
              const form = Object.fromEntries(new FormData(e.currentTarget));
              try {
                installSession(await api("/auth/login", null, { body: form }));
              } catch (e) {
                setError(e.clean_message || e.message);
                setLoginModal(false);
              }
            }}
          >
            <p className="eyebrow text-orange">GALAXY HUFLIT CINEMA</p>
            <h2>Đăng Nhập Thành Viên</h2>
            <label>
              Email đăng ký
              <input name="email" type="email" autoComplete="username" required />
            </label>
            <label>
              Mật khẩu
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="primary w-full">Đăng nhập</button>
          </form>
        </Modal>
      )}

      {/* Live Oracle 23ai SQL/PLSQL Inspector (Fixed Bottom Drawer) */}
      <LiveInspector />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
