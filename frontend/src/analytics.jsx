import React, { useState, useEffect } from "react";
import { api, vnd } from "./api";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Code, TrendingUp, Award, Users, FileText, Check, Copy } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const SQL_QUERIES = {
  topPhim: {
    title: "1. Top 3 Phim Doanh Thu Cao Nhất Mỗi Tháng (DENSE_RANK)",
    description: "Sử dụng 2 CTE nối tiếp: CTE thứ nhất tính tổng doanh thu theo tháng và phim; CTE thứ hai áp dụng Window Function DENSE_RANK() phân nhóm theo tháng và xếp hạng giảm dần theo doanh thu.",
    sql: `WITH dt_phim_thang AS (
  SELECT TRUNC(s.gio_bat_dau, 'MM') AS thang,
         p.ma_phim,
         p.ten_phim,
         SUM(v.gia_ve) AS doanh_thu
    FROM ve v
    JOIN suat_chieu s ON s.ma_suat = v.ma_suat
    JOIN phim p       ON p.ma_phim = s.ma_phim
   WHERE v.trang_thai IN ('DA_THANH_TOAN', 'DA_SU_DUNG')
   GROUP BY TRUNC(s.gio_bat_dau, 'MM'), p.ma_phim, p.ten_phim
), 
xep_hang AS (
  SELECT t.*,
         DENSE_RANK() OVER (
           PARTITION BY thang 
           ORDER BY doanh_thu DESC
         ) AS hang
    FROM dt_phim_thang t
)
SELECT TO_CHAR(thang, 'YYYY-MM') AS thang,
       ma_phim,
       ten_phim,
       doanh_thu,
       hang
  FROM xep_hang 
 WHERE hang <= 3 
 ORDER BY thang DESC, hang;`
  },
  doanhThuThang: {
    title: "2. Doanh Thu Theo Tháng, Lũy Kế & Tăng Trưởng % (SUM OVER & LAG)",
    description: "Sử dụng CTE gom nhóm doanh thu theo tháng, sau đó áp dụng SUM(...) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) để tính lũy kế, và LAG(doanh_thu) OVER (ORDER BY thang) để lấy doanh thu tháng liền trước tính tốc độ tăng trưởng %.",
    sql: `WITH lich_thang AS (
  SELECT ADD_MONTHS(TRUNC(SYSDATE, 'MM'), LEVEL - 12) AS thang
    FROM dual CONNECT BY LEVEL <= 12
), dt_thang AS (
  SELECT TRUNC(s.gio_bat_dau, 'MM') AS thang,
         SUM(v.gia_ve) AS doanh_thu
    FROM ve v 
    JOIN suat_chieu s ON s.ma_suat = v.ma_suat
   WHERE v.trang_thai IN ('DA_THANH_TOAN', 'DA_SU_DUNG')
   GROUP BY TRUNC(s.gio_bat_dau, 'MM')
), thang_day_du AS (
  SELECT l.thang, NVL(dt.doanh_thu, 0) AS doanh_thu
    FROM lich_thang l LEFT JOIN dt_thang dt ON dt.thang = l.thang
)
SELECT TO_CHAR(thang, 'YYYY-MM') AS thang,
       doanh_thu,
       SUM(doanh_thu) OVER (
         ORDER BY thang 
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS luy_ke,
       LAG(doanh_thu) OVER (ORDER BY thang) AS thang_truoc,
       ROUND(
         100 * (doanh_thu - LAG(doanh_thu) OVER (ORDER BY thang)) 
             / NULLIF(LAG(doanh_thu) OVER (ORDER BY thang), 0),
         1
       ) AS tang_truong_pct
  FROM thang_day_du
 ORDER BY thang;`
  },
  ngay: {
    title: "Doanh thu theo ngày trong 30 ngày gần nhất",
    description: "Recursive CTE tạo lịch đủ 30 ngày. LEFT JOIN giữ lại cả ngày không bán vé.",
    sql: `WITH lich_ngay (ngay, ngay_cuoi) AS (
  SELECT TRUNC(SYSDATE)-29, TRUNC(SYSDATE) FROM dual
  UNION ALL
  SELECT ngay+1, ngay_cuoi FROM lich_ngay WHERE ngay < ngay_cuoi
), dt_ngay AS (
  SELECT TRUNC(s.gio_bat_dau) AS ngay, SUM(v.gia_ve) AS doanh_thu
  FROM suat_chieu s JOIN ve v ON v.ma_suat = s.ma_suat
  WHERE s.gio_bat_dau >= TRUNC(SYSDATE)-29
    AND s.gio_bat_dau < TRUNC(SYSDATE)+1
    AND v.trang_thai IN ('DA_THANH_TOAN','DA_SU_DUNG')
  GROUP BY TRUNC(s.gio_bat_dau)
)
SELECT l.ngay, NVL(d.doanh_thu,0) AS doanh_thu
FROM lich_ngay l LEFT JOIN dt_ngay d ON d.ngay = l.ngay
ORDER BY l.ngay;`
  },
  lapDayPhong: {
    title: "3. Tỷ Lệ Lấp Đầy Phòng Chiếu & Xếp Hạng Từng Rạp (RANK OVER PARTITION BY)",
    description: "Sử dụng 2 CTE tính tổng số ghế phòng và số vé đã bán, sau đó tính tỷ lệ lấp đầy % và dùng RANK() OVER (PARTITION BY r.ma_rap ORDER BY ty_le_lap_day DESC) để xếp hạng hiệu quả phòng chiếu nội bộ từng cụm rạp.",
    sql: `WITH so_ghe AS (
  SELECT ma_phong, COUNT(*) AS tong_ghe 
    FROM ghe 
   GROUP BY ma_phong
), 
ve_ban AS (
  SELECT ma_suat, COUNT(*) AS so_ve 
    FROM ve
   WHERE trang_thai IN ('DA_THANH_TOAN', 'DA_SU_DUNG') 
   GROUP BY ma_suat
)
SELECT r.ten_rap,
       ph.ten_phong,
       p.ten_phim,
       TO_CHAR(s.gio_bat_dau, 'YYYY-MM-DD HH24:MI') AS gio_chieu,
       NVL(vb.so_ve, 0) AS so_ve,
       sg.tong_ghe,
       ROUND(100 * NVL(vb.so_ve, 0) / sg.tong_ghe, 1) AS ty_le_lap_day,
       RANK() OVER (
         PARTITION BY r.ma_rap 
         ORDER BY NVL(vb.so_ve, 0) / sg.tong_ghe DESC
       ) AS hang_trong_rap
  FROM suat_chieu s
  JOIN phim p         ON p.ma_phim = s.ma_phim
  JOIN phong_chieu ph ON ph.ma_phong = s.ma_phong
  JOIN rap r          ON r.ma_rap = ph.ma_rap
  JOIN so_ghe sg      ON sg.ma_phong = s.ma_phong
  LEFT JOIN ve_ban vb ON vb.ma_suat = s.ma_suat
 WHERE s.gio_bat_dau >= TRUNC(SYSDATE)
   AND s.gio_bat_dau < TRUNC(SYSDATE) + 1
 ORDER BY r.ten_rap, hang_trong_rap;`
  }
};

export function AnalyticsDashboard({ session }) {
  const [activeTab, setActiveTab] = useState("topPhim");
  const [topPhimData, setTopPhimData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [occupancyData, setOccupancyData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [sqlModal, setSqlModal] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api("/bao-cao/top-phim-thang", session?.token),
      api("/bao-cao/xu-huong-thang", session?.token),
      api("/bao-cao/ty-le-lap-day", session?.token),
      api("/bao-cao/doanh-thu-30-ngay", session?.token),
    ]).then(([top, trend, occ, daily]) => {
      if (!active) return;
      setTopPhimData(top);
      setTrendData(trend);
      setOccupancyData(occ);
      setDailyData(daily);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.token]);

  const copySql = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Chart 1: Top 3 Movies Chart
  const topMoviesChartData = {
    labels: topPhimData.map(item => `${item.ten_phim} (${item.thang})`),
    datasets: [
      {
        label: "Doanh thu (VNĐ)",
        data: topPhimData.map(item => item.doanh_thu),
        backgroundColor: topPhimData.map(item =>
          item.hang === 1 ? "#F58020" : item.hang === 2 ? "#034EA2" : "#1D4ED8"
        ),
        borderColor: "#111827",
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  };

  // Chart 2: Monthly Trend & Cumulative
  const trendChartData = {
    labels: trendData.map(item => item.thang),
    datasets: [
      {
        type: "bar",
        label: "Doanh thu tháng (VNĐ)",
        data: trendData.map(item => item.doanh_thu),
        backgroundColor: "rgba(3, 78, 162, 0.75)",
        borderColor: "#034EA2",
        borderWidth: 1,
        yAxisID: "y",
      },
      {
        type: "line",
        label: "Lũy kế SUM OVER (VNĐ)",
        data: trendData.map(item => item.luy_ke),
        borderColor: "#F58020",
        backgroundColor: "#F58020",
        borderWidth: 3,
        tension: 0.2,
        yAxisID: "y",
      }
    ]
  };

  // Chart 3: Occupancy Rate
  const occupancyChartData = {
    labels: occupancyData.slice(0, 10).map(item => `${item.ten_rap} - ${item.ten_phong}`),
    datasets: [
      {
        label: "Tỷ lệ lấp đầy (%)",
        data: occupancyData.slice(0, 10).map(item => item.ty_le_lap_day),
        backgroundColor: occupancyData.slice(0, 10).map(item =>
          item.ty_le_lap_day >= 80 ? "#10B981" : item.ty_le_lap_day >= 60 ? "#F58020" : "#034EA2"
        ),
        borderRadius: 6,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#E5E7EB",
          font: { family: "'Be Vietnam Pro', sans-serif" }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw;
            return `${context.dataset.label}: ${activeTab === "lapDayPhong" ? `${val}%` : vnd(val)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: "#9CA3AF", font: { family: "'Be Vietnam Pro', sans-serif", size: 11 } },
        grid: { color: "#1F2937" }
      },
      y: {
        ticks: {
          color: "#9CA3AF",
          font: { family: "'Be Vietnam Pro', sans-serif" },
          callback: (val) => val >= 1000000 ? `${val / 1000000} tr` : val
        },
        grid: { color: "#1F2937" }
      }
    }
  };

  return (
    <div className="analytics-page">
      <div className="section-title">
        <div>
          <p className="eyebrow text-orange">ORACLE 23ai · SQL NÂNG CAO · CHƯƠNG 2</p>
          <h2>Báo Cáo Phân Tích Doanh Thu Phòng Vé</h2>
        </div>
        <div className="analytics-tab-buttons">
          <button
            className={`tab-btn ${activeTab === "topPhim" ? "active" : ""}`}
            onClick={() => setActiveTab("topPhim")}
          >
            <Award size={16} /> Top 3 Phim (DENSE_RANK)
          </button>
          <button
            className={`tab-btn ${activeTab === "doanhThuThang" ? "active" : ""}`}
            onClick={() => setActiveTab("doanhThuThang")}
          >
            <TrendingUp size={16} /> Doanh Thu & Lũy Kế (LAG / SUM)
          </button>
          <button
            className={`tab-btn ${activeTab === "ngay" ? "active" : ""}`}
            onClick={() => setActiveTab("ngay")}
          >
            <FileText size={16} /> Doanh thu 30 ngày
          </button>
          <button
            className={`tab-btn ${activeTab === "lapDayPhong" ? "active" : ""}`}
            onClick={() => setActiveTab("lapDayPhong")}
          >
            <Users size={16} /> Tỷ Lệ Lấp Đầy (RANK OVER)
          </button>
        </div>
      </div>
      {error && <p className="error-alert" role="alert">Không tải được báo cáo: {error}</p>}
      <div className="report-kpis" aria-label="Chỉ số tổng quan">
        {[
          ["Doanh thu 30 ngày", dailyData.length ? vnd(dailyData.reduce((sum, x) => sum + Number(x.doanh_thu || 0), 0)) : "—"],
          ["Doanh thu tháng hiện tại", trendData.length ? vnd(trendData.at(-1).doanh_thu) : "—"],
          ["Suất chiếu trong báo cáo", !loading && !error ? occupancyData.length : "—"],
          ["Tỷ lệ lấp đầy theo số ghế", occupancyData.some(x => x.tong_ghe > 0) ? `${(100 * occupancyData.reduce((sum,x)=>sum + Number(x.so_ve || 0),0) / occupancyData.reduce((sum,x)=>sum + Number(x.tong_ghe || 0),0)).toFixed(1)}%` : "—"],
        ].map(([label, value]) => <div className="panel report-kpi" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}
      </div>

      {/* Tab 1: Top 3 Movies */}
      {activeTab === "topPhim" && (
        <div className="report-card panel">
          <div className="report-header">
            <div>
              <h3>Top 3 Phim Doanh Thu Cao Nhất Mỗi Tháng</h3>
              <p className="muted">Sử dụng Chained CTEs và Window Function <code>DENSE_RANK() OVER (PARTITION BY thang ORDER BY doanh_thu DESC)</code></p>
            </div>
            <button
              className="btn-sql-inspect"
              onClick={() => setSqlModal(SQL_QUERIES.topPhim)}
            >
              <Code size={16} /> Xem câu lệnh SQL (Oracle 23ai)
            </button>
          </div>

          <div className="chart-box" style={{ height: 280 }}>
            {topPhimData.length > 0 ? (
              <Bar data={topMoviesChartData} options={chartOptions} />
            ) : (
              <p className="muted text-center py-8">{loading ? "Đang tải dữ liệu báo cáo từ Oracle…" : "Không có doanh thu vé phù hợp."}</p>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Hạng (DENSE_RANK)</th>
                  <th>Mã Phim</th>
                  <th>Tên Phim</th>
                  <th>Doanh Thu Vé Thực Tế</th>
                </tr>
              </thead>
              <tbody>
                {topPhimData.map((row, i) => (
                  <tr key={i} className={row.hang === 1 ? "top-rank-1" : ""}>
                    <td><strong className="code-font">{row.thang}</strong></td>
                    <td>
                      <span className={`rank-badge rank-${row.hang}`}>
                        {row.hang === 1 ? "🥇 Hạng 1" : row.hang === 2 ? "🥈 Hạng 2" : "🥉 Hạng 3"}
                      </span>
                    </td>
                    <td className="code-font">#{row.ma_phim}</td>
                    <td><strong>{row.ten_phim}</strong></td>
                    <td><strong className="text-orange">{vnd(row.doanh_thu)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Monthly Trend & Cumulative */}
      {activeTab === "doanhThuThang" && (
        <div className="report-card panel">
          <div className="report-header">
            <div>
              <h3>Doanh Thu Theo Tháng, Lũy Kế & Tăng Trưởng (%)</h3>
              <p className="muted">Áp dụng <code>SUM() OVER (ROWS UNBOUNDED PRECEDING)</code> và <code>LAG() OVER (ORDER BY thang)</code></p>
            </div>
            <button
              className="btn-sql-inspect"
              onClick={() => setSqlModal(SQL_QUERIES.doanhThuThang)}
            >
              <Code size={16} /> Xem câu lệnh SQL (Oracle 23ai)
            </button>
          </div>

          <div className="chart-box" style={{ height: 280 }}>
            {trendData.length > 0 ? (
              <Bar data={trendChartData} options={chartOptions} />
            ) : (
              <p className="muted text-center py-8">{loading ? "Đang tải dữ liệu xu hướng…" : "Không có dữ liệu xu hướng."}</p>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Doanh Thu Tháng</th>
                  <th>Doanh Thu Tháng Trước (LAG)</th>
                  <th>Tăng Trưởng (%)</th>
                  <th>Lũy Kế (SUM OVER)</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((row, i) => (
                  <tr key={i}>
                    <td><strong className="code-font">{row.thang}</strong></td>
                    <td><strong className="text-orange">{vnd(row.doanh_thu)}</strong></td>
                    <td>{row.thang_truoc != null ? vnd(row.thang_truoc) : <span className="muted">Kỳ gốc (—)</span>}</td>
                    <td>
                      {row.tang_truong_pct != null ? (
                        <span className={`growth-pill ${row.tang_truong_pct >= 0 ? "positive" : "negative"}`}>
                          {row.tang_truong_pct >= 0 ? `+${row.tang_truong_pct}%` : `${row.tang_truong_pct}%`}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td><strong>{vnd(row.luy_ke)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "ngay" && <div className="report-card panel">
        <div className="report-header">
          <div><h3>Doanh thu 30 ngày gần nhất</h3><p className="muted">Recursive CTE, gồm cả ngày không phát sinh doanh thu.</p></div>
          <button className="btn-sql-inspect" onClick={() => setSqlModal(SQL_QUERIES.ngay)}><Code size={16} /> Xem câu lệnh SQL (Oracle 23ai)</button>
        </div>
        <div className="chart-box" style={{ height: 280 }}>
          {dailyData.length > 0 ? <Line options={chartOptions} data={{ labels: dailyData.map(x => x.ngay.slice(0, 10)), datasets: [{ label: "Doanh thu (VNĐ)", data: dailyData.map(x => x.doanh_thu), borderColor: "#F58020", tension: .2 }] }} /> : <p className="muted text-center py-8">{loading ? "Đang đọc lịch doanh thu…" : "Không có dữ liệu doanh thu theo ngày."}</p>}
        </div>
        <div className="table-wrap"><table><thead><tr><th>Ngày chiếu</th><th>Doanh thu</th></tr></thead>
          <tbody>{dailyData.map(row => <tr key={row.ngay}><td>{row.ngay.slice(0, 10)}</td><td>{vnd(row.doanh_thu)}</td></tr>)}</tbody></table></div>
      </div>}

      {/* Tab 3: Occupancy Rate */}
      {activeTab === "lapDayPhong" && (
        <div className="report-card panel">
          <div className="report-header">
            <div>
              <h3>Tỷ Lệ Lấp Đầy Phòng Chiếu & Xếp Hạng Từng Rạp</h3>
              <p className="muted">Xếp hạng nội bộ từng rạp với <code>RANK() OVER (PARTITION BY r.ma_rap ORDER BY ty_le_lap_day DESC)</code></p>
            </div>
            <button
              className="btn-sql-inspect"
              onClick={() => setSqlModal(SQL_QUERIES.lapDayPhong)}
            >
              <Code size={16} /> Xem câu lệnh SQL (Oracle 23ai)
            </button>
          </div>

          <div className="chart-box" style={{ height: 280 }}>
            {occupancyData.length > 0 ? (
              <Bar data={occupancyChartData} options={chartOptions} />
            ) : (
              <p className="muted text-center py-8">{loading ? "Đang tải tỷ lệ lấp đầy…" : "Không có suất chiếu phù hợp."}</p>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cụm Rạp</th>
                  <th>Phòng Chiếu</th>
                  <th>Hạng Trong Rạp</th>
                  <th>Phim</th>
                  <th>Giờ Chiếu</th>
                  <th>Số Vé Bán / Tổng Ghế</th>
                  <th>Tỷ Lệ Lấp Đầy</th>
                </tr>
              </thead>
              <tbody>
                {occupancyData.map((row, i) => (
                  <tr key={i}>
                    <td><strong>{row.ten_rap}</strong></td>
                    <td>{row.ten_phong}</td>
                    <td>
                      <span className="rank-badge rank-sub">Hạng {row.hang_trong_rap}</span>
                    </td>
                    <td>{row.ten_phim}</td>
                    <td className="code-font">{row.gio_chieu}</td>
                    <td>{row.so_ve} / {row.tong_ghe} vé</td>
                    <td>
                      <div className="occupancy-cell">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${Math.min(100, row.ty_le_lap_day)}%`,
                              backgroundColor: row.ty_le_lap_day >= 80 ? "#10B981" : row.ty_le_lap_day >= 60 ? "#F58020" : "#034EA2"
                            }}
                          />
                        </div>
                        <strong>{row.ty_le_lap_day}%</strong>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SQL Inspection Modal */}
      {sqlModal && (
        <div className="modal-backdrop" onClick={() => setSqlModal(null)}>
          <div className="sql-modal-card" role="dialog" aria-modal="true" aria-label={sqlModal.title} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") setSqlModal(null); }}>
            <div className="sql-modal-header">
              <div className="sql-modal-title">
                <Code className="text-orange" size={20} />
                <h3>{sqlModal.title}</h3>
              </div>
              <button className="icon-btn-close" aria-label="Đóng câu lệnh SQL" autoFocus onClick={() => setSqlModal(null)}>×</button>
            </div>
            <p className="sql-modal-desc">{sqlModal.description}</p>
            
            <div className="sql-code-container">
              <div className="sql-code-bar">
                <span>Oracle SQL (23ai Native)</span>
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={() => copySql(sqlModal.sql)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã sao chép!" : "Sao chép SQL"}
                </button>
              </div>
              <pre className="sql-pre"><code>{sqlModal.sql}</code></pre>
            </div>

            <div className="sql-modal-footer">
              <p className="muted text-sm">
                💡 <em>Ghi chú chấm điểm:</em> Các câu lệnh trên khai thác trực tiếp tính năng Common Table Expression (CTE) và Window Functions của Oracle 23ai, giúp tránh lặp lại quét bảng (Full Table Scan) và tối ưu hóa chi phí thực thi (Buffer Gets).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

