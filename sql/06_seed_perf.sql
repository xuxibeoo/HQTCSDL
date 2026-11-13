-- Optional workload for the report: 6,750 shows, 300,000 orders, 400,000 tickets.
-- Run only against a seeded CINEMA demo database; benchmark history is fixed in 2023.
whenever sqlerror exit failure rollback
set define off
set serveroutput on
declare
  v_exists number;
  v_rooms number;
  v_customers number;
  v_seats number;
  v_film number;
  v_show_anchor constant timestamp := timestamp '2023-01-01 08:00:00';
  v_order_anchor constant timestamp := timestamp '2022-12-01 00:00:00';
begin
  select count(*) into v_exists from thanh_toan where ma_giao_dich_ngoai='PERF-V2-300000';
  if v_exists>0 then
    dbms_output.put_line('Workload already seeded.');
    return;
  end if;
  select count(*) into v_rooms from phong_chieu;
  select count(*) into v_customers from khach_hang;
  select count(*) into v_seats from (
    select ma_phong from ghe group by ma_phong having count(*)=100
  );
  select min(ma_phim) into v_film from phim;
  if v_rooms<>15 or v_customers<20 or v_seats<>15 or v_film is null then
    raise_application_error(-20901,'Run the small demo seed before this optional workload.');
  end if;

  -- Keep the compound trigger enabled, and bound the number of changed shows
  -- it has to examine per statement. All days still share one transaction.
  for day_offset in 0..89 loop
    insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban,trang_thai)
    select v_film,p.ma_phong,
      v_show_anchor+numtodsinterval(day_offset*24+k.n*3,'HOUR'),
      v_show_anchor+numtodsinterval(day_offset*24+k.n*3+2,'HOUR'),
      p.loai_phong,80000,'DONG'
    from phong_chieu p cross join (select level-1 n from dual connect by level<=5) k;
  end loop;

  insert into don_dat_ve(ma_kh,thoi_gian_dat,han_thanh_toan,tong_tien,trang_thai)
  with customers as (
    select ma_kh,row_number() over(order by ma_kh) rn from khach_hang
  ), seq as (select level n from dual connect by level<=300000)
  select c.ma_kh,v_order_anchor+numtodsinterval(seq.n-1,'SECOND'),
    v_order_anchor+numtodsinterval(seq.n-1+600,'SECOND'),
    case when seq.n<=100000 then 160000 else 80000 end,'DA_THANH_TOAN'
  from seq join customers c on c.rn=1+mod(seq.n-1,20);

  insert into ve(ma_don,ma_suat,ma_ghe,gia_ve,trang_thai,ma_qr)
  with seats as (
    select ma_phong,ma_ghe,row_number() over(partition by ma_phong order by hang,so_ghe) seat_no from ghe
  ), ranked as (
    select s.ma_suat,g.ma_ghe,row_number() over(order by s.gio_bat_dau,s.ma_phong,g.seat_no) rn
    from suat_chieu s join seats g on g.ma_phong=s.ma_phong
    where s.gio_bat_dau>=v_show_anchor and s.gio_bat_dau<v_show_anchor+interval '90' day
      and g.seat_no<=60
  ), picked as (
    select ma_suat,ma_ghe,case when rn<=200000 then ceil(rn/2) else rn-100000 end order_no
    from ranked where rn<=400000
  )
  select d.ma_don,p.ma_suat,p.ma_ghe,80000,'DA_SU_DUNG',rawtohex(sys_guid())
    from picked p join don_dat_ve d
      on d.thoi_gian_dat=v_order_anchor+numtodsinterval(p.order_no-1,'SECOND');

  insert into thanh_toan(ma_don,phuong_thuc,so_tien,trang_thai,ma_giao_dich_ngoai,thoi_gian_tt)
    select ma_don,'THE',tong_tien,'THANH_CONG',
      'PERF-V2-'||row_number() over(order by thoi_gian_dat),thoi_gian_dat
    from don_dat_ve where thoi_gian_dat>=v_order_anchor
      and thoi_gian_dat<v_order_anchor+numtodsinterval(300000,'SECOND');
  dbms_output.put_line('Inserted 6,750 shows, 300,000 orders and 400,000 tickets.');
end;
/
commit;
@@08_optimize.sql
