from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import db
from main import CASHIER, MANAGER, SUPPORT, check_site, permit

EXEC="ROLE_EXECUTIVE"
PROGRAM="ROLE_PROGRAMMING"
MARKET="ROLE_MARKETING"
ACCOUNT="ROLE_ACCOUNTING"
IT="ROLE_IT_ADMIN"
router=APIRouter(prefix="/api/admin")

@router.get("/tong-quan")
def dashboard(actor=Depends(permit(EXEC,ACCOUNT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return db.one(cur,"""select
            (select nvl(sum(so_tien),0) from thanh_toan where trang_thai='THANH_CONG') da_thu,
            (select nvl(sum(so_tien),0) from thanh_toan where trang_thai='HOAN_TIEN') da_hoan,
            (select count(*) from ve where trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')) ve_hieu_luc,
            (select round(100*count(v.ma_ve)/nullif(count(*),0),2)
             from suat_chieu s join ghe g on g.ma_phong=s.ma_phong
             left join ve v on v.ma_suat=s.ma_suat and v.ma_ghe=g.ma_ghe and v.trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG')
             where s.gio_bat_dau>sysdate and s.gio_bat_dau<sysdate+7) lap_day_7_ngay from dual""")

@router.get("/phong")
def halls(actor=Depends(permit(PROGRAM,MANAGER,CASHIER))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return db.rows(cur,"""select p.*,r.ten_rap from phong_chieu p join rap r on r.ma_rap=p.ma_rap
            where (:site is null or p.ma_rap=:site) order by p.ma_rap,p.ten_phong""",site=actor["ma_rap"])

class Schedule(BaseModel):
    ma_phim:int
    ma_phong:int
    gio_bat_dau:datetime
    gia_co_ban:int=Field(gt=0,le=10000000)

@router.post("/suat-chieu")
def schedule(form:Schedule,actor=Depends(permit(PROGRAM))):
    if form.gio_bat_dau.tzinfo is not None or form.gio_bat_dau<=db.local_now():
        raise HTTPException(400,"Chọn giờ chiếu địa phương trong tương lai.")
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        film=db.one(cur,"select thoi_luong_phut,ngay_khoi_chieu from phim where ma_phim=:id",id=form.ma_phim)
        if form.gio_bat_dau.date()<film["ngay_khoi_chieu"].date():
            raise HTTPException(400,"Suất chiếu diễn ra trước ngày khởi chiếu.")
        room=db.one(cur,"select loai_phong from phong_chieu where ma_phong=:id",id=form.ma_phong)
        result=cur.var(int)
        cur.execute("""insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban)
            values(:film,:room,:start_at,:start_at+numtodsinterval(:mins,'MINUTE'),:fmt,:price) returning ma_suat into :out_id""",
            film=form.ma_phim,room=form.ma_phong,start_at=form.gio_bat_dau,mins=film["thoi_luong_phut"],
            fmt=room["loai_phong"],price=form.gia_co_ban,out_id=result)
        con.commit()
        return {"ma_suat":result.getvalue()[0]}

class Film(BaseModel):
    ten_phim:str=Field(min_length=1,max_length=150)
    thoi_luong_phut:int=Field(ge=1,le=400)
    do_tuoi:str=Field(pattern="^(P|T13|T16|T18)$")
    ngay_khoi_chieu:datetime
    ma_the_loai:int

@router.post("/phim")
def add_film(form:Film,actor=Depends(permit(PROGRAM))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        result=cur.var(int)
        cur.execute("""insert into phim(ten_phim,thoi_luong_phut,do_tuoi,ngay_khoi_chieu)
            values(:title,:mins,:rating,:release) returning ma_phim into :out_id""",
            title=form.ten_phim,mins=form.thoi_luong_phut,rating=form.do_tuoi,release=form.ngay_khoi_chieu,out_id=result)
        film=result.getvalue()[0]
        cur.execute("insert into phim_the_loai values(:film,:genre)",film=film,genre=form.ma_the_loai)
        con.commit()
        return {"ma_phim":film}

@router.get("/khach-hang")
def customers(q:str="",actor=Depends(permit(SUPPORT,CASHIER))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return db.rows(cur,"""select ma_kh,ho_ten,email,so_dien_thoai,hang_thanh_vien,diem_tich_luy from khach_hang
            where lower(ho_ten) like :q or lower(email) like :q or so_dien_thoai like :q
            order by ma_kh fetch first 30 rows only""",q="%"+q.strip().lower()+"%")

class Tier(BaseModel):
    hang_thanh_vien:str=Field(pattern="^(THUONG|BAC|VANG)$")

@router.put("/khach-hang/{id}/hang")
def tier(id:int,form:Tier,actor=Depends(permit(SUPPORT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        cur.execute("update khach_hang set hang_thanh_vien=:tier where ma_kh=:id",tier=form.hang_thanh_vien,id=id)
        if not cur.rowcount:
            raise HTTPException(404,"Không tìm thấy khách hàng.")
        con.commit()
        return {"ok":True}

@router.get("/voucher")
def vouchers(actor=Depends(permit(MARKET,EXEC))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return db.rows(cur,"select * from khuyen_mai order by ma_km desc")

class Voucher(BaseModel):
    ma_code:str=Field(pattern="^[A-Z0-9_]{2,30}$")
    loai_giam:str=Field(pattern="^(PHAN_TRAM|SO_TIEN)$")
    gia_tri:int=Field(gt=0,le=10000000)
    so_luot_toi_da:int=Field(ge=1,le=1000000)
    so_ngay:int=Field(ge=1,le=365)

@router.post("/voucher")
def voucher(form:Voucher,actor=Depends(permit(MARKET))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        cur.execute(f"""insert into khuyen_mai(ma_code,loai_giam,gia_tri,so_luot_toi_da,ngay_bat_dau,ngay_ket_thuc)
            values(:code,:kind,:value,:quota,{db.NOW},{db.NOW}+numtodsinterval(:days,'DAY'))""",
            code=form.ma_code,kind=form.loai_giam,value=form.gia_tri,quota=form.so_luot_toi_da,days=form.so_ngay)
        con.commit()
        return {"ok":True}

@router.get("/doi-soat")
def reconcile(actor=Depends(permit(ACCOUNT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return {
            "giao_dich":db.rows(cur,"""select g.*,g.ma_giao_dich_ngoai ma_gd_ngoai,g.thoi_gian_tt thoi_gian_gd,
                d.tong_tien-d.tien_giam gia_tri_don,
                sum(case when g.trang_thai='THANH_CONG' then g.so_tien else 0 end)
                over(partition by g.ma_don) tong_da_thu from thanh_toan g
                join don_dat_ve d on d.ma_don=g.ma_don where g.trang_thai<>'HOAN_TIEN'
                order by g.thoi_gian_tt desc fetch first 50 rows only"""),
            "hoan_tien":db.rows(cur,"""select t.*,t.ma_tt ma_hoan,t.so_tien so_tien_hoan,t.thoi_gian_tt thoi_gian_hoan
                from thanh_toan t where trang_thai='HOAN_TIEN'
                order by thoi_gian_tt desc fetch first 50 rows only"""),
        }

@router.get("/nhat-ky")
def audit(actor=Depends(permit(MANAGER,IT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return db.rows(cur,"""select n.*,p.ma_rap,v.ma_don,v.ma_suat,
            nvl(n.trang_thai_cu,'MỚI')||' → '||n.trang_thai_moi hanh_dong from nhat_ky_ve n
            join ve v on v.ma_ve=n.ma_ve join suat_chieu s on s.ma_suat=v.ma_suat join phong_chieu p on p.ma_phong=s.ma_phong
            where (:site is null or p.ma_rap=:site)
            order by n.ma_nk desc fetch first 40 rows only""",site=actor["ma_rap"])

@router.get("/ky-thuat")
def systems(actor=Depends(permit(IT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        return {
            "jobs":db.rows(cur,"""select job_name,enabled,state,
                cast(last_start_date at time zone '+07:00' as timestamp) lan_chay_gan_nhat,
                cast(next_run_date at time zone '+07:00' as timestamp) lan_chay_tiep_theo,
                run_count,failure_count from user_scheduler_jobs"""),
            "sessions":db.rows(cur,"""select sid,serial#,status,event,blocking_session,client_identifier
                from v$session where username=user and type='USER' order by sid"""),
        }

class Job(BaseModel):
    action:str=Field(pattern="^(RUN|ENABLE|DISABLE)$")

@router.post("/ky-thuat/job")
def scheduler(form:Job,actor=Depends(permit(IT))):
    with db.connection(actor["email"]) as con, con.cursor() as cur:
        if form.action=="RUN":
            cur.callproc("pkg_dat_ve.sp_giai_phong_het_han")
        else:
            operation="enable" if form.action=="ENABLE" else "disable"
            cur.callproc(f"dbms_scheduler.{operation}",["JOB_GIAI_PHONG_HET_HAN"])
        con.commit()
        return {"ok":True}
