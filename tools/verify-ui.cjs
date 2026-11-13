const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

async function screenshot(page, name, locator) {
  if (!process.env.CINEMA_SCREENSHOTS) return;
  const options = { path: path.join(process.env.CINEMA_SCREENSHOTS, name+".png"), animations:"disabled" };
  if (locator) await locator.screenshot({ ...options, style: ".topbar { visibility: hidden !important; }" });
  else await page.screenshot(options);
}

async function main() {
  const browser = await chromium.launch({ channel:"chrome", headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(process.env.CINEMA_WEB_URL || "http://127.0.0.1:8080");
    await page.getByRole("heading",{name:"Vệt sáng cuối trời",exact:true}).first().waitFor();
    assert(await page.locator(".hero-backdrop").evaluate(async image=>{await image.decode();return image.naturalWidth===1600;}));
    await screenshot(page,"01-trang-chu");
    await page.getByRole("button",{name:"Phim nổi bật tiếp theo"}).click();
    await page.getByRole("heading",{name:"Đường đua nửa đêm",level:1}).waitFor();
    await page.getByRole("button",{name:"Phim nổi bật trước"}).click();
    await page.getByRole("button",{name:"Chi tiết phim",exact:true}).click();
    await page.getByRole("dialog",{name:"Chi tiết Vệt sáng cuối trời"}).waitFor();
    await page.getByRole("button",{name:"Yêu thích phim này"}).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button",{name:"Phim yêu thích",exact:true}).click();
    assert.equal(await page.locator(".movie-card").count(),1);
    await page.getByRole("searchbox",{name:"Tìm phim"}).fill("duong dua");
    assert.equal(await page.locator(".movie-card").count(),1);
    await page.getByRole("searchbox",{name:"Tìm phim"}).fill("");
    await page.getByRole("button",{name:"GIAM10 · Dùng mã"}).click();
    const role = page.getByLabel("Chuyển vai trò demo");
    await role.selectOption("CUSTOMER");
    await page.getByRole("button",{name:"Vé của tôi"}).waitFor();
    const base = new URL(page.url()).origin;
    const shows = await (await page.request.get(base+"/api/suat-chieu")).json();
    const show = shows.find(s => s.ma_rap===1 && Date.parse(s.gio_bat_dau+"+07:00")-Date.now()>3*3600000);
    assert(show, "Cần suất rạp 1 còn hơn 3 giờ");
    await page.getByLabel("01 · Phim").selectOption(String(show.ma_phim));
    await page.getByLabel("02 · Rạp").selectOption(String(show.ma_rap));
    await page.getByLabel("03 · Ngày").selectOption(show.gio_bat_dau.slice(0,10));
    await page.getByLabel("04 · Suất").selectOption(String(show.ma_suat));
    await page.locator(".seat.standard").first().click();
    await page.locator(".seat.vip").first().click();
    await page.getByLabel(/^Combo/).selectOption({index:1});
    assert.equal(await page.getByLabel("Mã ưu đãi").inputValue(),"GIAM10");
    await screenshot(page,"02-chon-ghe",page.locator("#booking"));
    await page.getByRole("button",{name:"Giữ ghế 10 phút"}).click();
    await page.getByRole("heading",{name:"Đang giữ ghế"}).waitFor();
    await page.getByRole("button",{name:"Xác nhận thanh toán demo"}).click();
    const paid = page.getByRole("heading",{name:/Đã thanh toán · Đơn #/});
    await paid.waitFor();
    const orderId = (await paid.textContent()).match(/#(\d+)/)[1];
    await page.getByAltText("Mã QR soát vé").first().waitFor();
    await screenshot(page,"03-ve-qr",page.locator("#booking"));
    const qr = await page.locator(".ticket .code").first().textContent();
    await page.getByRole("button",{name:"Vé của tôi"}).click();
    await page.locator(".order-list button").filter({hasText:"Đơn #"+orderId+" ·"}).click();
    page.once("dialog",d=>d.accept());
    await page.getByRole("button",{name:"Yêu cầu hủy vé"}).last().click();
    await page.locator(".ticket").filter({hasText:"DA_HUY"}).waitFor();
    await role.selectOption("USHER");
    await page.getByLabel("Mã QR",{exact:true}).fill(qr);
    await page.getByRole("button",{name:"Kiểm tra vé"}).click();
    await page.getByText("HỢP LỆ",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Kiểm tra vé"}).click();
    await page.getByText("ĐÃ SỬ DỤNG",{exact:true}).waitFor();
    await role.selectOption("IT_ADMIN");
    await page.getByRole("heading",{name:"Kiểm thử PL/SQL"}).waitFor();
    await page.locator(".test-list article").filter({hasText:"TC-03"}).getByRole("button",{name:"Chạy",exact:true}).click();
    await page.getByText(/B nhận ORA-20021/).waitFor();
    await screenshot(page,"04-hai-phien-f5",page.locator(".test-list article").filter({hasText:"TC-03"}));
    await page.getByRole("button",{name:"Đo Query A và B"}).click();
    await page.getByRole("heading",{name:/Query B ·/}).waitFor();
    await screenshot(page,"05-execution-plan",page.getByRole("heading",{name:"Execution plan thực tế"}).locator("../.."));
    const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
    await mobile.goto(base);
    await mobile.getByRole("heading",{name:"Vệt sáng cuối trời",level:1}).waitFor();
    assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"Trang mobile bị tràn ngang");
    await screenshot(mobile,"06-trang-chu-mobile");
    assert.deepEqual(errors, []);
    console.log("UI passed: catalog, seat map, hold, combo, promotion, payment, QR, refund, scan twice, TC-03.");
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
