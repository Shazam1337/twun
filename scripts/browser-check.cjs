const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const baseURL = process.env.PAIR_URL || 'http://127.0.0.1:3000';
const output = path.resolve('artifacts');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, a + ' != ' + b);
const LIVE = 'pair-perps-twelve-v3';
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const options = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce' };
  const checks = [], errors = [], posts = [];
  const check = name => { checks.push(name); console.log('PASS:', name); };
  const watch = page => { page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); }); };
  const capture = async (page, name) => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(output, name + '-1440.png'), fullPage: true, animations: 'disabled' }); };
  let page;
  try {
    // First context: ACTUAL application endpoint. Screenshots never use fixture prices.
    const real = await browser.newContext(options);
    page = await real.newPage(); watch(page);
    const actual = await (await page.request.get(baseURL + '/api/market')).json();
    console.log('Actual API status:', actual.status, 'snapshot available:', Boolean(actual.snapshot));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Trade stocks against stocks.' }).waitFor();
    const headerSignature = () => page.locator('.odado-header').evaluate(el => {
      const style = getComputedStyle(el), box = el.getBoundingClientRect();
      return { height: box.height, width: box.width, background: style.backgroundColor, padding: style.padding, font: style.fontFamily, brand: el.querySelector('.odado-brand').textContent };
    });
    const sharedHeader = await headerSignature();
    await page.locator('.odado-header').evaluate(el => { el.dataset.persistenceCheck = 'same-header'; });
    assert.equal(await page.locator('header').count(), 1);
    assert.match(await page.title(), /Odado/);
    assert.ok(!/\\bPAIR\\b/.test(await page.locator('body').innerText()));
    await capture(page, 'market-landing');
    await page.screenshot({ path: path.join(output, 'odado-overview-1440x900.png'), animations: 'disabled' });
    await page.getByRole('link', { name: 'Launch app', exact: true }).click();
    await page.getByText('No open positions', { exact: true }).waitFor();
    assert.deepEqual(await headerSignature(), sharedHeader);
    assert.equal(await page.locator('.odado-header').getAttribute('data-persistence-check'), 'same-header');
    assert.equal(await page.getByRole('link', { name: 'Trade', exact: true }).getAttribute('aria-current'), 'page');
    if (actual.status === 'not_configured') {
      await page.getByRole('status').filter({ hasText: 'Market data not configured' }).waitFor();
      assert.equal(await page.getByTestId('current-ratio').innerText(), '—');
      assert.ok(await page.getByRole('button', { name: 'Market data unavailable / closed' }).isDisabled());
      assert.equal(actual.snapshot, null);
      check('Actual API without key: explicit not-configured state, no invented quotes, trading disabled');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);
    await page.getByRole('link', { name: 'Odado home' }).waitFor();
    assert.equal(await page.getByText('Trade the relationship.', { exact: true }).count(), 0);
    assert.ok((await page.locator('.odado-chart, .odado-chart-empty').boundingBox()).height >= 420);
    near((await page.getByRole('complementary', { name: 'Open demo position' }).boundingBox()).width, 340);
    await page.getByRole('button', { name: 'Choose market' }).click();
    await page.getByText('Available market', { exact: true }).waitFor();
    await page.locator('#odado-pair-menu button').click();
    await page.getByRole('tab', { name: /^History/ }).click();
    await page.getByText('No demo activity yet', { exact: true }).waitFor();
    await page.getByRole('tab', { name: /^Positions/ }).click();
    for (const period of ['1D', '7D', '30D']) {
      const button = page.getByRole('button', { name: period, exact: true });
      await button.click(); assert.equal(await button.getAttribute('aria-pressed'), 'true');
    }
    if (actual.histories['1day']?.points?.length) {
      const chart = await page.locator('.odado-chart').boundingBox();
      await page.mouse.move(chart.x + chart.width * .55, chart.y + 180);
      await page.locator('.odado-chart-tooltip').waitFor();
      await page.mouse.move(15, 80);
    }
    await page.locator('.odado-demo-controls summary').click();
    assert.equal(await page.getByRole('button', { name: 'Advance 8h', exact: true }).isVisible(), true);
    await page.locator('.odado-demo-controls summary').click();
    await capture(page, 'market-terminal');
    await page.screenshot({ path: path.join(output, 'odado-trade-1440x900.png'), fullPage: false, animations: 'disabled' });
    check('ODADO at 1440×900: 420px chart, 340px order form, real-data tooltip, period/pair selectors, activity tabs, collapsed demo controls');
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Connect an EVM wallet' });
    await dialog.getByRole('status').filter({ hasText: 'No EVM wallet detected' }).waitFor();
    await dialog.getByRole('button', { name: 'Close wallet menu' }).click();
    await page.getByRole('link', { name: 'Portfolio', exact: true }).click();
    await page.getByRole('heading', { name: 'Your ratio positions.' }).waitFor();
    assert.deepEqual(await headerSignature(), sharedHeader);
    assert.equal(await page.locator('.odado-header').getAttribute('data-persistence-check'), 'same-header');
    assert.equal(await page.locator('header').count(), 1);
    assert.equal(await page.getByRole('link', { name: 'Portfolio', exact: true }).getAttribute('aria-current'), 'page');
    assert.ok(!/\\bPAIR\\b/.test(await page.locator('body').innerText()));
    await capture(page, 'market-portfolio');
    await page.screenshot({ path: path.join(output, 'odado-portfolio-1440x900.png'), animations: 'disabled' });
    check('Identical persistent Odado header on all three pages; active navigation, metadata and no old brand in visible text');
    check('Actual landing, terminal, portfolio at 1440px; EVM wallet absent-extension UI');
    await real.close();

    // Isolated TEST-ONLY route fixtures exercise recovery and accounting without provider access.
    const context = await browser.newContext(options);
    const legacy = JSON.stringify({ version: 2, freeUsdc: 42, mark: .5, positions: [{ id: 'archived-position' }], history: [{ id: 'archived-trade' }] });
    await context.addInitScript(value => { if (!localStorage.getItem('pair-perps-demo-v2')) localStorage.setItem('pair-perps-demo-v2', value); }, legacy);
    let timestamp = Date.UTC(2026, 8, 24, 16), ratio = .5, status = 'ready', open = true;
    const fixture = () => {
      const q = symbol => ({ symbol, currency: 'USD', price: symbol === 'NVDA' ? ratio * 200 : 200, timestamp, marketOpen: open });
      const points = [.48, .49, .5].map((value, i) => ({ timestamp: timestamp - (3-i) * 86400000, value, label: 'Test fixture ' + i }));
      return { status, message: status === 'ready' ? 'AUTOMATED TEST FIXTURE — NOT MARKET DATA' : 'Test fixture failure: ' + status, snapshot: { id: timestamp + ':' + ratio, source: 'Twelve Data / US equities', nvda: q('NVDA'), tsla: q('TSLA'), ratio, timestamp, fetchedAt: timestamp }, serverTime: timestamp, canTrade: status === 'ready' && open, session: { state: open ? 'open' : 'closed', date: '2026-09-24', closesAt: timestamp + 14400000, label: open ? 'Market open · TEST FIXTURE' : 'Market closed · TEST FIXTURE' }, histories: { '1day': { interval: '1day', fetchedAt: timestamp, points, unmatched: 0, status: 'ready' }, '5min': { interval: '5min', fetchedAt: timestamp, points, unmatched: 0, status: 'ready' } }, retryAt: timestamp + 120000 };
    };
    await context.route('**/api/market', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture()) }));
    page = await context.newPage(); watch(page);
    await page.goto(baseURL + '/trade', { waitUntil: 'networkidle' });
    await page.getByText('Your synthetic v2 account is archived separately', { exact: false }).waitFor();
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), LIVE);
    await page.getByRole('button', { name: 'Review Long', exact: true }).waitFor();
    const s0 = await state(); assert.equal(s0.version, 3); assert.equal(s0.positions.length, 0); near(s0.freeUsdc, 10000);
    assert.equal(await page.evaluate(() => localStorage.getItem('pair-perps-demo-v2-archive')), legacy);
    assert.equal(await page.evaluate(() => localStorage.getItem('pair-perps-demo-v2')), legacy);
    await page.getByRole('button', { name: 'Dismiss archive notice' }).click();
    assert.equal(await page.locator('.odado-archive-notice').count(), 0);
    check('TEST FIXTURE: v2 retained + archived byte-for-byte; clean independent v3 account; dismissible notice');
    const margin = page.getByRole('textbox', { name: 'Isolated margin', exact: true });
    await margin.fill('0'); assert.ok(await page.getByRole('button', { name: 'Minimum margin 1 USDC' }).isDisabled());
    await margin.fill('10000'); assert.ok(await page.getByRole('button', { name: 'Insufficient demo USDC' }).isDisabled());
    await margin.fill('100');
    await page.getByRole('button', { name: 'Review Long', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Long', exact: true }).click();
    await page.getByTestId('position-row').waitFor();
    let s = await state(); near(s.freeUsdc, 9899.75); near(s.positions[0].notional, 500);
    assert.equal(s.positions[0].dataSource, 'Twelve Data / US equities');
    assert.equal(s.positions[0].entryIndexTime, timestamp);
    const update = async (value, newStatus = 'ready', marketOpen = true) => {
      ratio = value; status = newStatus; open = marketOpen; timestamp += 120000;
      await page.getByRole('button', { name: 'Refresh market data' }).click();
      await page.waitForResponse(r => r.url().endsWith('/api/market'));
      await page.waitForTimeout(150);
    };
    await update(.1, 'partial');
    assert.ok(await page.getByRole('button', { name: 'Close', exact: true }).isDisabled());
    assert.deepEqual(await state(), s);
    await update(.1, 'quota_exhausted'); assert.deepEqual(await state(), s);
    await update(.1, 'stale'); assert.deepEqual(await state(), s);
    assert.equal(await page.locator('.odado-feed-alert').isVisible(), true);
    await update(.1, 'ready', false); assert.deepEqual(await state(), s);
    await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await state(), s);
    check('TEST FIXTURE: partial/429/closed + reload preserve positions/mark; close blocked, no liquidation');
    await update(.55);
    await page.getByTestId('position-pnl').filter({ hasText: '+50.00' }).waitFor();
    await page.locator('.odado-demo-controls summary').click();
    await page.getByRole('button', { name: 'Advance 8h', exact: true }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).positions[0].funding === .05, LIVE);
    s = await state(); near(s.positions[0].funding, .05);
    await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await state(), s);
    await page.getByRole('link', { name: 'Portfolio', exact: true }).click();
    await page.getByTestId('position-pnl').filter({ hasText: '+50.00' }).waitFor();
    assert.equal(await page.getByTestId('portfolio-free').innerText(), '9,899.75 USDC');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm close', exact: true }).click();
    await page.getByText('No open positions', { exact: true }).waitFor();
    near((await state()).freeUsdc, 10049.45);
    check('TEST FIXTURE: recovery +50 gross; funding .05, both fees .50; close +49.45 net; reload and portfolio consistent');
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
    await page.getByText('No demo activity yet', { exact: true }).waitFor(); near((await state()).freeUsdc, 10000);
    assert.equal(await page.evaluate(() => localStorage.getItem('pair-perps-demo-v2')), legacy);
    assert.equal(await page.evaluate(() => localStorage.getItem('pair-perps-demo-v2-archive')), legacy);
    assert.deepEqual(posts, []); assert.deepEqual(errors, []);
    check('No execution POSTs or uncaught browser errors; reset preserves archives; no actual wallet approval tested');
    await fs.writeFile(path.join(output, 'market-browser-results.json'), JSON.stringify({ actualApiStatus: actual.status, actualProviderVerified: actual.status === 'ready' && Boolean(actual.snapshot), fixtureTestsOnly: true, width: 1440, checks, errors, posts, wallet: 'EVM wallet absent; real connection not verified.' }, null, 2));
    await context.close();
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'market-test-failure.png'), fullPage: true }).catch(() => {});
    console.error(errors); console.error(error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
