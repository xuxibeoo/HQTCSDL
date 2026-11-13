// Read-only browser regression: restored demo identities, Lab labels and report SQL.
// Requires Playwright and a running local DEMO instance; does not execute business tests.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const base = (process.env.CINEMA_WEB_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const channel = process.env.CINEMA_BROWSER || 'msedge';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) {
  throw new Error('Only run this verifier against the local academic demo.');
}
const output = path.join(root, 'docs', 'qa-20261113', 'session-ui-results.json');
const results = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  browserChannel: channel,
  passed: false,
  auth: {},
  browser: [],
  sql: [],
  pageErrors: [],
  businessPosts: 0,
};
const normalize = text => text.replace(/\s+/g, ' ').trim();
const sessionLabel = 'Chuyển tài khoản demo';

function writeResults() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
}

function backendSql(name) {
  const source = fs.readFileSync(path.join(root, 'backend', 'main.py'), 'utf8');
  const start = source.indexOf('def ' + name + '(');
  assert(start >= 0, 'Missing backend report function: ' + name);
  const nextRoute = source.indexOf('\n@app', start);
  const body = source.slice(start, nextRoute < 0 ? undefined : nextRoute);
  const marker = body.indexOf(name === 'report_doanh_thu_ngay' ? 'return db.rows(cur, f' : 'sql = ');
  assert(marker >= 0, 'Missing SQL assignment: ' + name);
  const tripleQuote = '"'.repeat(3);
  const open = body.indexOf(tripleQuote, marker);
  const close = body.indexOf(tripleQuote, open + 3);
  assert(open >= 0 && close > open, 'Missing SQL string: ' + name);
  return body.slice(open + 3, close).replaceAll(
    '{db.NOW}', "cast(systimestamp at time zone 'Asia/Ho_Chi_Minh' as timestamp)"
  );
}

async function waitForRole(page, role) {
  await page.waitForFunction(({ label, role }) => {
    const select = document.querySelector('select[aria-label="' + label + '"]');
    return select && !select.disabled && select.value === role;
  }, { label: sessionLabel, role });
}

(async () => {
  const browser = await chromium.launch({ channel, headless: true });
  try {
    const requestContext = await browser.newContext();
    const health = await requestContext.request.get(base + '/api/health');
    assert.equal(health.status(), 200);
    assert.equal((await health.json()).demo, true, 'This verifier requires DEMO mode.');

    const anonymous = await requestContext.request.get(base + '/api/auth/me');
    assert.equal(anonymous.status(), 401);
    const login = await requestContext.request.post(base + '/api/auth/demo/CUSTOMER_2');
    assert.equal(login.status(), 200);
    const identity = await login.json();
    const valid = await requestContext.request.get(base + '/api/auth/me', {
      headers: { Authorization: 'Bearer ' + identity.token },
    });
    assert.equal(valid.status(), 200);
    const me = await valid.json();
    assert.equal(me.user.role, 'ROLE_CUSTOMER');
    for (const key of ['exp', 'sub', 'mat_khau_hash', 'token']) {
      assert.equal(key in me.user, false, 'Private field exposed in /auth/me: ' + key);
    }
    const invalid = await requestContext.request.get(base + '/api/auth/me', {
      headers: { Authorization: 'Bearer invalid-restarted-server-session' },
    });
    assert.equal(invalid.status(), 401);
    results.auth = {
      anonymousStatus: anonymous.status(),
      validStatus: valid.status(),
      invalidStatus: invalid.status(),
      publicUserKeys: Object.keys(me.user),
      noTokenOrHash: true,
    };
    await requestContext.close();

    let validPage;
    for (const scenario of ['valid', 'stale']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(({ user, token }) => {
        // Seed only the initial load; reload must validate the app's recovered session.
        if (sessionStorage.getItem('qa-auth-seeded')) return;
        sessionStorage.setItem('qa-auth-seeded', '1');
        sessionStorage.setItem('cinema', JSON.stringify({
          user: { ...user, ho_ten: 'UNTRUSTED_CACHED_NAME' }, token,
        }));
        sessionStorage.setItem('cinema-demo-role', 'CUSTOMER_2');
      }, {
        user: identity.user,
        token: scenario === 'valid' ? identity.token : 'invalid-restarted-server-session',
      });
      const page = await context.newPage();
      const calls = [];
      page.on('pageerror', error => results.pageErrors.push(error.message));
      page.on('response', response => {
        if (response.url().includes('/api/auth/')) {
          calls.push({ path: new URL(response.url()).pathname, status: response.status() });
        }
      });
      page.on('request', request => {
        // Every POST other than demo identity selection is a prohibited write here.
        const pathname = new URL(request.url()).pathname;
        if (request.method() === 'POST' && pathname.startsWith('/api/') &&
            !pathname.startsWith('/api/auth/demo/')) results.businessPosts++;
      });
      await page.goto(base + '/');
      await waitForRole(page, scenario === 'valid' ? 'CUSTOMER_2' : 'CUSTOMER_1');
      const state = await page.evaluate(() => {
        const saved = JSON.parse(sessionStorage.getItem('cinema'));
        return {
          role: sessionStorage.getItem('cinema-demo-role'),
          trustedNameRestored: saved.user.ho_ten !== 'UNTRUSTED_CACHED_NAME',
          stillInvalid: saved.token === 'invalid-restarted-server-session',
        };
      });
      assert.equal(state.trustedNameRestored, true);
      assert.equal(state.stillInvalid, false);
      if (scenario === 'valid') {
        assert.equal(calls.some(call => call.path.startsWith('/api/auth/demo/')), false);
        assert.equal(calls.filter(call => call.path === '/api/auth/me' && call.status === 200).length, 1);
        validPage = page;
      } else {
        assert.equal(calls.filter(call => call.path === '/api/auth/me' && call.status === 401).length, 1);
        assert.equal(calls.filter(call => call.path === '/api/auth/demo/CUSTOMER_1').length, 1);
        await page.reload();
        await waitForRole(page, 'CUSTOMER_1');
        assert.equal(calls.filter(call => call.path === '/api/auth/demo/CUSTOMER_1').length, 1);
        assert.equal(calls.filter(call => call.path === '/api/auth/me' && call.status === 200).length, 1);
      }
      results.browser.push({ scenario, ...state, calls: [...calls] });
      if (scenario === 'stale') await context.close();
    }

    const page = validPage;
    await page.getByLabel(sessionLabel).selectOption('IT_ADMIN');
    await page.getByRole('button', { name: 'Phòng Lab kiểm thử', exact: true }).click();
    await page.getByRole('button', { name: /9 Ca Kiểm Thử Tự Động/ }).click();
    const labels = await page.locator('.test-card-header strong').allTextContents();
    assert.equal(labels.length, 9);
    assert(labels[0].includes('+20%'));
    assert(labels[1].includes('Giữ trùng'));
    assert(labels[3].includes('Voucher 10%'));
    assert(labels[4].includes('Quá hạn'));
    results.labLabels = labels;

    await page.getByLabel(sessionLabel).selectOption('ACCOUNTING');
    await page.getByRole('button', { name: 'Báo cáo doanh thu', exact: true }).click();
    const reports = [
      ['Top 3 Phim (DENSE_RANK)', 'report_top_phim'],
      ['Doanh Thu & Lũy Kế (LAG / SUM)', 'report_doanh_thu_thang'],
      ['Doanh thu 30 ngày', 'report_doanh_thu_ngay'],
      ['Tỷ Lệ Lấp Đầy (RANK OVER)', 'report_lap_day_phong'],
    ];
    for (const [label, name] of reports) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('button', { name: 'Xem câu lệnh SQL (Oracle 23ai)', exact: true }).click();
      const displayed = await page.locator('.sql-modal-card .sql-pre code').innerText();
      assert.equal(normalize(displayed), normalize(backendSql(name)), 'SQL modal mismatch: ' + name);
      results.sql.push({ report: name, exactIgnoringWhitespace: true });
      await page.getByRole('button', { name: 'Đóng câu lệnh SQL', exact: true }).click();
    }
    assert.deepEqual(results.pageErrors, []);
    assert.equal(results.businessPosts, 0, 'Read-only verifier must not send business POSTs.');
    results.passed = true;
    writeResults();
    console.log(JSON.stringify({
      passed: true, auth: results.auth, browserScenarios: results.browser,
      sql: results.sql, labLabelsConfirmed: true, pageErrors: results.pageErrors,
      businessPosts: results.businessPosts,
      receipt: path.relative(root, output),
    }));
  } finally {
    await browser.close();
  }
})().catch(error => {
  results.error = error.message;
  writeResults();
  console.error(error.message);
  process.exitCode = 1;
});
