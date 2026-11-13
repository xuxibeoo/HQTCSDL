const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const base = process.env.CINEMA_WEB_URL || 'http://127.0.0.1:8080';
const screenshots = process.env.CINEMA_SCREENSHOTS;
const channel = process.env.CINEMA_BROWSER || 'chrome';

async function main() {
  const browser = await chromium.launch({ channel, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const result = (pattern, action, method='POST') => Promise.all([
    page.waitForResponse(r => pattern.test(new URL(r.url()).pathname) && r.request().method() === method),
    action(),
  ]).then(([r]) => r);
  const button = name => page.getByRole('button', { name }).first();
  const nav = name => page.getByRole('navigation', { name: 'Điều hướng chính đồ án' }).getByRole('button', { name });
  const role = page.getByLabel('Chuyển tài khoản demo');
  async function shot(name, target=page) {
    if (!screenshots) return;
    await fs.mkdir(screenshots, { recursive: true });
    await target.screenshot({ path: path.join(screenshots, `${name}.png`), animations: 'disabled',
      ...(typeof target.viewportSize === 'function' ? {} : { style: '.galaxy-topbar, .live-inspector-drawer { visibility: hidden !important; }' }) });
  }
  async function selectRole(roleName) {
    const r = await result(new RegExp(`/api/auth/demo/${roleName}$`), () => role.selectOption(roleName));
    assert(r.ok(), `${roleName}: HTTP ${r.status()}`);
  }
  try {
    const h = await page.request.get(`${base}/api/health`);
    assert(h.ok());
    assert.match((await h.json()).oracle, /^23\./);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.galaxy-hero h1').waitFor();
    await role.locator('option[value=CUSTOMER_2]').waitFor({ state: 'attached' });
    await shot('01-trang-chu');
    await selectRole('CUSTOMER_1');
    await nav(/Đặt vé xem phim/i).click();

    const shows = await (await page.request.get(`${base}/api/suat-chieu`)).json();
    const far = shows.find(s => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s.gio_bat_dau) ? s.gio_bat_dau : `${s.gio_bat_dau}+07:00`).getTime() - Date.now() > 3*3600000);
    assert(far, 'No test show more than three hours away');
    const filters = page.locator('.booking-filter-bar select');
    await filters.nth(0).selectOption(String(far.ma_rap));
    await filters.nth(1).selectOption(String(far.ma_phim));
    await filters.nth(3).selectOption(far.gio_bat_dau.slice(0,10));
    const uniqueShow = page.locator(`.showtime-pill[data-show-id="${far.ma_suat}"]`);
    if (await uniqueShow.count()) await uniqueShow.click();
    else await page.locator('.showtime-pill').filter({ hasText: far.gio_bat_dau.slice(11,16) }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('.seat-btn').length === 100);
    await page.locator('.seat-btn:not([disabled])').filter({ hasText: /^A\d+$/ }).first().click();
    await page.locator('.seat-btn:not([disabled])').filter({ hasText: /^J\d+$/ }).first().click();
    await page.locator('.combo-select').selectOption({ index: 1 });
    await button(/GIAM10/).click();
    await shot('02-so-do-ghe', page.locator('.seat-map-box'));
    const hold = await result(/\/api\/(don-dat-ve|dat-ve\/giu-cho)$/, () => button(/GIỮ (CHỖ|GHẾ)/i).click());
    assert(hold.ok(), `Hold: ${await hold.text()}`);
    const order = await hold.json();
    assert(order.han_thanh_toan);
    const pay = await result(/\/api\/(don-dat-ve\/\d+\/thanh-toan|dat-ve\/thanh-toan)$/, () => button(/XÁC NHẬN THANH TOÁN/i).click());
    assert(pay.ok(), `Pay: ${await pay.text()}`);
    const paid = await pay.json();
    const tickets = paid.tickets || paid.ve;
    assert(tickets?.length >= 2 && tickets[0].ma_qr);
    await page.getByRole('heading', { name: /Thanh toán thành công/i }).waitFor();
    await shot('03-ve-qr', page.locator('.tickets-completed-section'));
    await nav(/Vé của tôi/i).click();
    const orderCard = page.locator('.order-block').filter({ hasText: new RegExp(`#${order.ma_don}\\b`) });
    await orderCard.waitFor();
    page.once('dialog', d => d.accept());
    const refund = await result(/\/api\/ve\/(\d+\/)?huy$/, () => orderCard.getByRole('button', { name: /Hủy vé/i }).last().click());
    assert(refund.ok(), `Refund: ${await refund.text()}`);

    await selectRole('USHER');
    await nav(/Soát vé QR/i).click();
    await page.getByLabel('Mã QR', { exact: true }).fill(tickets[0].ma_qr);
    const scan = await result(/\/api\/soat-ve(\/quet-qr)?$/, () => button(/Kiểm tra vé/i).click());
    assert.equal((await scan.json()).ket_qua, 'CHUA_DEN_GIO');
    await page.getByText(/CHƯA ĐẾN GIỜ CHIẾU/).first().waitFor();

    await selectRole('IT_ADMIN');
    await nav(/Báo cáo doanh thu/i).click();
    await page.locator('.btn-sql-inspect').first().click();
    await page.getByText(/DENSE_RANK\(\)/).first().waitFor();
    await page.getByRole('button', { name: 'Đóng câu lệnh SQL' }).click();
    await nav(/Phòng Lab kiểm thử/i).click();
    const bad = await result(/\/api\/lab\/them-suat-chieu$/, () => button(/Test Trùng Giờ Chiếu/i).click());
    assert.equal(bad.status(), 409);
    await page.getByText(/ORA-20031/).last().waitFor();
    await shot('04-lab-trigger');
    await page.getByRole('complementary', { name: /Oracle 23ai Live SQL Inspector/i }).getByText(/Oracle 23ai Live Transaction Inspector/i).waitFor();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(base, { waitUntil: 'domcontentloaded' });
    await mobile.locator('.galaxy-hero h1').waitFor();
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page overflows horizontally');
    const inspector = mobile.getByRole('button', { name: 'Mở rộng Inspector' });
    assert(await inspector.evaluate(el => el.getBoundingClientRect().right <= innerWidth), 'Mobile inspector controls are clipped');
    await inspector.click();
    await mobile.getByRole('button', { name: 'Thu nhỏ Inspector' }).click();
    await shot('05-trang-chu-mobile', mobile);
    assert.deepEqual(errors, [], 'Unexpected browser exceptions');
    console.log('Browser verified: five modules, three demo sessions, 100-seat map, combo/voucher, hold/payment/QR/refund, early QR rejection, reports, trigger and mobile.');
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
