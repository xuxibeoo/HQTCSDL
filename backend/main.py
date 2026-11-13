from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
from time import perf_counter

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import AliasChoices, BaseModel, Field

import db
from demo_schedule import prepare_demo_schedule, read_demo_scenarios

CUSTOMER = "ROLE_CUSTOMER"
CASHIER = "ROLE_CASHIER"
MANAGER = "ROLE_CINEMA_MANAGER"
SUPPORT = "ROLE_CUSTOMER_SUPPORT"
USHER = "ROLE_USHER"
IT = "ROLE_IT_ADMIN"
ROLES = ("CUSTOMER", "EXECUTIVE", "PROGRAMMING", "CINEMA_MANAGER", "CASHIER",
         "USHER", "CUSTOMER_SUPPORT", "MARKETING", "ACCOUNTING", "IT_ADMIN",
         "CUSTOMER_1", "CUSTOMER_2", "CUSTOMER_3")

@asynccontextmanager
async def lifespan(app):
    db.init()
    try:
        if db.DEMO:
            app.state.demo_schedule = prepare_demo_schedule()
        yield
    finally:
        if db.pool:
            db.pool.close(force=True)

app = FastAPI(title="HUFLIT Galaxy Cinema - Oracle 23ai", lifespan=lifespan)
security = HTTPBearer(auto_error=False)
TELEMETRY = ["X-Cinema-Oracle-Object", "X-Cinema-Elapsed-Ms", "X-Cinema-Transaction"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv(
        "CINEMA_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080",
    ).split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=TELEMETRY,
)
ORACLE_OBJECTS = {
    "catalog": "PHIM, THE_LOAI, RAP, COMBO",
    "movies": "PHIM, PHIM_THE_LOAI, THE_LOAI",
    "sites": "RAP", "combos": "COMBO", "promotions": "KHUYEN_MAI",
    "demo_customers": "KHACH_HANG",
    "showtimes": "V_LICH_CHIEU", "seat_map": "V_SO_DO_GHE, PKG_DAT_VE.FN_TINH_GIA_VE",
    "estimate": "PKG_DAT_VE.FN_TINH_GIA_VE, PKG_DAT_VE.FN_TINH_GIAM",
    "hold": "PKG_DAT_VE.SP_GIU_CHO", "pay": "PKG_DAT_VE.SP_THANH_TOAN",
    "cancel": "PKG_DAT_VE.SP_HUY_VE", "scan": "PKG_DAT_VE.SP_SOAT_VE",
    "history": "DON_DAT_VE, VE, PKG_DAT_VE.FN_DUOC_HUY_VE",
    "get_order": "DON_DAT_VE, VE", "issued_tickets": "VE, SUAT_CHIEU",
    "report_top_phim": "CTE, DENSE_RANK", "report_doanh_thu_thang": "CONNECT BY, SUM OVER, LAG",
    "report_doanh_thu_ngay": "RECURSIVE CTE LICH_NGAY",
    "report_lap_day_phong": "CTE, RANK", "lab_test_trigger_lich": "TRG_SUAT_CHIEU_KHONG_TRUNG",
    "lab_test_trigger_trang_thai": "TRG_VE_CHUYEN_TRANG_THAI",
    "lab_expire_order": "DON_DAT_VE.HAN_THANH_TOAN",
    "lab_test_giai_phong_het_han": "PKG_DAT_VE.SP_GIAI_PHONG_HET_HAN",
    "lab_audit_log": "NHAT_KY_VE, TRG_VE_NHAT_KY",
    "benchmark": "DBMS_XPLAN.DISPLAY_CURSOR",
}

@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    detail = exc.detail
    body = {"detail": detail}
    if isinstance(detail, dict) and "http_status" in detail:
        body.update(detail)
        request.state.oracle_object = detail.get("plsql_source")
        request.state.oracle_code = detail.get("code")
    return JSONResponse(body, status_code=exc.status_code, headers=exc.headers)

@app.middleware("http")
async def trace_oracle(request: Request, call_next):
    started = perf_counter()
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        endpoint = request.scope.get("endpoint")
        source = getattr(request.state, "oracle_object", None) or ORACLE_OBJECTS.get(
            getattr(endpoint, "__name__", ""), "ORACLE API"
        )
        response.headers[TELEMETRY[0]] = source
        response.headers[TELEMETRY[1]] = f"{(perf_counter() - started) * 1000:.2f}"
        response.headers[TELEMETRY[2]] = getattr(request.state, "oracle_code", None) or f"HTTP {response.status_code}"
    return response

def current(token: HTTPAuthorizationCredentials | None = Depends(security)):
    if token:
        try:
            return jwt.decode(token.credentials, db.JWT_SECRET, algorithms=["HS256"], options={"require": ["exp", "sub"]})
        except jwt.InvalidTokenError:
            pass
    raise HTTPException(401, "Vui lòng đăng nhập.")

def permit(*roles):
    def allowed(actor=Depends(current)):
        if actor["role"] not in roles:
            raise HTTPException(403, "Vai trò này không có quyền thao tác.")
        return actor
    return allowed


@app.get("/api/demo/scenarios")
def demo_scenarios():
    if not db.DEMO:
        raise HTTPException(404)
    return read_demo_scenarios()


@app.post("/api/admin/prepare-demo")
def prepare_student_demo(actor=Depends(permit(IT))):
    if not db.DEMO:
        raise HTTPException(404)
    return prepare_demo_schedule()

def session(account):
    account.pop("mat_khau_hash", None)
    claims = {**account, "sub": account["email"], "exp": datetime.now(timezone.utc) + timedelta(hours=4)}
    return {"token": jwt.encode(claims, db.JWT_SECRET, algorithm="HS256"), "user": account}

def lookup(cur, email):
    email = email.strip().lower()
    return db.one(cur, """select ma_kh id, email, ho_ten, hang_thanh_vien, diem_tich_luy, mat_khau_hash,
        'ROLE_CUSTOMER' role, null ma_rap from khach_hang where lower(email)=:email""", email=email)

DEMO_EMAILS = tuple(f"khach{i}@cinema.test" for i in range(1, 4))
DEMO_STAFF = {
    "EXECUTIVE": "Ban giám đốc", "PROGRAMMING": "Bộ phận chương trình",
    "CINEMA_MANAGER": "Quản lý rạp", "CASHIER": "Thu ngân", "USHER": "Nhân viên soát vé",
    "CUSTOMER_SUPPORT": "Chăm sóc khách hàng", "MARKETING": "Marketing",
    "ACCOUNTING": "Kế toán", "IT_ADMIN": "Kỹ thuật IT",
}

class Login(BaseModel):
    email: str = Field(max_length=160)
    password: str = Field(max_length=128)

@app.get("/api/health")
def health():
    with db.connection() as con, con.cursor() as cur:
        owner = db.one(cur, "select user as owner from dual")["owner"]
        return {
            "status": "ok",
            "oracle": con.version,
            "schema": owner,
            "demo": db.DEMO,
            "engine": "ORACLE_23AI_LIVE",
        }

@app.post("/api/auth/login")
def login(form: Login):
    with db.connection() as con, con.cursor() as cur:
        try:
            account = lookup(cur, form.email.strip().lower())
        except HTTPException:
            raise HTTPException(401, "Email hoặc mật khẩu không đúng.")
        if not db.verify(form.password, account["mat_khau_hash"]):
            raise HTTPException(401, "Email hoặc mật khẩu không đúng.")
        return session(account)

@app.post("/api/auth/demo/{role}")
def demo_login(role: str):
    if not db.DEMO:
        raise HTTPException(404)
    if role == "CUSTOMER":
        role = "CUSTOMER_1"
    if role in ("CUSTOMER_1", "CUSTOMER_2", "CUSTOMER_3"):
        with db.connection() as con, con.cursor() as cur:
            return session(lookup(cur, DEMO_EMAILS[int(role[-1]) - 1]))
    if role in DEMO_STAFF:
        # Staff demo identities are isolated from the report's 16 physical tables.
        return session({
            "id": ROLES.index(role), "email": role.lower() + "@cinema.test",
            "ho_ten": DEMO_STAFF[role], "role": "ROLE_" + role,
            "ma_rap": 1 if role in ("CINEMA_MANAGER", "CASHIER", "USHER") else None,
        })
    raise HTTPException(404, "Vai trò demo không tồn tại.")

@app.get("/api/khach-hang")
def demo_customers():
    if not db.DEMO:
        raise HTTPException(404)
    with db.connection() as con, con.cursor() as cur:
        result = db.rows(cur, """select ma_kh,ho_ten,hang_thanh_vien,diem_tich_luy,email
            from khach_hang where email in (:a,:b,:c) order by ma_kh""",
            a=DEMO_EMAILS[0], b=DEMO_EMAILS[1], c=DEMO_EMAILS[2])
        for row in result:
            row["demo_role"] = f"CUSTOMER_{DEMO_EMAILS.index(row.pop('email'))+1}"
        return result

MOVIES_SQL = """select p.*,
    case when ngay_khoi_chieu<=trunc(sysdate) then 1 else 0 end dang_chieu,
    (select listagg(t.ten_the_loai, ', ') within group (order by t.ten_the_loai)
      from phim_the_loai pt join the_loai t on t.ma_the_loai=pt.ma_the_loai
      where pt.ma_phim=p.ma_phim) the_loai
    from phim p order by p.ma_phim"""
COMBOS_SQL = "select ma_combo,ten_combo,gia,gia don_gia from combo order by ma_combo"
SITES_SQL = "select ma_rap,ten_rap,dia_chi from rap order by ma_rap"

def film_data(cur):
    films = db.rows(cur, MOVIES_SQL)
    for film in films:
        film["anh"] = f"/poster/{film['ma_phim']}.svg"
    return films

@app.get("/api/phim")
def movies():
    with db.connection() as con, con.cursor() as cur:
        return film_data(cur)

@app.get("/api/rap")
def sites():
    with db.connection() as con, con.cursor() as cur:
        return db.rows(cur, SITES_SQL)

@app.get("/api/combo")
def combos():
    with db.connection() as con, con.cursor() as cur:
        return db.rows(cur, COMBOS_SQL)

@app.get("/api/khuyen-mai")
def promotions():
    with db.connection() as con, con.cursor() as cur:
        return db.rows(cur, f"""select ma_code,loai_giam,gia_tri,giam_toi_da,ngay_bat_dau,ngay_ket_thuc,
            greatest(0,so_luot_toi_da-so_luot_da_dung) so_luot_con_lai,
            case when {db.NOW} between ngay_bat_dau and ngay_ket_thuc
              and so_luot_da_dung<so_luot_toi_da then 1 else 0 end kha_dung
            from khuyen_mai order by ma_code""")

@app.get("/api/catalog")
def catalog():
    with db.connection() as con, con.cursor() as cur:
        return {
            "phim": film_data(cur),
            "rap": db.rows(cur, SITES_SQL),
            "combo": db.rows(cur, COMBOS_SQL),
            "the_loai": db.rows(cur, "select ma_the_loai,ten_the_loai,1 cap from the_loai order by ten_the_loai"),
        }

@app.get("/api/suat-chieu")
def showtimes(
    ma_phim: int | None = None,
    ma_rap: int | None = None,
    dinh_dang: str | None = None,
    ngay: date | None = None
):
    with db.connection() as con, con.cursor() as cur:
        return db.rows(cur, f"""select s.* from v_lich_chieu s
            where s.gio_bat_dau<{db.NOW}+interval '30' day
            and (:film is null or s.ma_phim=:film)
            and (:site is null or s.ma_rap=:site)
            and (:fmt is null or s.dinh_dang=:fmt)
            and (:day is null or trunc(s.gio_bat_dau)=:day)
            order by s.gio_bat_dau,s.ma_suat""", film=ma_phim, site=ma_rap, fmt=dinh_dang, day=ngay)

@app.get("/api/top")
def top_movies():
    with db.connection() as con, con.cursor() as cur:
        return db.rows(cur, f"""with totals as (
          select trunc(s.gio_bat_dau,'MM') thang,s.ma_phim,sum(v.gia_ve) doanh_thu
          from ve v join suat_chieu s on s.ma_suat=v.ma_suat
          where v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG') and s.gio_bat_dau<={db.NOW}
          group by trunc(s.gio_bat_dau,'MM'),s.ma_phim
        ), ranked as (
          select totals.*,dense_rank() over(partition by thang order by doanh_thu desc) hang from totals
        )
        select * from ranked where thang=(select max(thang) from totals)
        order by hang,ma_phim fetch first 10 rows only""")

def expire(con, cur):
    cur.callproc("pkg_dat_ve.sp_giai_phong_het_han")
    con.commit()

@app.get("/api/suat-chieu/{id}/so-do-ghe")
@app.get("/api/suat-chieu/{id}/ghe")
def seat_map(id: int):
    with db.connection(source="V_SO_DO_GHE") as con, con.cursor() as cur:
        db.one(cur, "select ma_suat from suat_chieu where ma_suat=:id", id=id)
        return db.rows(cur, """select ma_ghe,hang,so_ghe,ten_loai,phu_thu,gia_ve,trang_thai,tinh_trang
            from v_so_do_ghe where ma_suat=:id order by hang,so_ghe""", id=id)

class ComboLine(BaseModel):
    ma_combo: int = Field(gt=0)
    so_luong: int = Field(ge=1, le=8)

class Hold(BaseModel):
    ma_suat: int = Field(gt=0)
    ds_ghe: list[int] = Field(min_length=1, max_length=8)
    ma_code: str | None = Field(default=None, max_length=30)
    ma_kh: int | None = Field(default=None, gt=0)
    ma_combo: int | None = Field(default=None, gt=0)
    so_luong_combo: int = Field(default=1, ge=1, le=8)
    ds_combo: list[ComboLine] = Field(default_factory=list, max_length=8)

def combo_lines(cur, form):
    items = form.ds_combo
    if form.ma_combo:
        if items:
            raise HTTPException(422, "Chỉ dùng một định dạng danh sách combo.")
        items = [ComboLine(ma_combo=form.ma_combo, so_luong=form.so_luong_combo)]
    if len({item.ma_combo for item in items}) != len(items):
        raise HTTPException(422, "Không nhập trùng mã combo.")
    return [
        (item.ma_combo, item.so_luong, db.one(
            cur, "select gia from combo where ma_combo=:id", id=item.ma_combo
        )["gia"])
        for item in items
    ]

def promo_code(form):
    return (form.ma_code or "").strip().upper() or None

@app.post("/api/tinh-tien-tam")
def estimate(form: Hold):
    with db.connection(source="PKG_DAT_VE.FN_TINH_GIA_VE") as con, con.cursor() as cur:
        if len(set(form.ds_ghe)) != len(form.ds_ghe) or any(id <= 0 for id in form.ds_ghe):
            raise db.business_error(20022, "PKG_DAT_VE.FN_TINH_GIA_VE")
        view = db.one(cur, "select ma_suat from v_lich_chieu where ma_suat=:id", id=form.ma_suat)
        gross = sum(cur.callfunc("pkg_dat_ve.fn_tinh_gia_ve", int, [view["ma_suat"], id]) for id in form.ds_ghe)
        snacks = sum(qty * price for _, qty, price in combo_lines(cur, form))
        try:
            discount = cur.callfunc("pkg_dat_ve.fn_tinh_giam", int, [promo_code(form), gross])
        except db.oracledb.DatabaseError as exc:
            if exc.args[0].code == 20026:
                raise db.business_error(20026, "PKG_DAT_VE.FN_TINH_GIAM") from exc
            raise
        return {"tong_ve": gross, "tong_combo": snacks, "tong_tien": gross + snacks,
                "tien_giam": discount, "thuc_tra": gross + snacks - discount}

def site_of_show(cur, id):
    return db.one(cur, "select p.ma_rap from suat_chieu s join phong_chieu p on p.ma_phong=s.ma_phong where s.ma_suat=:id", id=id)["ma_rap"]

def check_site(actor, site):
    if actor.get("ma_rap") and actor["ma_rap"] != site:
        raise HTTPException(403, "Suất chiếu nằm ngoài cụm rạp được giao.")

def order_tickets(cur, id):
    return db.rows(cur, """select v.*, g.hang,g.so_ghe,s.gio_bat_dau,f.ten_phim,p.ten_phong,
        case when v.trang_thai='DA_THANH_TOAN' then pkg_dat_ve.fn_duoc_huy_ve(v.ma_ve) else 0 end duoc_huy
        from ve v join ghe g on g.ma_ghe=v.ma_ghe join suat_chieu s on s.ma_suat=v.ma_suat
        join phim f on f.ma_phim=s.ma_phim join phong_chieu p on p.ma_phong=s.ma_phong
        where v.ma_don=:id order by v.ma_ve""", id=id)

def order_data(cur, id, order=None):
    if order is None:
        order = db.one(cur, "select * from don_dat_ve where ma_don=:id", id=id)
    order["tickets"] = order_tickets(cur, id)
    order["thuc_tra"] = order["tong_tien"] - order["tien_giam"]
    if order["han_thanh_toan"].tzinfo is None:
        order["han_thanh_toan"] = order["han_thanh_toan"].replace(tzinfo=db.VIETNAM)
    return order

def order_access(cur, actor, order):
    if actor["role"] == CUSTOMER and order["ma_kh"] != actor["id"]:
        raise HTTPException(403, "Đơn đặt vé thuộc tài khoản khác.")
    if actor.get("ma_rap") and order["tickets"]:
        check_site(actor, site_of_show(cur, order["tickets"][0]["ma_suat"]))

@app.post("/api/dat-ve/giu-cho")
@app.post("/api/don-dat-ve")
def hold(form: Hold, actor=Depends(permit(CUSTOMER, CASHIER, SUPPORT))):
    with db.connection(actor["email"], "PKG_DAT_VE.SP_GIU_CHO") as con, con.cursor() as cur:
        expire(con, cur)
        if actor.get("ma_rap"):
            check_site(actor, site_of_show(cur, form.ma_suat))
        customer = actor["id"] if actor["role"] == CUSTOMER else form.ma_kh
        if not customer:
            raise HTTPException(422, "Chọn khách hàng cho đơn tại quầy.")
        lines = combo_lines(cur, form)
        result = cur.var(int)
        cur.callproc("pkg_dat_ve.sp_giu_cho", [
            customer, form.ma_suat, json.dumps(form.ds_ghe), promo_code(form), result
        ])
        order_id = db.out_value(result)
        if lines:
            cur.executemany("insert into don_combo(ma_don,ma_combo,so_luong,don_gia) values(:1,:2,:3,:4)",
                            [(order_id, id, qty, price) for id, qty, price in lines])
            cur.execute("update don_dat_ve set tong_tien=tong_tien+:snacks where ma_don=:id",
                        snacks=sum(qty*price for _,qty,price in lines), id=order_id)
        result_data = order_data(cur, order_id)
        con.commit()
        return result_data

class Payment(BaseModel):
    ma_don: int | None = None
    ma_gd_ngoai: str = Field(min_length=1, max_length=64,
                            validation_alias=AliasChoices("ma_giao_dich_ngoai", "ma_gd_ngoai"))
    phuong_thuc: str = Field(pattern="^(THE|VI_DIEN_TU|CHUYEN_KHOAN)$")

@app.post("/api/dat-ve/thanh-toan")
@app.post("/api/don-dat-ve/{id}/thanh-toan")
def pay(form: Payment, id: int | None = None, actor=Depends(permit(CUSTOMER, CASHIER))):
    target_order_id = id or form.ma_don
    if not target_order_id:
        raise HTTPException(400, "Thiếu mã đơn thanh toán.")
    with db.connection(actor["email"], "PKG_DAT_VE.SP_THANH_TOAN") as con, con.cursor() as cur:
        order_access(cur, actor, order_data(cur, target_order_id))
        cur.callproc("pkg_dat_ve.sp_thanh_toan", [target_order_id, form.phuong_thuc, form.ma_gd_ngoai.strip()])
        data = order_data(cur, target_order_id)
        data["diem_tich_luy"] = db.one(
            cur, "select diem_tich_luy from khach_hang where ma_kh=:id", id=data["ma_kh"]
        )["diem_tich_luy"]
        con.commit()
        return data

@app.get("/api/dat-ve/{id}")
@app.get("/api/don-dat-ve/{id}")
def get_order(id: int, actor=Depends(permit(CUSTOMER, CASHIER, SUPPORT, MANAGER))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        expire(con, cur)
        data = order_data(cur, id)
        order_access(cur, actor, data)
        return data

class Cancel(BaseModel):
    ma_ve: int | None = None
    ly_do: str = Field(default="Khách hủy vé trên Web", min_length=1, max_length=300)
    ngoai_le: bool = False

@app.post("/api/ve/huy")
@app.post("/api/ve/{id}/huy")
def cancel(form: Cancel | None = None, id: int | None = None, actor=Depends(permit(CUSTOMER, MANAGER))):
    target_ve_id = id or (form.ma_ve if form else None)
    if not target_ve_id:
        raise HTTPException(400, "Thiếu mã vé cần hủy.")
    with db.connection(actor["email"], "PKG_DAT_VE.SP_HUY_VE") as con, con.cursor() as cur:
        ticket = db.one(cur, "select ma_don,ma_suat from ve where ma_ve=:id", id=target_ve_id)
        order = order_data(cur, ticket["ma_don"])
        order_access(cur, actor, order)
        if form and form.ngoai_le:
            raise HTTPException(422, "Quy tắc BR-07 không hỗ trợ bỏ qua thời hạn hủy vé.")
        result = cur.var(int)
        cur.callproc("pkg_dat_ve.sp_huy_ve", [target_ve_id, result])
        refund = {"ma_ve": target_ve_id, "ma_don": ticket["ma_don"],
                  "so_tien_hoan": db.out_value(result),
                  "diem_tich_luy": db.one(cur, "select diem_tich_luy from khach_hang where ma_kh=:id",
                                         id=order["ma_kh"])["diem_tich_luy"]}
        con.commit()
        return refund

class Scan(BaseModel):
    ma_qr: str = Field(min_length=1, max_length=64)

SCAN_DETAILS = """select v.ma_qr,v.ma_ve,v.ma_don,v.trang_thai,v.gia_ve,
    g.hang,g.so_ghe,s.gio_bat_dau,f.ten_phim,p.ten_phong,p.ma_rap,d.ma_kh
    from ve v join ghe g on g.ma_ghe=v.ma_ghe join suat_chieu s on s.ma_suat=v.ma_suat
    join phim f on f.ma_phim=s.ma_phim join phong_chieu p on p.ma_phong=s.ma_phong
    join don_dat_ve d on d.ma_don=v.ma_don"""

@app.get("/api/soat-ve/ve-da-phat-hanh")
def issued_tickets(actor=Depends(permit(CUSTOMER, USHER, CASHIER, MANAGER, IT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return db.rows(cur, SCAN_DETAILS + """ where v.ma_qr is not null
            and v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')
            and (:customer is null or d.ma_kh=:customer)
            and (:site is null or p.ma_rap=:site)
            order by case when s.gio_ket_thuc>""" + db.NOW + """ then 0 else 1 end,
            v.ma_ve desc fetch first 20 rows only""",
            customer=actor["id"] if actor["role"] == CUSTOMER else None, site=actor.get("ma_rap"))

@app.post("/api/soat-ve/quet-qr")
@app.post("/api/soat-ve")
def scan(form: Scan, actor=Depends(permit(CUSTOMER, USHER, CASHIER, MANAGER, IT))):
    if actor["role"] == CUSTOMER and not db.DEMO:
        raise HTTPException(403, "Chỉ nhân viên được soát vé ngoài chế độ demo.")
    with db.connection(actor["email"], "PKG_DAT_VE.SP_SOAT_VE") as con, con.cursor() as cur:
        qr = form.ma_qr.strip()
        details = db.rows(cur, SCAN_DETAILS + " where v.ma_qr=:qr", qr=qr)
        if details:
            check_site(actor, details[0]["ma_rap"])
            if actor["role"] == CUSTOMER and details[0]["ma_kh"] != actor["id"]:
                raise HTTPException(403, "Chỉ được soát vé demo của tài khoản hiện tại.")
        result = cur.var(str, 30)
        cur.callproc("pkg_dat_ve.sp_soat_ve", [qr, result])
        details = db.rows(cur, SCAN_DETAILS + " where v.ma_qr=:qr", qr=qr)
        con.commit()
        return {"ket_qua": db.out_value(result), "ve": details[0] if details else None}

@app.get("/api/khach-hang/{id}/lich-su")
@app.get("/api/khach-hang/{id}/don-dat-ve")
def history(id: int, actor=Depends(permit(CUSTOMER, SUPPORT, CASHIER))):
    if actor["role"] == CUSTOMER and actor["id"] != id:
        raise HTTPException(403, "Chỉ được xem lịch sử của mình.")
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        expire(con, cur)
        customer = db.one(cur, "select ma_kh,ho_ten,hang_thanh_vien,diem_tich_luy from khach_hang where ma_kh=:id", id=id)
        orders = db.rows(cur, "select * from don_dat_ve where ma_kh=:id order by thoi_gian_dat desc fetch first 10 rows only", id=id)
        for o in orders:
            order_data(cur, o["ma_don"], o)
        return {"customer": customer, "orders": orders}

# ---------------------------------------------------------------------------
# Section 3.6 Advanced SQL Reports (CTE & Window Functions)
# ---------------------------------------------------------------------------
@app.get("/api/analytics/top-phim")
@app.get("/api/bao-cao/top-phim-thang")
def report_top_phim():
    """Top 3 Phim doanh thu cao nhất mỗi tháng (Chained CTEs & DENSE_RANK)"""
    with db.connection() as con, con.cursor() as cur:
        sql = """with dt_phim_thang as (
          select trunc(s.gio_bat_dau, 'MM') as thang, p.ma_phim, p.ten_phim, sum(v.gia_ve) as doanh_thu
          from ve v
          join suat_chieu s on s.ma_suat = v.ma_suat
          join phim p on p.ma_phim = s.ma_phim
          where v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')
          group by trunc(s.gio_bat_dau, 'MM'), p.ma_phim, p.ten_phim
        ), xep_hang as (
          select t.*, dense_rank() over (partition by thang order by doanh_thu desc) as hang
          from dt_phim_thang t
        )
        select to_char(thang, 'YYYY-MM') as thang, ma_phim, ten_phim, doanh_thu, hang
        from xep_hang where hang <= 3 order by thang desc, hang"""
        return db.rows(cur, sql)

@app.get("/api/analytics/doanh-thu-thang")
@app.get("/api/bao-cao/xu-huong-thang")
def report_doanh_thu_thang():
    """12 tháng liên tục, lũy kế và tăng trưởng."""
    with db.connection() as con, con.cursor() as cur:
        sql = f"""with lich_thang as (
          select add_months(trunc({db.NOW}, 'MM'), level-12) thang
          from dual connect by level<=12
        ), dt_thang as (
          select trunc(s.gio_bat_dau, 'MM') as thang, sum(v.gia_ve) as doanh_thu
          from ve v join suat_chieu s on s.ma_suat = v.ma_suat
          where v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')
            and s.gio_bat_dau>=add_months(trunc({db.NOW}, 'MM'), -11)
            and s.gio_bat_dau<add_months(trunc({db.NOW}, 'MM'), 1)
          group by trunc(s.gio_bat_dau, 'MM')
        ), du_lieu as (
          select l.thang,nvl(d.doanh_thu,0) doanh_thu from lich_thang l
          left join dt_thang d on d.thang=l.thang
        ), xu_huong as (
          select thang,doanh_thu,
            sum(doanh_thu) over (order by thang rows unbounded preceding) luy_ke,
            lag(doanh_thu) over (order by thang) thang_truoc from du_lieu
        )
        select to_char(thang,'YYYY-MM') thang,doanh_thu,luy_ke,thang_truoc,
          round(100*(doanh_thu-thang_truoc)/nullif(thang_truoc,0),2) tang_truong_pct
        from xu_huong order by thang"""
        return db.rows(cur, sql)

@app.get("/api/bao-cao/doanh-thu-30-ngay")
def report_doanh_thu_ngay():
    with db.connection() as con, con.cursor() as cur:
        return db.rows(cur, f"""with lich_ngay(ngay,ngay_cuoi) as (
          select trunc({db.NOW})-29,trunc({db.NOW}) from dual
          union all
          select ngay+1,ngay_cuoi from lich_ngay where ngay<ngay_cuoi
        ), dt_ngay as (
          select trunc(s.gio_bat_dau) ngay,sum(v.gia_ve) doanh_thu
          from suat_chieu s join ve v on v.ma_suat=s.ma_suat
          where s.gio_bat_dau>=trunc({db.NOW})-29
            and s.gio_bat_dau<trunc({db.NOW})+1
            and v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')
          group by trunc(s.gio_bat_dau)
        )
        select to_char(l.ngay,'YYYY-MM-DD') ngay,nvl(d.doanh_thu,0) doanh_thu
        from lich_ngay l left join dt_ngay d on d.ngay=l.ngay order by l.ngay""")

@app.get("/api/analytics/lap-day-phong")
@app.get("/api/bao-cao/ty-le-lap-day")
def report_lap_day_phong():
    """Tỷ lệ lấp đầy phòng chiếu & Xếp hạng trong từng rạp (RANK OVER PARTITION BY)"""
    with db.connection() as con, con.cursor() as cur:
        sql = f"""with so_ghe as (
          select ma_phong, count(*) as tong_ghe from ghe group by ma_phong
        ), ve_ban as (
          select ma_suat, count(*) as so_ve from ve
          where trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG') group by ma_suat
        )
        select s.ma_suat,r.ma_rap,r.ten_rap, ph.ten_phong, p.ten_phim,
          to_char(s.gio_bat_dau, 'YYYY-MM-DD HH24:MI') as gio_chieu,
          nvl(vb.so_ve, 0) as so_ve, sg.tong_ghe,
          round(100 * nvl(vb.so_ve, 0) / sg.tong_ghe, 1) as ty_le_lap_day,
          rank() over (partition by r.ma_rap order by nvl(vb.so_ve, 0) / sg.tong_ghe desc) as hang_trong_rap
        from suat_chieu s
        join phim p on p.ma_phim = s.ma_phim
        join phong_chieu ph on ph.ma_phong = s.ma_phong
        join rap r on r.ma_rap = ph.ma_rap
        join so_ghe sg on sg.ma_phong = s.ma_phong
        left join ve_ban vb on vb.ma_suat = s.ma_suat
        where s.gio_bat_dau>=trunc({db.NOW}) and s.gio_bat_dau<trunc({db.NOW})+1
          and s.trang_thai<>'HUY'
        order by r.ten_rap, hang_trong_rap,s.gio_bat_dau"""
        return db.rows(cur, sql)

# ---------------------------------------------------------------------------
# Section Oral Defense Lab Endpoints
# ---------------------------------------------------------------------------
class TriggerTestForm(BaseModel):
    ma_phong: int | None = Field(default=None, gt=0)
    ma_phim: int | None = Field(default=None, gt=0)
    gio_bat_dau: datetime | None = None
    dinh_dang: str = Field(default="2D", pattern="^(2D|3D|IMAX)$")
    gia_co_ban: int = Field(default=85000, ge=0, le=10000000)
    scenario: str | None = Field(default=None, pattern="^(overlap|gap10|gap20)$")

def lab_actor(actor=Depends(permit(IT, MANAGER, "ROLE_PROGRAMMING", "ROLE_EXECUTIVE", CUSTOMER))):
    if not db.DEMO:
        raise HTTPException(404)
    return actor

def insert_show(cur, film, room, start, minutes, fmt, price):
    out_id = cur.var(int)
    cur.execute("""insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban)
        values(:film,:room,:start_at,:start_at+numtodsinterval(:mins,'MINUTE'),:fmt,:price)
        returning ma_suat into :out_id""", film=film, room=room, start_at=start,
        mins=minutes, fmt=fmt, price=price, out_id=out_id)
    return db.out_value(out_id)

@app.post("/api/lab/test-trigger-lich")
@app.post("/api/lab/them-suat-chieu")
def lab_test_trigger_lich(form: TriggerTestForm, actor=Depends(lab_actor)):
    with db.connection(actor["email"], "TRG_SUAT_CHIEU_KHONG_TRUNG") as con, con.cursor() as cur:
        if form.scenario:
            fixture = db.one(cur, """select (select min(ma_rap) from rap) ma_rap,
                (select min(ma_phim) from phim) ma_phim from dual""")
            from uuid import uuid4
            room_out = cur.var(int)
            cur.execute("""insert into phong_chieu(ma_rap,ten_phong,loai_phong)
                values(:site,:name,'2D') returning ma_phong into :id""",
                site=fixture["ma_rap"], name="LAB-" + uuid4().hex[:16], id=room_out)
            room = db.out_value(room_out)
            start = (db.local_now() + timedelta(days=1)).replace(microsecond=0)
            insert_show(cur, fixture["ma_phim"], room, start, 100, "2D", form.gia_co_ban)
            gap = {"overlap": 50, "gap10": 110, "gap20": 120}[form.scenario]
            insert_show(cur, fixture["ma_phim"], room, start + timedelta(minutes=gap), 100, "2D", form.gia_co_ban)
            con.rollback()
            return {"ok": True, "scenario": form.scenario, "persisted": False,
                    "message": "Oracle chấp nhận khoảng nghỉ 20 phút; đã hoàn tác dữ liệu thử."}
        if actor["role"] not in (IT, MANAGER, "ROLE_PROGRAMMING"):
            raise HTTPException(403, "Chỉ nhân viên được lưu suất chiếu.")
        start = form.gio_bat_dau
        if not form.ma_phim or not form.ma_phong or start is None:
            raise HTTPException(422, "Nhập phim, phòng và thời gian bắt đầu.")
        if start.tzinfo:
            start = start.astimezone(db.VIETNAM).replace(tzinfo=None)
        if start <= db.local_now():
            raise HTTPException(422, "Suất chiếu phải ở tương lai.")
        room = db.one(cur, "select ma_rap,loai_phong from phong_chieu where ma_phong=:id", id=form.ma_phong)
        check_site(actor, room["ma_rap"])
        if room["loai_phong"] != form.dinh_dang:
            raise HTTPException(422, "Định dạng chiếu không khớp loại phòng.")
        film = db.one(cur, "select thoi_luong_phut from phim where ma_phim=:id", id=form.ma_phim)
        id = insert_show(cur, form.ma_phim, form.ma_phong, start, film["thoi_luong_phut"], form.dinh_dang, form.gia_co_ban)
        con.commit()
        return {"ok": True, "ma_suat": id, "persisted": True, "message": "Đã thêm suất chiếu."}

class StateTest(BaseModel):
    ma_ve: int | None = Field(default=None, gt=0)
    tt_moi: str = Field(default="GIU_CHO", pattern="^(GIU_CHO|DA_THANH_TOAN|DA_SU_DUNG|DA_HUY|HET_HAN)$")

@app.post("/api/lab/test-trigger-trang-thai")
@app.post("/api/lab/ep-chuyen-trang-thai-ve")
def lab_test_trigger_trang_thai(form: StateTest | None = None, actor=Depends(lab_actor)):
    form = form or StateTest()
    with db.connection(actor["email"], "TRG_VE_CHUYEN_TRANG_THAI") as con, con.cursor() as cur:
        ticket = db.one(cur, """select v.ma_ve from ve v
            join don_dat_ve d on d.ma_don=v.ma_don
            join suat_chieu s on s.ma_suat=v.ma_suat
            join phong_chieu p on p.ma_phong=s.ma_phong
            where (:ticket is not null and v.ma_ve=:ticket or :ticket is null
              and v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG'))
              and (:customer is null or d.ma_kh=:customer)
              and (:site is null or p.ma_rap=:site)
            order by v.ma_ve desc fetch first 1 row only""", ticket=form.ma_ve,
            customer=actor["id"] if actor["role"] == CUSTOMER else None, site=actor.get("ma_rap"))
        cur.execute("update ve set trang_thai=:state where ma_ve=:id", state=form.tt_moi, id=ticket["ma_ve"])
        con.rollback()
        return {"ok": True, "persisted": False, "message": "Chuyển trạng thái hợp lệ; đã hoàn tác dữ liệu thử."}

@app.post("/api/lab/gia-lap-het-han/{ma_don}")
def lab_expire_order(ma_don: int, actor=Depends(lab_actor)):
    with db.connection(actor["email"], "DON_DAT_VE.HAN_THANH_TOAN") as con, con.cursor() as cur:
        order = order_data(cur, ma_don)
        order_access(cur, actor, order)
        cur.execute(f"""update don_dat_ve set han_thanh_toan={db.NOW}-interval '1' minute
            where ma_don=:id and trang_thai='CHO_THANH_TOAN'""", id=ma_don)
        if not cur.rowcount:
            raise db.business_error(20024, "DON_DAT_VE.HAN_THANH_TOAN")
        result = order_data(cur, ma_don)
        con.commit()
        return result

@app.post("/api/lab/test-giai-phong-het-han")
@app.post("/api/lab/giai-phong-ghe-het-han")
def lab_test_giai_phong_het_han(actor=Depends(lab_actor)):
    with db.connection(actor["email"], "PKG_DAT_VE.SP_GIAI_PHONG_HET_HAN") as con, con.cursor() as cur:
        orders = db.rows(cur, f"""select ma_don from don_dat_ve
            where trang_thai='CHO_THANH_TOAN' and han_thanh_toan<={db.NOW} for update skip locked""")
        ids = json.dumps([row["ma_don"] for row in orders])
        tickets = db.rows(cur, """select ma_ve,ma_don,ma_suat,ma_ghe from ve where trang_thai='GIU_CHO'
            and ma_don in (select id from json_table(:ids,'$[*]' columns(id number path '$')))""", ids=ids)
        cur.callproc("pkg_dat_ve.sp_giai_phong_het_han")
        con.commit()
        return {"ok": True, "so_don": len(orders), "so_ghe": len(tickets),
                "don_dat_ve": [dict(o, trang_thai="HET_HAN") for o in orders],
                "ve": [dict(v, trang_thai="HET_HAN") for v in tickets],
                "message": f"Đã giải phóng {len(tickets)} ghế trong {len(orders)} đơn."}

@app.get("/api/lab/audit-log")
@app.get("/api/lab/nhat-ky-ve")
def lab_audit_log(actor=Depends(lab_actor)):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return db.rows(cur, """select n.*,nvl(n.trang_thai_cu,'MỚI')||' → '||n.trang_thai_moi hanh_dong
            from nhat_ky_ve n join ve v on v.ma_ve=n.ma_ve
            join don_dat_ve d on d.ma_don=v.ma_don
            join suat_chieu s on s.ma_suat=v.ma_suat join phong_chieu p on p.ma_phong=s.ma_phong
            where (:customer is null or d.ma_kh=:customer) and (:site is null or p.ma_rap=:site)
            order by n.thoi_gian desc,n.ma_nk desc fetch first 30 rows only""",
            customer=actor["id"] if actor["role"] == CUSTOMER else None, site=actor.get("ma_rap"))

from operations import router as operations_router
from diagnostics import router as diagnostics_router, benchmark
app.include_router(operations_router)
app.include_router(diagnostics_router)

@app.get("/api/lab/execution-plan")
def lab_execution_plan(actor=Depends(lab_actor)):
    return benchmark(actor)

# Static files / UI Distribution
ROOT_DIR = Path(__file__).resolve().parent.parent
DIST = Path(__file__).with_name("dist")
if not (DIST / "index.html").is_file():
    alt_dist = ROOT_DIR / "frontend" / "dist"
    if (alt_dist / "index.html").is_file():
        DIST = alt_dist

if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

@app.get("/poster/{id}.svg")
def poster(id: int):
    hues = ["#034EA2", "#F58020", "#1D4ED8", "#9333EA", "#059669", "#D97706"]
    c = hues[id % len(hues)]
    n = id % 9
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
      <defs>
        <linearGradient id="bg" x2="1" y2="1">
          <stop stop-color="#0B0F19"/>
          <stop offset="1" stop-color="{c}"/>
        </linearGradient>
      </defs>
      <rect width="400" height="560" fill="url(#bg)"/>
      <circle cx="{100+n*22}" cy="{166+n*13}" r="102" fill="#F58020" opacity=".65"/>
      <circle cx="{120+n*18}" cy="{182+n*13}" r="128" fill="none" stroke="#FFFFFF" opacity=".2"/>
      <path d="M0 430 L96 322 L180 396 L290 274 L400 399 V560 H0Z" fill="#111827"/>
      <path d="M0 489 L145 424 L270 453 L400 397 V560 H0Z" fill="#0B0F19"/>
      <text x="32" y="62" font-family="'Montserrat', sans-serif" font-size="16" letter-spacing="5" font-weight="700" fill="#F58020">GALAXY HUFLIT</text>
      <text x="32" y="510" font-family="'Montserrat', sans-serif" font-size="44" font-weight="900" fill="white">{id:02d}</text>
    </svg>"""
    return Response(svg, media_type="image/svg+xml", headers={"Cache-Control": "public,max-age=86400"})

@app.get("/{route:path}", include_in_schema=False)
def ui(route: str):
    if route.startswith("api/"):
        raise HTTPException(404)
    file = DIST / route
    if route and file.is_file() and file.resolve().is_relative_to(DIST.resolve()):
        return FileResponse(file)
    if (DIST / "index.html").is_file():
        return FileResponse(DIST / "index.html")
    raise HTTPException(404, "Giao diện chưa được build. Vui lòng chạy npm run build trong thư mục frontend.")
