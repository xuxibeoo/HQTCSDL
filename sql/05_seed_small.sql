declare
  v_rap number;
  v_phong number;
  v_standard number;
  v_vip number;
  v_couple number;
  v_genre number;
  v_child number;
  v_movie number;
  v_hall_format varchar2(10);
  v_start timestamp;
  v_suat number;
  v_don number;
  v_now timestamp:=cast(systimestamp at time zone 'Asia/Ho_Chi_Minh' as timestamp);
  v_today date:=trunc(cast(v_now as date));
  -- Local demo only; this fixture does not contain production credentials.
  v_hash constant varchar2(255):='af114296ee63d7ed238a46897a2fce04:f1be876ad52e572774e69d8757ab953f18345521b919c58f6f3b4d9c0dd6ad41';
  names sys.odcivarchar2list:=sys.odcivarchar2list(
    'Vệt sáng cuối trời','Đường đua nửa đêm','Mùa hè bên kia phố','Tín hiệu từ Sao Hỏa',
    'Bí mật dưới lòng biển','Chuyến tàu 0 giờ','Mây Trôi','Biệt đội tí hon','Ngọn đèn cuối hẻm',
    'Người giữ thời gian','Hẹn em ở ga cuối','Sắc màu thành phố','Bên kia đường chân trời',
    'Mật mã hoàng hôn','Ngày trời đổ tuyết','Phố không ngủ','Mùa gió đổi chiều',
    'Bản nhạc sau mưa','Vùng trời thứ hai','Hành tinh giấy');
  cities sys.odcivarchar2list:=sys.odcivarchar2list('Quận 1','Thủ Đức','Tân Bình');
begin
  insert into loai_ghe(ten_loai,phu_thu) values('THUONG',0) returning ma_loai_ghe into v_standard;
  insert into loai_ghe(ten_loai,phu_thu) values('VIP',20000) returning ma_loai_ghe into v_vip;
  insert into loai_ghe(ten_loai,phu_thu) values('COUPLE',40000) returning ma_loai_ghe into v_couple;
  for i in 1..3 loop
    insert into rap(ten_rap,dia_chi) values('Rạp '||cities(i),cities(i)||', TP. Hồ Chí Minh')
      returning ma_rap into v_rap;
    for j in 1..5 loop
      v_hall_format:=case j when 4 then '3D' when 5 then 'IMAX' else '2D' end;
      insert into phong_chieu(ma_rap,ten_phong,loai_phong)
        values(v_rap,'Phòng '||j,v_hall_format) returning ma_phong into v_phong;
      insert into ghe(ma_phong,hang,so_ghe,ma_loai_ghe)
      select v_phong,chr(65+trunc((level-1)/10)),mod(level-1,10)+1,
        case when trunc((level-1)/10)=9 then v_couple
             when trunc((level-1)/10) between 4 and 6 then v_vip else v_standard end
      from dual connect by level<=100;
    end loop;
  end loop;
  insert into the_loai(ten_the_loai) values('Phiêu lưu') returning ma_the_loai into v_genre;
  insert into the_loai(ten_the_loai) values('Khoa học viễn tưởng') returning ma_the_loai into v_child;
  insert into the_loai(ten_the_loai) values('Tâm lý');
  insert into the_loai(ten_the_loai) values('Hoạt hình');
  for i in 1..names.count loop
    insert into phim(ten_phim,thoi_luong_phut,do_tuoi,ngay_khoi_chieu)
      values(names(i),95+mod(i,7)*5,case mod(i,4) when 0 then 'P' when 1 then 'T13' when 2 then 'T16' else 'T18' end,
        v_today+case when i<=16 then -14 else 10 end) returning ma_phim into v_movie;
    insert into phim_the_loai values(v_movie,case when mod(i,3)=0 then v_child else v_genre end);
  end loop;
  for i in 1..20 loop
    insert into khach_hang(ho_ten,email,so_dien_thoai,mat_khau_hash,hang_thanh_vien,diem_tich_luy,ngay_tao)
      values('Khách hàng '||i,'khach'||i||'@cinema.test','090000'||lpad(i,4,'0'),v_hash,
        case i when 1 then 'BAC' when 3 then 'VANG' else 'THUONG' end,
        case i when 1 then 120 when 3 then 350 else 0 end,v_now);
  end loop;
  insert into khuyen_mai(ma_code,loai_giam,gia_tri,giam_toi_da,ngay_bat_dau,ngay_ket_thuc,so_luot_toi_da)
    values('GIAM10','PHAN_TRAM',10,50000,cast(v_now as date)-1,cast(v_now as date)+180,500);
  insert into khuyen_mai(ma_code,loai_giam,gia_tri,ngay_bat_dau,ngay_ket_thuc,so_luot_toi_da,so_luot_da_dung)
    values('MOT_LAN','SO_TIEN',20000,cast(v_now as date)-1,cast(v_now as date)+180,1,1);
  insert into khuyen_mai(ma_code,loai_giam,gia_tri,ngay_bat_dau,ngay_ket_thuc,so_luot_toi_da)
    values('MOT_LAN_TEST','SO_TIEN',20000,cast(v_now as date)-1,cast(v_now as date)+180,1);
  insert into combo(ten_combo,gia) values('iCombo 1 Big',65000);
  insert into combo(ten_combo,gia) values('iCombo 2 Big Extra',110000);
  insert into combo(ten_combo,gia) values('Combo Family',149000);

  -- Fresh demo fixtures: scan now, refund-denied window, and a refundable show.
  for room in (select ma_phong,row_number() over(order by ma_phong) rn
                 from phong_chieu where loai_phong='2D' order by ma_phong fetch first 3 rows only) loop
    v_start:=v_now+numtodsinterval(case room.rn when 1 then 15 when 2 then 80 else 300 end,'MINUTE');
    insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban)
      select ma_phim,room.ma_phong,v_start,v_start+numtodsinterval(thoi_luong_phut,'MINUTE'),'2D',80000
      from phim where ma_phim=room.rn;
  end loop;
  -- Seven future days include tomorrow and the next weekend.
  for room in (select ma_phong,loai_phong,row_number() over(order by ma_phong) rn from phong_chieu) loop
    for d in 1..7 loop
      for slot in 0..2 loop
        v_start:=cast(v_today+d as timestamp)+numtodsinterval(11+slot*4,'HOUR');
        select ma_phim into v_movie from (
          select ma_phim,row_number() over(order by ma_phim) rn from phim where ngay_khoi_chieu<=v_today
        ) where rn=mod(room.rn+d+slot-1,16)+1;
        insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban)
          select ma_phim,room.ma_phong,v_start,v_start+numtodsinterval(thoi_luong_phut,'MINUTE'),
            room.loai_phong,case room.loai_phong when 'IMAX' then 125000 when '3D' then 105000 else 80000 end
          from phim where ma_phim=v_movie;
      end loop;
    end loop;
  end loop;
  -- Historical demo sales are database rows, not fabricated report responses.
  select min(ma_phong) into v_phong from phong_chieu;
  for month_offset in 0..3 loop
    for movie in (select ma_phim,thoi_luong_phut,row_number() over(order by ma_phim) rn
                  from phim order by ma_phim fetch first 10 rows only) loop
      v_start:=cast(add_months(trunc(v_today,'MM'),-month_offset)-1 as timestamp)
        -numtodsinterval(movie.rn*4,'HOUR');
      insert into suat_chieu(ma_phim,ma_phong,gio_bat_dau,gio_ket_thuc,dinh_dang,gia_co_ban,trang_thai)
        values(movie.ma_phim,v_phong,v_start,v_start+numtodsinterval(movie.thoi_luong_phut,'MINUTE'),'2D',80000,'DONG')
        returning ma_suat into v_suat;
      insert into don_dat_ve(ma_kh,thoi_gian_dat,han_thanh_toan,tong_tien,trang_thai)
        values(1,v_start-interval '3' day,v_start-interval '3' day+interval '10' minute,
          (11-movie.rn+month_offset)*80000,'DA_THANH_TOAN') returning ma_don into v_don;
      insert into ve(ma_don,ma_suat,ma_ghe,gia_ve,ma_qr,trang_thai)
        select v_don,v_suat,ma_ghe,80000,rawtohex(sys_guid()),'DA_SU_DUNG'
        from (select ma_ghe from ghe where ma_phong=v_phong order by ma_ghe)
        where rownum<=11-movie.rn+month_offset;
      insert into thanh_toan(ma_don,phuong_thuc,so_tien,trang_thai,ma_giao_dich_ngoai,thoi_gian_tt)
        values(v_don,'THE',(11-movie.rn+month_offset)*80000,'THANH_CONG','SEED-'||v_don,v_start-interval '3' day);
    end loop;
  end loop;
end;
/
commit;
