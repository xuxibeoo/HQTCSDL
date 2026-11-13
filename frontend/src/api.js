// Event emitter for Live Oracle 23ai Inspector
const inspectorListeners = new Set();

export function onInspectorEvent(listener) {
  inspectorListeners.add(listener);
  return () => inspectorListeners.delete(listener);
}

function notifyInspector(event) {
  inspectorListeners.forEach(listener => {
    try {
      listener(event);
    } catch (e) {
      console.error(e);
    }
  });
}

// PLSQL Mapping inference helper
const ENDPOINT_PLSQL_MAP = {
  "/tinh-tien-tam": "PKG_DAT_VE.FN_TINH_GIA_VE + FN_TINH_GIAM",
  "/bao-cao/doanh-thu-30-ngay": "Recursive CTE LICH_NGAY",
  "/bao-cao/top-phim-thang": "CTE + DENSE_RANK() OVER",
  "/bao-cao/xu-huong-thang": "CONNECT BY + SUM() OVER + LAG() OVER",
  "/bao-cao/ty-le-lap-day": "CTE + RANK() OVER",
  "/lab/them-suat-chieu": "TRG_SUAT_CHIEU_KHONG_TRUNG",
  "/lab/ep-chuyen-trang-thai-ve": "TRG_VE_CHUYEN_TRANG_THAI",
  "/lab/gia-lap-het-han/": "DON_DAT_VE.HAN_THANH_TOAN",
  "/lab/giai-phong-ghe-het-han": "PKG_DAT_VE.SP_GIAI_PHONG_HET_HAN",
  "/lab/nhat-ky-ve": "NHAT_KY_VE (TRG_VE_NHAT_KY)",
  "/lab/execution-plan": "DBMS_XPLAN.DISPLAY_CURSOR",
  "/dat-ve/giu-cho": "PKG_DAT_VE.SP_GIU_CHO (Savepoint hold_start)",
  "/don-dat-ve": "PKG_DAT_VE.SP_GIU_CHO (Savepoint hold_start)",
  "/dat-ve/thanh-toan": "PKG_DAT_VE.SP_THANH_TOAN (Savepoint payment_start)",
  "/ve/huy": "PKG_DAT_VE.SP_HUY_VE (Savepoint refund_start)",
  "/soat-ve/quet-qr": "PKG_DAT_VE.SP_SOAT_VE (Lock ve for update)",
  "/soat-ve": "PKG_DAT_VE.SP_SOAT_VE (Lock ve for update)",
  "/suat-chieu": "VIEW V_LICH_CHIEU (s.gio_bat_dau > NOW)",
  "/so-do-ghe": "VIEW V_SO_DO_GHE (Left join ve)",
  "/ghe": "VIEW V_SO_DO_GHE (Left join ve)",
  "/analytics/top-phim": "CTE dt_phim_thang + DENSE_RANK() OVER (PARTITION BY thang)",
  "/analytics/doanh-thu-thang": "CTE dt_thang + SUM() OVER + LAG() OVER",
  "/analytics/lap-day-phong": "CTE so_ghe + RANK() OVER (PARTITION BY r.ma_rap)",
  "/lab/test-trigger-lich": "COMPOUND TRIGGER TRG_SUAT_CHIEU_KHONG_TRUNG",
  "/lab/test-trigger-trang-thai": "TRIGGER TRG_VE_CHUYEN_TRANG_THAI (State Machine)",
  "/lab/test-giai-phong-het-han": "EXPLICIT CURSOR (FOR UPDATE SKIP LOCKED) + WHERE CURRENT OF",
  "/lab/audit-log": "TABLE NHAT_KY_VE (TRG_VE_NHAT_KY)",
};

function inferPlsql(path, method) {
  if (/^\/suat-chieu\/\d+\/(?:ghe|so-do-ghe)$/.test(path)) return "V_SO_DO_GHE + PKG_DAT_VE.FN_TINH_GIA_VE";
  if (/^\/don-dat-ve\/\d+\/thanh-toan$/.test(path)) return "PKG_DAT_VE.SP_THANH_TOAN";
  if (/^\/ve\/\d+\/huy$/.test(path)) return "PKG_DAT_VE.SP_HUY_VE";
  if (/^\/khach-hang\/\d+\/(?:lich-su|don-dat-ve)$/.test(path)) return "DON_DAT_VE + VE + FN_DUOC_HUY_VE";
  if (method === "GET" && /^\/(?:dat-ve|don-dat-ve)\/\d+$/.test(path)) return "DON_DAT_VE + VE";
  for (const [key, val] of Object.entries(ENDPOINT_PLSQL_MAP)) {
    if (path.includes(key)) return val;
  }
  return "SELECT / PLSQL OBJECT";
}

export async function api(path, token, options = {}) {
  const method = options.method || (options.body ? "POST" : "GET");
  const startTime = performance.now();
  const plsqlObject = inferPlsql(path, method);
  // Never expose passwords, QR payloads or external payment reference values in the dock.
  const payload = options.body && !path.startsWith("/auth/") ? Object.fromEntries(
    Object.entries(options.body).map(([key, value]) => [key, /password|mat_khau|ma_qr|ma_gd_ngoai|ma_giao_dich_ngoai/i.test(key) ? "[ẩn]" : value])
  ) : null;

  try {
    const response = await fetch("/api" + path, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        "Content-Type": "application/json"
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const elapsed = response.headers.get("X-Cinema-Elapsed-Ms");
    const duration = elapsed != null && Number.isFinite(Number(elapsed)) ? Number(elapsed) : Math.round(performance.now() - startTime);
    const source = response.headers.get("X-Cinema-Oracle-Object") || plsqlObject;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail ?? data;
      const oraCode = detail.ora_code || (detail.code ? parseInt(String(detail.code).replace("ORA-", ""), 10) : null);
      const codeStr = detail.code || (oraCode ? `ORA-${String(Math.abs(oraCode)).padStart(5, "0")}` : `HTTP ${response.status}`);
      const message = detail.message || (typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join("; ") : `Lỗi yêu cầu (${response.status})`);
      const plsql = detail.plsql_source || detail.plsql_object || source;

      notifyInspector({
        time: new Date().toLocaleTimeString("vi-VN"),
        path,
        method,
        plsql,
        status: response.status,
        txStatus: codeStr,
        duration: `${duration} ms`,
        payload,
        error: message,
        isError: true,
      });

      const err = new Error(codeStr ? `${codeStr}: ${message}` : message);
      err.ora_code = oraCode;
      err.code = codeStr;
      err.clean_message = message;
      err.plsql_object = plsql;
      err.status = response.status;
      throw err;
    }

    notifyInspector({
      time: new Date().toLocaleTimeString("vi-VN"),
      path,
      method,
      plsql: source,
      status: response.status,
      txStatus: response.headers.get("X-Cinema-Transaction") || `HTTP ${response.status}`,
      duration: `${duration} ms`,
      payload,
      isError: false,
    });

    return data;
  } catch (error) {
    if (!error.status) {
      const duration = Math.round(performance.now() - startTime);
      notifyInspector({
        time: new Date().toLocaleTimeString("vi-VN"),
        path,
        method,
        plsql: plsqlObject,
        status: 500,
        txStatus: "NETWORK_ERROR",
        duration: `${duration} ms`,
        payload,
        error: error.message,
        isError: true,
      });
    }
    throw error;
  }
}

export const vnd = n => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n || 0);
export const dateLabel = x => x ? x.slice(0, 10).split("-").reverse().join("/") : "";
export const clock = x => x ? x.slice(11, 16) : "";

export const roles = {
  CUSTOMER: "Khách hàng 1 (Nguyễn Văn A)",
  CUSTOMER_1: "Khách hàng 1 (Nguyễn Văn A - G-Star Bạc)",
  CUSTOMER_2: "Khách hàng 2 (Trần Thị B - G-Star Thường)",
  CASHIER: "Thu ngân POS",
  USHER: "Nhân viên Soát vé",
  CINEMA_MANAGER: "Quản lý rạp",
  IT_ADMIN: "Kỹ thuật IT / Quản trị",
  PROGRAMMING: "Bộ phận chương trình",
  EXECUTIVE: "Ban Giám đốc",
  ACCOUNTING: "Kế toán / Đối soát",
  MARKETING: "Marketing / Ưu đãi"
};
