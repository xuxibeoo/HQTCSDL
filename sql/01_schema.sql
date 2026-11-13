-- Oracle Database 23ai. Run only in the dedicated CINEMA demo schema.
-- Explicit reset: these statements discard the existing demo data.
declare
  v_job number;
begin
  select count(*) into v_job from user_scheduler_jobs where job_name='JOB_GIAI_PHONG_GHE';
  if v_job > 0 then dbms_scheduler.drop_job('JOB_GIAI_PHONG_GHE',force=>true); end if;
end;
/
drop table if exists nhat_ky_ve cascade constraints purge;
drop table if exists thanh_toan cascade constraints purge;
drop table if exists don_combo cascade constraints purge;
drop table if exists ve cascade constraints purge;
drop table if exists don_dat_ve cascade constraints purge;
drop table if exists suat_chieu cascade constraints purge;
drop table if exists phim_the_loai cascade constraints purge;
drop table if exists ghe cascade constraints purge;
drop table if exists phong_chieu cascade constraints purge;
drop table if exists combo cascade constraints purge;
drop table if exists khuyen_mai cascade constraints purge;
drop table if exists khach_hang cascade constraints purge;
drop table if exists phim cascade constraints purge;
drop table if exists the_loai cascade constraints purge;
drop table if exists loai_ghe cascade constraints purge;
drop table if exists rap cascade constraints purge;

create table rap (
  ma_rap number generated always as identity primary key,
  ten_rap varchar2(100 char) not null,
  dia_chi varchar2(255 char) not null
);
create table phong_chieu (
  ma_phong number generated always as identity primary key,
  ma_rap number not null references rap,
  ten_phong varchar2(50 char) not null,
  loai_phong varchar2(10) not null
    constraint ck_phong_loai check (loai_phong in ('2D','3D','IMAX')),
  constraint uq_phong_rap_ten unique (ma_rap,ten_phong)
);
create table loai_ghe (
  ma_loai_ghe number generated always as identity primary key,
  ten_loai varchar2(30) not null constraint uq_loai_ghe_ten unique,
  phu_thu number(10) default 0 not null
    constraint ck_loai_ghe_phu_thu check (phu_thu>=0)
);
create table ghe (
  ma_ghe number generated always as identity primary key,
  ma_phong number not null references phong_chieu,
  hang char(1) not null,
  so_ghe number(3) not null,
  ma_loai_ghe number not null references loai_ghe,
  constraint uq_ghe_vi_tri unique (ma_phong,hang,so_ghe)
);
create table the_loai (
  ma_the_loai number generated always as identity primary key,
  ten_the_loai varchar2(50 char) not null constraint uq_the_loai_ten unique
);
create table phim (
  ma_phim number generated always as identity primary key,
  ten_phim varchar2(200 char) not null,
  thoi_luong_phut number(3) not null constraint ck_phim_thoi_luong check (thoi_luong_phut between 1 and 400),
  do_tuoi varchar2(3) default 'P' not null constraint ck_phim_do_tuoi check (do_tuoi in ('P','T13','T16','T18')),
  ngay_khoi_chieu date
);
create table phim_the_loai (
  ma_phim number not null references phim,
  ma_the_loai number not null references the_loai,
  constraint pk_phim_the_loai primary key (ma_phim,ma_the_loai)
);
create table suat_chieu (
  ma_suat number generated always as identity primary key,
  ma_phim number not null references phim,
  ma_phong number not null references phong_chieu,
  gio_bat_dau timestamp(0) not null,
  gio_ket_thuc timestamp(0) not null,
  dinh_dang varchar2(10) default '2D' not null
    constraint ck_suat_dinh_dang check (dinh_dang in ('2D','3D','IMAX')),
  gia_co_ban number(10) not null constraint ck_suat_gia check (gia_co_ban>=0),
  trang_thai varchar2(10) default 'MO_BAN' not null
    constraint ck_suat_trang_thai check (trang_thai in ('MO_BAN','DONG','HUY')),
  constraint ck_suat_thoi_gian check (gio_ket_thuc>gio_bat_dau)
);
create table khach_hang (
  ma_kh number generated always as identity primary key,
  ho_ten varchar2(100 char) not null,
  email varchar2(150) not null constraint uq_kh_email unique,
  so_dien_thoai varchar2(15),
  mat_khau_hash varchar2(255) not null,
  hang_thanh_vien varchar2(10) default 'THUONG' not null
    constraint ck_kh_hang check (hang_thanh_vien in ('THUONG','BAC','VANG')),
  diem_tich_luy number(10) default 0 not null constraint ck_kh_diem check (diem_tich_luy>=0),
  ngay_tao timestamp(0) default systimestamp not null
);
create table khuyen_mai (
  ma_km number generated always as identity primary key,
  ma_code varchar2(30) not null constraint uq_km_code unique,
  loai_giam varchar2(10) not null constraint ck_km_loai check (loai_giam in ('PHAN_TRAM','SO_TIEN')),
  gia_tri number(10,2) not null constraint ck_km_gia_tri check (gia_tri>0),
  giam_toi_da number(10) check (giam_toi_da>=0),
  ngay_bat_dau date not null,
  ngay_ket_thuc date not null,
  so_luot_toi_da number(8) not null,
  so_luot_da_dung number(8) default 0 not null,
  constraint ck_km_thoi_han check (ngay_ket_thuc>=ngay_bat_dau),
  constraint ck_km_luot check (so_luot_da_dung between 0 and so_luot_toi_da)
);
create table don_dat_ve (
  ma_don number generated always as identity primary key,
  ma_kh number not null references khach_hang,
  ma_km number references khuyen_mai,
  thoi_gian_dat timestamp(0) default systimestamp not null,
  han_thanh_toan timestamp(0) not null,
  tong_tien number(12) default 0 not null,
  tien_giam number(12) default 0 not null,
  trang_thai varchar2(15) default 'CHO_THANH_TOAN' not null
    constraint ck_don_trang_thai check (trang_thai in ('CHO_THANH_TOAN','DA_THANH_TOAN','DA_HUY','HET_HAN')),
  constraint ck_don_tien check (tong_tien>=0 and tien_giam between 0 and tong_tien)
);
create table ve (
  ma_ve number generated always as identity primary key,
  ma_don number not null references don_dat_ve,
  ma_suat number not null references suat_chieu,
  ma_ghe number not null references ghe,
  gia_ve number(10) not null constraint ck_ve_gia check (gia_ve>=0),
  trang_thai varchar2(15) default 'GIU_CHO' not null constraint ck_ve_trang_thai
    check (trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG','DA_HUY','HET_HAN')),
  ma_qr varchar2(64) constraint uq_ve_qr unique
);
-- Entirely NULL B-tree keys are absent; expired and cancelled rows keep their history.
create unique index uq_ve_suat_ghe_hieu_luc on ve (
  case when trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG') then ma_suat end,
  case when trang_thai in ('GIU_CHO','DA_THANH_TOAN','DA_SU_DUNG') then ma_ghe end
);
create table thanh_toan (
  ma_tt number generated always as identity primary key,
  ma_don number not null references don_dat_ve,
  ma_ve number references ve,
  phuong_thuc varchar2(15) not null constraint ck_tt_pt
    check (phuong_thuc in ('THE','VI_DIEN_TU','CHUYEN_KHOAN')),
  so_tien number(12) not null constraint ck_tt_so_tien check (so_tien>=0),
  trang_thai varchar2(12) not null constraint ck_tt_trang_thai
    check (trang_thai in ('THANH_CONG','THAT_BAI','HOAN_TIEN')),
  ma_giao_dich_ngoai varchar2(64) not null constraint uq_tt_gd unique,
  thoi_gian_tt timestamp(0) default systimestamp not null
);
create table combo (
  ma_combo number generated always as identity primary key,
  ten_combo varchar2(100 char) not null,
  gia number(10) not null constraint ck_combo_gia check (gia>=0)
);
create table don_combo (
  ma_don number not null references don_dat_ve,
  ma_combo number not null references combo,
  so_luong number(3) not null constraint ck_dc_sl check (so_luong>0),
  don_gia number(10) not null check (don_gia>=0),
  constraint pk_don_combo primary key (ma_don,ma_combo)
);
create table nhat_ky_ve (
  ma_nk number generated always as identity primary key,
  ma_ve number not null references ve,
  trang_thai_cu varchar2(15),
  trang_thai_moi varchar2(15) not null,
  nguoi_thuc_hien varchar2(128),
  thoi_gian timestamp(0) default systimestamp not null
);

create index ix_ve_don on ve(ma_don);
create index ix_suat_phong_tg on suat_chieu(ma_phong,gio_bat_dau);
create index ix_suat_phim_tg on suat_chieu(ma_phim,gio_bat_dau);
create index ix_tt_don on thanh_toan(ma_don);
create index ix_nk_ve on nhat_ky_ve(ma_ve);
