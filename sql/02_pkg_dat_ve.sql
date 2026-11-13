create or replace package pkg_dat_ve as
  c_phut_giu_cho constant pls_integer := 10;
  c_gio_huy_toi_thieu constant pls_integer := 2;
  c_phut_soat_som constant pls_integer := 30;
  c_he_so_cuoi_tuan constant number := 1.2;
  c_err_ghe_da_ban constant pls_integer := -20021;
  c_err_suat constant pls_integer := -20022;
  c_err_het_han constant pls_integer := -20023;
  c_err_trang_thai constant pls_integer := -20024;
  c_err_khong_huy constant pls_integer := -20025;
  c_err_khuyen_mai constant pls_integer := -20026;
  c_err_gd_trung constant pls_integer := -20027;
  c_err_khong_tim constant pls_integer := -20028;

  function fn_tinh_gia_ve(p_ma_suat in number,p_ma_ghe in number) return number;
  function fn_tinh_giam(p_ma_code in varchar2,p_tong_tien in number) return number;
  function fn_duoc_huy_ve(p_ma_ve in number) return number;
  procedure sp_giu_cho(p_ma_kh in number,p_ma_suat in number,p_ds_ghe in varchar2,
    p_ma_code in varchar2 default null,p_ma_don out number);
  procedure sp_thanh_toan(p_ma_don in number,p_phuong_thuc in varchar2,p_ma_gd_ngoai in varchar2);
  procedure sp_huy_ve(p_ma_ve in number,p_so_tien_hoan out number);
  procedure sp_soat_ve(p_ma_qr in varchar2,p_ket_qua out varchar2);
  procedure sp_giai_phong_het_han;
end pkg_dat_ve;
/
show errors

create or replace package body pkg_dat_ve as
  e_khach_khong_ton_tai exception;
  pragma exception_init(e_khach_khong_ton_tai,-2291);

  function gio_hien_tai return timestamp is
  begin
    return cast(systimestamp at time zone 'Asia/Ho_Chi_Minh' as timestamp);
  end;

  function fn_tinh_gia_ve(p_ma_suat in number,p_ma_ghe in number) return number is
    v_gia suat_chieu.gia_co_ban%type;
    v_bd suat_chieu.gio_bat_dau%type;
    v_phu_thu loai_ghe.phu_thu%type;
    v_ngay date;
    v_he_so number := 1;
  begin
    select s.gia_co_ban,s.gio_bat_dau,lg.phu_thu
      into v_gia,v_bd,v_phu_thu
      from suat_chieu s join ghe g on g.ma_phong=s.ma_phong
      join loai_ghe lg on lg.ma_loai_ghe=g.ma_loai_ghe
      where s.ma_suat=p_ma_suat and g.ma_ghe=p_ma_ghe;
    v_ngay := trunc(cast(v_bd as date));
    if v_ngay-trunc(v_ngay,'IW')>=5 then v_he_so:=c_he_so_cuoi_tuan; end if;
    return round(v_gia*v_he_so+v_phu_thu,-3);
  exception when no_data_found then
    raise_application_error(c_err_suat,'Ghế không thuộc phòng chiếu của suất hoặc suất không tồn tại.');
  end;

  function tinh_giam(p_km khuyen_mai%rowtype,p_tong_tien number) return number is
    -- Promotion inputs are calendar dates; the final date remains valid all day.
    v_ngay date := trunc(cast(gio_hien_tai as date));
    v_giam number;
  begin
    if v_ngay<trunc(p_km.ngay_bat_dau) or v_ngay>trunc(p_km.ngay_ket_thuc)
      or p_km.so_luot_da_dung>=p_km.so_luot_toi_da then
      raise_application_error(c_err_khuyen_mai,'Mã khuyến mãi hết hạn hoặc hết lượt dùng.');
    end if;
    v_giam := case p_km.loai_giam when 'PHAN_TRAM' then p_tong_tien*p_km.gia_tri/100 else p_km.gia_tri end;
    return least(round(v_giam),nvl(p_km.giam_toi_da,p_tong_tien),p_tong_tien);
  end;

  function fn_tinh_giam(p_ma_code in varchar2,p_tong_tien in number) return number is
    v_km khuyen_mai%rowtype;
  begin
    if p_ma_code is null then return 0; end if;
    if p_tong_tien is null or p_tong_tien<0 then
      raise_application_error(c_err_khuyen_mai,'Tổng tiền áp dụng khuyến mãi không hợp lệ.');
    end if;
    select * into v_km from khuyen_mai where ma_code=upper(trim(p_ma_code));
    return tinh_giam(v_km,p_tong_tien);
  exception when no_data_found then
    raise_application_error(c_err_khuyen_mai,'Mã khuyến mãi không tồn tại.');
  end;

  function fn_duoc_huy_ve(p_ma_ve in number) return number is
    v_bd suat_chieu.gio_bat_dau%type;
  begin
    select s.gio_bat_dau into v_bd from ve v join suat_chieu s on s.ma_suat=v.ma_suat
      where v.ma_ve=p_ma_ve;
    return case when v_bd>=gio_hien_tai+numtodsinterval(c_gio_huy_toi_thieu,'HOUR') then 1 else 0 end;
  exception when no_data_found then return 0;
  end;

  procedure sp_giu_cho(p_ma_kh in number,p_ma_suat in number,p_ds_ghe in varchar2,
    p_ma_code in varchar2 default null,p_ma_don out number) is
    v_ids json_array_t;
    v_item json_element_t;
    v_so_ghe number;
    v_so_rieng number;
    v_suat suat_chieu%rowtype;
    v_tong number;
    v_giam number;
    v_km number;
    v_now timestamp := gio_hien_tai;
  begin
    savepoint sp_dau;
    begin
      v_ids:=json_array_t.parse(p_ds_ghe);
      if v_ids is null or v_ids.get_size not between 1 and 8 then raise value_error; end if;
      for i in 0..v_ids.get_size-1 loop
        v_item:=v_ids.get(i);
        if not v_item.is_number or v_ids.get_number(i)<=0 or v_ids.get_number(i)<>trunc(v_ids.get_number(i)) then
          raise value_error;
        end if;
      end loop;
    exception when others then
      raise_application_error(c_err_suat,'Danh sách ghế phải chứa từ 1 đến 8 mã ghế nguyên dương.');
    end;
    select count(*),count(distinct j.id) into v_so_ghe,v_so_rieng
      from json_table(p_ds_ghe,'$[*]' columns(id number path '$')) j;
    if v_so_ghe<>v_so_rieng then
      raise_application_error(c_err_suat,'Danh sách yêu cầu có ghế trùng.');
    end if;
    select * into v_suat from suat_chieu where ma_suat=p_ma_suat and trang_thai='MO_BAN';
    if v_suat.gio_bat_dau<=v_now then
      raise_application_error(c_err_suat,'Suất chiếu đã bắt đầu.');
    end if;
    insert into don_dat_ve(ma_kh,thoi_gian_dat,han_thanh_toan)
      values(p_ma_kh,v_now,v_now+numtodsinterval(c_phut_giu_cho,'MINUTE'))
      returning ma_don into p_ma_don;
    insert into ve(ma_don,ma_suat,ma_ghe,gia_ve)
      select p_ma_don,p_ma_suat,g.ma_ghe,pkg_dat_ve.fn_tinh_gia_ve(p_ma_suat,g.ma_ghe)
      from json_table(p_ds_ghe,'$[*]' columns(id number path '$')) j
      join ghe g on g.ma_ghe=j.id and g.ma_phong=v_suat.ma_phong
      order by g.ma_ghe;
    if sql%rowcount<>v_so_ghe then
      raise_application_error(c_err_suat,'Có ghế không thuộc phòng của suất chiếu này.');
    end if;
    select sum(gia_ve) into v_tong from ve where ma_don=p_ma_don;
    v_giam:=fn_tinh_giam(p_ma_code,v_tong);
    select max(ma_km) into v_km from khuyen_mai where ma_code=upper(trim(p_ma_code));
    update don_dat_ve set ma_km=v_km,tong_tien=v_tong,tien_giam=v_giam where ma_don=p_ma_don;
  exception
    when dup_val_on_index then
      rollback to sp_dau;
      raise_application_error(c_err_ghe_da_ban,'Ít nhất một ghế đã có người đặt cho suất chiếu này.');
    when no_data_found then
      rollback to sp_dau;
      raise_application_error(c_err_suat,'Suất chiếu không tồn tại hoặc đã đóng bán.');
    when e_khach_khong_ton_tai then
      rollback to sp_dau;
      raise_application_error(c_err_khong_tim,'Khách hàng không tồn tại.');
    when others then rollback to sp_dau; raise;
  end;

  procedure sp_thanh_toan(p_ma_don in number,p_phuong_thuc in varchar2,p_ma_gd_ngoai in varchar2) is
    v_don don_dat_ve%rowtype;
    v_km khuyen_mai%rowtype;
    v_ve number;
    v_combo number;
    v_giam number:=0;
    v_thuc_tra number;
    v_bd timestamp;
    v_suat_mo number;
    v_trung number;
    v_now timestamp;
  begin
    savepoint sp_thanh_toan_dau;
    select * into v_don from don_dat_ve where ma_don=p_ma_don for update;
    if p_phuong_thuc is null or p_phuong_thuc not in ('THE','VI_DIEN_TU','CHUYEN_KHOAN')
      or trim(p_ma_gd_ngoai) is null or lengthb(trim(p_ma_gd_ngoai))>64 then
      raise_application_error(c_err_trang_thai,'Thông tin thanh toán không hợp lệ.');
    end if;
    select count(*) into v_trung from thanh_toan where ma_giao_dich_ngoai=trim(p_ma_gd_ngoai);
    if v_trung>0 then raise_application_error(c_err_gd_trung,'Mã giao dịch đã được ghi nhận trước đó.'); end if;
    v_now:=gio_hien_tai;
    if v_don.trang_thai='HET_HAN' or (v_don.trang_thai='CHO_THANH_TOAN' and v_don.han_thanh_toan<=v_now) then
      raise_application_error(c_err_het_han,'Đơn đã quá hạn giữ chỗ.');
    end if;
    select sum(v.gia_ve),min(s.gio_bat_dau),min(case when s.trang_thai='MO_BAN' then 1 else 0 end)
      into v_ve,v_bd,v_suat_mo
      from ve v join suat_chieu s on s.ma_suat=v.ma_suat
      where v.ma_don=p_ma_don and v.trang_thai='GIU_CHO';
    if v_don.trang_thai<>'CHO_THANH_TOAN' or v_ve is null or v_suat_mo=0 then
      raise_application_error(c_err_trang_thai,'Đơn không ở trạng thái có thể thanh toán.');
    end if;
    if v_bd<=v_now then raise_application_error(c_err_het_han,'Suất chiếu đã bắt đầu.'); end if;
    if v_don.ma_km is not null then
      select * into v_km from khuyen_mai where ma_km=v_don.ma_km for update;
      v_giam:=tinh_giam(v_km,v_ve);
    end if;
    v_now:=gio_hien_tai;
    if v_don.han_thanh_toan<=v_now or v_bd<=v_now then
      raise_application_error(c_err_het_han,'Đơn đã quá hạn giữ chỗ.');
    end if;
    select nvl(sum(so_luong*don_gia),0) into v_combo from don_combo where ma_don=p_ma_don;
    v_thuc_tra:=v_ve+v_combo-v_giam;
    insert into thanh_toan(ma_don,phuong_thuc,so_tien,trang_thai,ma_giao_dich_ngoai,thoi_gian_tt)
      values(p_ma_don,p_phuong_thuc,v_thuc_tra,'THANH_CONG',trim(p_ma_gd_ngoai),v_now);
    update ve set trang_thai='DA_THANH_TOAN',ma_qr=rawtohex(sys_guid())
      where ma_don=p_ma_don and trang_thai='GIU_CHO';
    update don_dat_ve set trang_thai='DA_THANH_TOAN',tong_tien=v_ve+v_combo,tien_giam=v_giam where ma_don=p_ma_don;
    if v_don.ma_km is not null then
      update khuyen_mai set so_luot_da_dung=so_luot_da_dung+1 where ma_km=v_don.ma_km;
    end if;
    update khach_hang set diem_tich_luy=diem_tich_luy+floor(v_thuc_tra/10000) where ma_kh=v_don.ma_kh;
  exception
    when dup_val_on_index then rollback to sp_thanh_toan_dau;
      raise_application_error(c_err_gd_trung,'Mã giao dịch đã được ghi nhận trước đó.');
    when no_data_found then rollback to sp_thanh_toan_dau;
      raise_application_error(c_err_khong_tim,'Đơn đặt vé không tồn tại.');
    when others then rollback to sp_thanh_toan_dau; raise;
  end;

  procedure sp_huy_ve(p_ma_ve in number,p_so_tien_hoan out number) is
    v_ve ve%rowtype;
    v_don don_dat_ve%rowtype;
    v_ma_don don_dat_ve.ma_don%type;
    v_tt thanh_toan%rowtype;
    v_gia_ve number;
    v_da_huy_gop number;
    v_da_hoan number;
    v_diem_tru number;
    v_so_con number;
    v_now timestamp;
  begin
    savepoint sp_huy_dau;
    select ma_don into v_ma_don from ve where ma_ve=p_ma_ve;
    -- Consistent parent-first lock order; two refunds of one order are serialized.
    select * into v_don from don_dat_ve where ma_don=v_ma_don for update;
    select * into v_ve from ve where ma_ve=p_ma_ve for update;
    if v_ve.trang_thai<>'DA_THANH_TOAN' then
      raise_application_error(c_err_trang_thai,'Chỉ hủy được vé đã thanh toán và chưa sử dụng.');
    end if;
    if fn_duoc_huy_ve(p_ma_ve)=0 then
      raise_application_error(c_err_khong_huy,'Quá hạn hủy vé (phải trước giờ chiếu tối thiểu 2 giờ).');
    end if;
    select * into v_tt from thanh_toan where ma_don=v_ma_don and trang_thai='THANH_CONG'
      order by ma_tt fetch first 1 row only;
    select sum(gia_ve),nvl(sum(case when trang_thai='DA_HUY' then gia_ve end),0)
      into v_gia_ve,v_da_huy_gop from ve where ma_don=v_ma_don;
    select nvl(sum(so_tien),0) into v_da_hoan from thanh_toan
      where ma_don=v_ma_don and trang_thai='HOAN_TIEN';
    -- Voucher applies to tickets only. Round cumulatively to avoid losing/creating 1 VND per ticket.
    p_so_tien_hoan:=case when v_gia_ve=0 then 0 else
      greatest(0,least(v_tt.so_tien-v_da_hoan,
        round((v_da_huy_gop+v_ve.gia_ve)*(v_gia_ve-v_don.tien_giam)/v_gia_ve)-v_da_hoan)) end;
    v_now:=gio_hien_tai;
    update ve set trang_thai='DA_HUY' where ma_ve=p_ma_ve;
    insert into thanh_toan(ma_don,ma_ve,phuong_thuc,so_tien,trang_thai,ma_giao_dich_ngoai,thoi_gian_tt)
      values(v_ma_don,p_ma_ve,v_tt.phuong_thuc,p_so_tien_hoan,'HOAN_TIEN',
        'RF-'||rawtohex(sys_guid()),v_now);
    v_diem_tru:=floor(greatest(0,v_tt.so_tien-v_da_hoan)/10000)
      -floor(greatest(0,v_tt.so_tien-v_da_hoan-p_so_tien_hoan)/10000);
    update khach_hang set diem_tich_luy=greatest(0,diem_tich_luy-v_diem_tru) where ma_kh=v_don.ma_kh;
    select count(*) into v_so_con from ve where ma_don=v_ma_don and trang_thai in ('DA_THANH_TOAN','DA_SU_DUNG');
    if v_so_con=0 then update don_dat_ve set trang_thai='DA_HUY' where ma_don=v_ma_don; end if;
  exception
    when no_data_found then rollback to sp_huy_dau;
      raise_application_error(c_err_khong_tim,'Không tìm thấy vé hoặc thanh toán gốc.');
    when others then rollback to sp_huy_dau; raise;
  end;

  procedure sp_soat_ve(p_ma_qr in varchar2,p_ket_qua out varchar2) is
    v_ve ve%rowtype;
    v_suat suat_chieu%rowtype;
    v_now timestamp;
  begin
    select * into v_ve from ve where ma_qr=upper(trim(p_ma_qr)) for update;
    select * into v_suat from suat_chieu where ma_suat=v_ve.ma_suat;
    v_now:=gio_hien_tai;
    p_ket_qua:=case
      when v_ve.trang_thai='DA_SU_DUNG' then 'DA_SU_DUNG'
      when v_ve.trang_thai<>'DA_THANH_TOAN' or v_suat.trang_thai='HUY' then 'KHONG_HOP_LE'
      when v_now<v_suat.gio_bat_dau-numtodsinterval(c_phut_soat_som,'MINUTE') then 'CHUA_DEN_GIO'
      when v_now>v_suat.gio_ket_thuc then 'HET_HAN'
      else 'HOP_LE' end;
    if p_ket_qua='HOP_LE' then
      update ve set trang_thai='DA_SU_DUNG' where ma_ve=v_ve.ma_ve;
    end if;
  exception when no_data_found then p_ket_qua:='KHONG_TON_TAI';
  end;

  procedure sp_giai_phong_het_han is
    v_now timestamp:=gio_hien_tai;
    cursor c_don is select ma_don from don_dat_ve
      where trang_thai='CHO_THANH_TOAN' and han_thanh_toan<=v_now
      order by ma_don for update skip locked;
  begin
    for r in c_don loop
      update ve set trang_thai='HET_HAN' where ma_don=r.ma_don and trang_thai='GIU_CHO';
      update don_dat_ve set trang_thai='HET_HAN' where current of c_don;
    end loop;
    -- The calling API or Scheduler job owns the commit.
  end;
end pkg_dat_ve;
/
show errors
