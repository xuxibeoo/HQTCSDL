import React,{useEffect,useState} from "react";
import {api,roles,vnd,dateLabel,clock} from "./api";
import {Booking,History,SeatMap} from "./booking";

function DataTable({rows,columns}) {
  if(!rows?.length)return <p className="muted">Chưa có dữ liệu.</p>;
  const cols=columns||Object.keys(rows[0]).map(k=>[k,k]);
  return <div className="table-wrap"><table><thead><tr>{cols.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={i}>{cols.map(([key,,format])=><td key={key}>{r[key]==null?"—":format?format(r[key]):String(r[key])}</td>)}</tr>)}</tbody>
  </table></div>;
}

function ScanPanel({call}) {
  const [qr,setQr]=useState("");
  const [result,setResult]=useState("");
  const [camera,setCamera]=useState(false);
  const video=React.useRef(null);
  useEffect(()=>{
    if(!camera)return;
    let stream, interval, active=true;
    async function open(){
      try{
        if(!("BarcodeDetector" in window))throw new Error("Trình duyệt chưa có bộ quét QR. Hãy dán mã hoặc dùng máy quét USB.");
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
        if(!active){stream.getTracks().forEach(t=>t.stop());return;}
        video.current.srcObject=stream;
        const detector=new window.BarcodeDetector({formats:["qr_code"]});
        interval=setInterval(async()=>{
          if(!video.current)return;
          const hits=await detector.detect(video.current).catch(()=>[]);
          if(active&&hits.length){setQr(hits[0].rawValue);setCamera(false);}
        },450);
      }catch(e){if(active){setResult(e.message);setCamera(false);}}
    }
    open();
    return()=>{active=false;clearInterval(interval);stream?.getTracks().forEach(t=>t.stop());};
  },[camera]);
  return <section className="panel"><h2>Soát vé QR</h2>
    <form className="inline" onSubmit={async e=>{e.preventDefault();const x=await call("/soat-ve/quet-qr",{body:{ma_qr:qr}});if(x)setResult(x.ket_qua);}}>
      <label>Mã QR<input required value={qr} onChange={e=>setQr(e.target.value)} placeholder="Dán mã QR của vé"/></label><button className="primary">Kiểm tra vé</button>
      <button type="button" onClick={()=>setCamera(!camera)}>{camera?"Tắt camera":"Mở camera"}</button>
    </form>{camera&&<video ref={video} autoPlay playsInline muted className="camera"/>}
    {result&&<h3 role="status" className={result==="HOP_LE"?"passed":"error"}>{({HOP_LE:"HỢP LỆ",DA_SU_DUNG:"ĐÃ SỬ DỤNG",KHONG_HOP_LE:"KHÔNG HỢP LỆ"})[result]||result}</h3>}</section>;
}

function TrendChart({rows,series,label}) {
  if(!rows?.length)return null;
  const width=640,height=160,pad=12;
  const values=rows.flatMap(r=>series.map(([key])=>r[key]).filter(x=>x!=null));
  const lo=Math.min(0,...values),hi=Math.max(1,...values);
  const x=i=>pad+i*(width-2*pad)/Math.max(1,rows.length-1);
  const y=v=>height-pad-(v-lo)*(height-2*pad)/(hi-lo);
  return <figure className="trend-figure">
    <svg viewBox={"0 0 "+width+" "+height} role="img" aria-label={label}>
      <path d={"M"+pad+" "+y(0)+" H"+(width-pad)} stroke="#555565"/>
      {series.map(([key,title,color])=>{
        const points=rows.map((r,i)=>r[key]==null?null:[x(i),y(r[key])]);
        const path=points.map((point,i)=>point?(points[i-1]?"L":"M")+point.join(" "):"").join(" ");
        return <g key={key}><path d={path} fill="none" stroke={color} strokeWidth="2.8"/>
          {points.map((point,i)=>point&&<circle key={i} cx={point[0]} cy={point[1]} r="3" fill={color}><title>{rows[i].thang.slice(0,7)+" · "+title+" · "+rows[i][key]}</title></circle>)}
        </g>;
      })}
    </svg>
    <figcaption>{series.map(([key,title,color])=><span key={key} style={{color}}>● {title}</span>)}</figcaption>
  </figure>;
}

function Analytics({data,catalog}) {
  const months=[...new Set((data?.top||[]).map(r=>r.thang))];
  const [month,setMonth]=useState("");
  const top=(data?.top||[]).filter(r=>r.thang===(month||months[0]));
  const max=Math.max(1,...top.map(r=>r.doanh_thu));
  return <><section className="panel"><div className="section-title"><h2>Xếp hạng doanh thu vé</h2>
    <select aria-label="Tháng báo cáo" value={month||months[0]||""} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{m.slice(0,7)}</option>)}</select></div>
    <div className="chart">{top.map(r=><div key={r.ma_phim}><span>{r.hang}. {r.ten_phim}</span><meter min="0" max={max} value={r.doanh_thu}/><strong>{vnd(r.doanh_thu)}</strong></div>)}</div>
    </section><section className="panel"><h2>Thu ròng theo tháng</h2>
      <TrendChart rows={data?.trend} series={[["luy_ke","Lũy kế","#ffab5e"],["tb_3_thang","Trung bình 3 tháng","#85d9ff"]]} label="Đường thu lũy kế và trung bình 3 tháng"/>
      <TrendChart rows={data?.trend} series={[["tang_truong","Tăng trưởng (%)","#9beab7"]]} label="Đường tăng trưởng phần trăm theo tháng"/>
      <DataTable rows={data?.trend} columns={[["thang","Tháng",v=>v.slice(0,7)],["doanh_thu","Thu ròng",vnd],["tang_truong","Tăng trưởng (%)"],["luy_ke","Lũy kế",vnd],["tb_3_thang","TB 3 tháng",vnd]]}/>
    </section><section className="panel"><h2>Doanh thu vé theo rạp và phim</h2><DataTable rows={data?.theo_rap}/></section>
    <section className="panel"><h2>Cây thể loại phim</h2><ul>{catalog.the_loai.map(g=><li key={g.ma_the_loai} style={{paddingLeft:(g.cap-1)*20}}>{g.cap>1?"↳ ":""}{g.ten_the_loai}</li>)}</ul></section></>;
}

function TestPanel({call,system,reload}) {
  const tests=["Giữ ghế và thanh toán","VIP và giá cuối tuần","Hai phiên giữ F5","Hết hạn và đặt lại","Voucher giới hạn lượt","Mã giao dịch trùng","Hủy và hoàn tiền","Quét QR hai lần","Trigger lịch và trạng thái"];
  const [results,setResults]=useState({});
  const [plans,setPlans]=useState(null);
  const [busy,setBusy]=useState("");
  async function run(cases) {
    setBusy("tests");
    try{
      for(const i of cases){
        const x=await call("/admin/tests/"+i,{method:"POST"});
        if(x)setResults(r=>({...r,[i]:x}));
      }
    }finally{setBusy("");}
  }
  return <>
    <section className="panel"><h2>Oracle Scheduler và phiên kết nối</h2><DataTable rows={system?.jobs}/>
      <div className="actions">{[["RUN","Giải phóng ngay"],["ENABLE","Bật lịch"],["DISABLE","Tắt lịch"]].map(([action,label])=><button key={action} onClick={async()=>{await call("/admin/ky-thuat/job",{body:{action}});reload();}}>{label}</button>)}</div>
      <DataTable rows={system?.sessions}/>
    </section>
    <section className="panel"><div className="section-title"><h2>Kiểm thử PL/SQL</h2><button className="primary" disabled={!!busy} onClick={()=>run(tests.map((_,i)=>i+1))}>{busy==="tests"?"Đang chạy…":"Chạy cả 9 ca"}</button></div>
    <div className="test-list">{tests.map((name,i)=><article key={name}>
      <div className="section-title"><strong>TC-{String(i+1).padStart(2,"0")} · {name}</strong><button disabled={!!busy} onClick={()=>run([i+1])}>Chạy</button></div>
      {results[i+1]&&<div className={results[i+1].passed?"passed":"error"}><strong>{results[i+1].passed?"Đạt":"Lỗi"}</strong><pre>{results[i+1].log}</pre></div>}
    </article>)}</div></section>
    <section className="panel"><div className="section-title"><h2>Execution plan thực tế</h2><button className="primary" disabled={!!busy} onClick={async()=>{setBusy("plan");try{setPlans(await call("/admin/benchmark"));}finally{setBusy("");}}}>{busy==="plan"?"Đang đo…":"Đo Query A và B"}</button></div>
    <p className="muted">Cùng dữ liệu và biến bind. Ép FULL và INDEX, lấy ALLSTATS LAST từ Oracle.</p>
    {plans&&Object.entries(plans).map(([key,result])=><article key={key}><h3>Query {key} · {result.table} · ID {result.bind_id}</h3>
      <p>{result.result_match?"Kết quả hai cách khớp":"Kết quả cần kiểm tra"}</p><div className="plans">{result.plans.map(p=><div key={p.hint}><strong>{p.hint} · {p.buffer_gets} buffers · {p.elapsed_ms} ms</strong><pre>{p.plan}</pre></div>)}</div></article>)}</section>
  </>;
}

export function Admin({session,catalog,shows,refresh}) {
  const role=session.user.role.replace("ROLE_","");
  const token=session.token;
  const [data,setData]=useState({});
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [selected,setSelected]=useState("");
  const [filter,setFilter]=useState("");
  const [siteShow,setSiteShow]=useState("");
  const paths={
    EXECUTIVE:{summary:"/tong-quan",analytics:"/analytics",vouchers:"/voucher"},
    PROGRAMMING:{rooms:"/phong"}, CINEMA_MANAGER:{audit:"/nhat-ky"},
    CASHIER:{customers:"/khach-hang"}, CUSTOMER_SUPPORT:{customers:"/khach-hang"},
    MARKETING:{vouchers:"/voucher"}, ACCOUNTING:{summary:"/tong-quan",analytics:"/analytics",account:"/doi-soat"},
    IT_ADMIN:{system:"/ky-thuat",audit:"/nhat-ky"}
  };
  async function call(path,options) {
    setError("");
    try{return await api(path,token,options);}catch(e){setError(e.message);return null;}
  }
  async function reload(){
    try{
      const entries=Object.entries(paths[role]||{});
      const values=await Promise.all(entries.map(([,path])=>api("/admin"+path,token)));
      setData(Object.fromEntries(entries.map(([key],i)=>[key,values[i]])));
    }catch(e){setError(e.message);}
  }
  useEffect(()=>{reload();},[token]);

  function submit(path,transform=x=>x, method="POST") {
    return async e=>{
      e.preventDefault();
      const form=e.currentTarget;
      const result=await call(path,{method,body:transform(Object.fromEntries(new FormData(form)))});
      if(result){setMessage("Đã lưu dữ liệu trong Oracle.");reload();refresh();}
    };
  }

  return <main className="shell main admin">
    <p className="eyebrow">CỔNG NỘI BỘ · PHÂN QUYỀN ORACLE API</p><h1>{roles[role]}</h1><p className="muted">{session.user.email}</p>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status" className="passed">{message}</p>}
    {data.summary&&<div className="summary">{[["Đã thu",vnd(data.summary.da_thu)],["Đã hoàn",vnd(data.summary.da_hoan)],["Vé hiệu lực",data.summary.ve_hieu_luc],["Lấp đầy 7 ngày",(data.summary.lap_day_7_ngay??0)+"%"]].map(([k,v])=><article className="panel" key={k}><small>{k}</small><strong>{v}</strong></article>)}</div>}
    {["EXECUTIVE","ACCOUNTING"].includes(role)&&<Analytics data={data.analytics} catalog={catalog}/>}
    {role==="PROGRAMMING"&&<>
      <section className="panel"><h2>Tạo suất chiếu</h2>
      <form className="inline" onSubmit={submit("/admin/suat-chieu")}>
        <label>Phim<select name="ma_phim" required>{catalog.phim.map(f=><option key={f.ma_phim} value={f.ma_phim}>{f.ten_phim}</option>)}</select></label>
        <label>Phòng<select name="ma_phong" required>{data.rooms?.map(r=><option key={r.ma_phong} value={r.ma_phong}>{r.ten_rap} · {r.ten_phong} · {r.loai_phong}</option>)}</select></label>
        <label>Giờ bắt đầu<input name="gio_bat_dau" type="datetime-local" required/></label>
        <label>Giá cơ bản<input name="gia_co_ban" type="number" min="1" defaultValue="85000" required/></label><button className="primary">Lưu suất</button>
      </form><DataTable rows={shows.slice(0,20)} columns={[["ma_suat","Suất"],["ten_phim","Phim"],["ma_rap","Rạp"],["ten_phong","Phòng"],["gio_bat_dau","Bắt đầu",v=>dateLabel(v)+" "+clock(v)]]}/></section>
      <section className="panel"><h2>Thêm phim</h2>
      <form className="inline" onSubmit={submit("/admin/phim",x=>({...x,ngay_khoi_chieu:x.ngay_khoi_chieu+"T00:00:00"}))}>
        <label>Tên phim<input name="ten_phim" required/></label><label>Số phút<input name="thoi_luong_phut" type="number" min="1" required/></label>
        <label>Tuổi<select name="do_tuoi">{["P","T13","T16","T18"].map(r=><option key={r}>{r}</option>)}</select></label>
        <label>Khởi chiếu<input name="ngay_khoi_chieu" type="date" required/></label>
        <label>Thể loại<select name="ma_the_loai">{catalog.the_loai.map(g=><option value={g.ma_the_loai} key={g.ma_the_loai}>{g.ten_the_loai}</option>)}</select></label>
        <button className="primary">Lưu phim</button>
      </form></section>
    </>}
    {["CASHIER","CUSTOMER_SUPPORT"].includes(role)&&<>
      <section className="panel"><h2>Tra cứu khách hàng</h2><form className="inline" onSubmit={async e=>{
        e.preventDefault();const x=await call("/admin/khach-hang?q="+encodeURIComponent(filter));if(x)setData({...data,customers:x});
      }}><label>Tên, email hoặc số điện thoại<input value={filter} onChange={e=>setFilter(e.target.value)}/></label><button>Tìm</button></form>
      <label>Chọn khách<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn tài khoản</option>{data.customers?.map(c=><option value={c.ma_kh} key={c.ma_kh}>{c.ho_ten} · {c.email}</option>)}</select></label>
      {role==="CUSTOMER_SUPPORT"&&selected&&<form className="inline" onSubmit={submit("/admin/khach-hang/"+selected+"/hang",x=>x,"PUT")}><label>Hạng thành viên<select name="hang_thanh_vien">{["THUONG","BAC","VANG"].map(r=><option key={r}>{r}</option>)}</select></label><button>Cập nhật</button></form>}
      </section>
      {selected&&<Booking key={selected} catalog={catalog} shows={shows} session={session} customerId={selected} site={session.user.ma_rap}/>}
      {role==="CUSTOMER_SUPPORT"&&selected&&<History session={session} customerId={selected} canCancel={false}/>}
    </>}
    {role==="USHER"&&<ScanPanel call={call}/>}
    {role==="CINEMA_MANAGER"&&<>
      <section className="panel"><h2>Sơ đồ ghế tại rạp</h2>
        <select value={siteShow} aria-label="Chọn suất chiếu" onChange={e=>setSiteShow(e.target.value)}><option value="">Chọn suất</option>
        {shows.filter(s=>s.ma_rap===session.user.ma_rap).map(s=><option value={s.ma_suat} key={s.ma_suat}>{dateLabel(s.gio_bat_dau)} {clock(s.gio_bat_dau)} · {s.ten_phim} · {s.ten_phong}</option>)}</select>
        {siteShow&&<SeatMap showId={siteShow} readOnly/>}
      </section><section className="panel"><h2>Duyệt hủy vé ngoại lệ</h2><form className="inline" onSubmit={submit("/ve/huy",x=>({...x,ngoai_le:true}))}>
        <label>Mã vé<input name="ma_ve" type="number" min="1" required/></label><label>Lý do<input name="ly_do" required maxLength="300"/></label><button>Duyệt hủy</button>
      </form></section>
    </>}
    {["MARKETING","EXECUTIVE"].includes(role)&&<section className="panel"><h2>Ưu đãi</h2>
      {role==="MARKETING"&&<form className="inline" onSubmit={submit("/admin/voucher",x=>({...x,ma_code:x.ma_code.toUpperCase()}))}>
        <label>Mã<input name="ma_code" required maxLength="30"/></label>
        <label>Loại<select name="loai_giam"><option value="PHAN_TRAM">Phần trăm</option><option value="SO_TIEN">Số tiền</option></select></label>
        <label>Mức giảm<input type="number" name="gia_tri" min="1" required/></label>
        <label>Số lượt<input type="number" name="so_luot_toi_da" min="1" defaultValue="20" required/></label>
        <label>Hạn theo ngày<input type="number" name="so_ngay" min="1" max="365" defaultValue="30" required/></label><button className="primary">Tạo voucher</button>
      </form>}<DataTable rows={data.vouchers} columns={[["ma_code","Mã"],["loai_giam","Loại"],["gia_tri","Mức giảm"],["so_luot_da_dung","Đã dùng"],["so_luot_toi_da","Tối đa"],["ngay_ket_thuc","Đến ngày",dateLabel]]}/></section>}
    {role==="ACCOUNTING"&&<><section className="panel"><h2>Đối soát thanh toán</h2><DataTable rows={data.account?.giao_dich}/></section>
      <section className="panel"><h2>Hoàn tiền vé</h2><DataTable rows={data.account?.hoan_tien}/></section></>}
    {role==="IT_ADMIN"&&<TestPanel call={call} system={data.system} reload={reload}/>}
    {data.audit&&<section className="panel"><h2>Nhật ký trạng thái vé</h2><DataTable rows={data.audit}/></section>}
  </main>;
}
