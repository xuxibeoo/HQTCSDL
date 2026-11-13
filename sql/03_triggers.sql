create or replace trigger trg_suat_chieu_khong_trung
for insert or update on suat_chieu
compound trigger
  g_ds_suat sys.odcinumberlist := sys.odcinumberlist();
  c_phut_don_phong constant pls_integer := 15;

  before each row is
    v_format phong_chieu.loai_phong%type;
  begin
    select loai_phong into v_format from phong_chieu where ma_phong=:new.ma_phong;
    if v_format<>:new.dinh_dang then
      raise_application_error(-20031,'Định dạng suất không phù hợp với phòng chiếu.');
    end if;
  end before each row;

  after each row is
  begin
    if :new.trang_thai<>'HUY' then
      g_ds_suat.extend;
      g_ds_suat(g_ds_suat.count):=:new.ma_suat;
    end if;
  end after each row;

  after statement is
    v_conflict number;
    v_locked_room phong_chieu.ma_phong%type;
  begin
    -- Process only changed shows, lock rooms in ID order, and check each show
    -- using the room/time index. The conflict query starts after the room lock.
    for changed in (
      select /*+ leading(ids s) use_nl(s) */ s.ma_suat,s.ma_phong,s.gio_bat_dau,s.gio_ket_thuc
        from table(g_ds_suat) ids join suat_chieu s on s.ma_suat=ids.column_value
       order by s.ma_phong,s.ma_suat
    ) loop
      if v_locked_room is null or v_locked_room<>changed.ma_phong then
        select ma_phong into v_locked_room from phong_chieu where ma_phong=changed.ma_phong for update;
      end if;
      select /*+ index(b ix_suat_phong_tg) */ count(*) into v_conflict from suat_chieu b
        where b.ma_phong=changed.ma_phong and b.ma_suat<>changed.ma_suat and b.trang_thai<>'HUY'
          and b.gio_bat_dau<changed.gio_ket_thuc+numtodsinterval(c_phut_don_phong,'MINUTE')
          and b.gio_ket_thuc>changed.gio_bat_dau-numtodsinterval(c_phut_don_phong,'MINUTE')
          and rownum=1;
      if v_conflict>0 then
        raise_application_error(-20031,'Suất chiếu chồng lịch hoặc cách dưới 15 phút dọn phòng.');
      end if;
    end loop;
  end after statement;
end;
/
show errors

create or replace trigger trg_ve_chuyen_trang_thai
before update of trang_thai on ve for each row
when (old.trang_thai<>new.trang_thai)
begin
  if not (
    (:old.trang_thai='GIU_CHO' and :new.trang_thai in ('DA_THANH_TOAN','HET_HAN','DA_HUY'))
    or (:old.trang_thai='DA_THANH_TOAN' and :new.trang_thai in ('DA_SU_DUNG','DA_HUY'))
  ) then
    raise_application_error(-20032,'Không được chuyển trạng thái vé từ '||:old.trang_thai||' sang '||:new.trang_thai||'.');
  end if;
end;
/
show errors

create or replace trigger trg_ve_nhat_ky
after insert or update of trang_thai on ve for each row
begin
  if inserting or :old.trang_thai<>:new.trang_thai then
    insert into nhat_ky_ve(ma_ve,trang_thai_cu,trang_thai_moi,nguoi_thuc_hien,thoi_gian)
    values(:new.ma_ve,:old.trang_thai,:new.trang_thai,
      coalesce(sys_context('USERENV','CLIENT_IDENTIFIER'),sys_context('USERENV','SESSION_USER')),
      cast(systimestamp at time zone 'Asia/Ho_Chi_Minh' as timestamp));
  end if;
end;
/
show errors
