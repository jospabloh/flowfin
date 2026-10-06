// Layout scan: overlapping interactive elements, horizontal overflow, clipped
// button text and controls covered by something else, at phone/tablet/desktop
// widths. Starts vite itself and fulfils EVERY /api/ request locally.
// Usage: node scripts/layout-overlap-scan.mjs [--json out.json] [--shots dir] [--width 390,768]
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const VIEWPORTS = (argOf('--width') ? argOf('--width').split(',').map((w) => [Number(w), 800]) : [
  [320, 640], [390, 844], [768, 1024], [834, 1194], [1024, 1366], [1024, 768], [1440, 900],
]);
const SHOTS = process.env.SHOT_DIR || null;
const ONLY = argOf('--only');
const NOW = '2026-10-01T12:00:00.000Z';
const FAM = 'fam1';

const USER = { id: 'u1', email: 'dueno@example.invalid', full_name: 'Dueño Prueba', role: 'user', data: { family_id: FAM } };
const d = (extra) => ({ created_date: NOW, updated_date: NOW, family_id: FAM, ...extra });
const names = ['Alimentos', 'Transporte', 'Casa', 'Salud', 'Educación', 'Ocio'];
const DB = {
  FamilyMembership: [d({ id: 'm1', user_id: 'u1', user_email: USER.email, status: 'approved', role: 'admin', person_id: 'p1', tutorial_state: { status: 'skipped' } })],
  Family: [d({ id: FAM, name: 'Familia de prueba', billing_status: 'active', license_plan: 'home', licensed_member_limit: 4, currency: 'MXN', admin_user_id: 'u1' })],
  FamilyConfig: [d({ id: 'fc1', currency: 'MXN', currency_symbol: '$' })],
  Category: names.map((n, i) => d({ id: `c${i}`, name: n, type: i === 5 ? 'income' : 'expense', icon: '🛒', active: true })),
  Subcategory: [d({ id: 'sc1', name: 'Súper', category_id: 'c0', active: true })],
  Person: [d({ id: 'p1', name: 'Pablo', active: true }), d({ id: 'p2', name: 'Ana', active: true })],
  PaymentMethod: [d({ id: 'pm1', name: 'Tarjeta de crédito BBVA', type: 'credit', active: true }), d({ id: 'pm2', name: 'Efectivo', type: 'cash', active: true })],
  Transaction: Array.from({ length: 12 }, (_, i) => d({ id: `t${i}`, date: `2026-10-0${(i % 9) + 1}`, amount: 150 + i * 37, type: i % 5 ? 'expense' : 'income', description: `Compra de prueba con descripción larga número ${i}`, category_id: `c${i % 5}`, person_id: 'p1', payment_method_id: 'pm1', status: 'posted' })),
  CategoryBudget: [d({ id: 'b1', category_id: 'c0', amount: 3000, month: '2026-10' })],
  Goal: [d({ id: 'g1', name: 'Vacaciones', target_amount: 20000, current_amount: 5000, status: 'active' })],
  Investment: [d({ id: 'i1', name: 'Local 09 Albaserrada con nombre largo', total_amount: 100000, status: 'active', installments: 18, installment_amount: 5000 })],
  InvestmentPayment: [], MSI: [d({ id: 'ms1', description: 'Laptop', total_amount: 12000, months: 12, status: 'active' })], MSIPayment: [],
  RentalProperty: [d({ id: 'r1', name: 'Depto Centro', monthly_rent: 8000, active: true })], RentalPayment: [],
  ScheduledPayment: [d({ id: 'sp1', name: 'Netflix', amount: 219, due_day: 5, frequency: 'monthly', active: true, category_id: 'c5' })],
  ScheduledPaymentRecord: [], Trip: [], SupportTicket: [], RolePermission: [], Message: [], WaitlistEntry: [],
};

const SCREENS = ['Dashboard', 'Capture', 'Assistant', 'Transactions', 'Reports', 'Investments', 'MSI', 'Rentals', 'Catalogs', 'FamilySettings', 'AccountSettings', 'FamilyAdmin', 'ScheduledPayments', 'Messages', 'Budget', 'Trips', 'SavingsDashboard', 'Goals', 'SupportTickets', 'About', 'UserManual'];

function match(row, q) {
  return Object.entries(q || {}).every(([k, v]) => (v && typeof v === 'object') ? true : row[k] === undefined || String(row[k]) === String(v));
}
async function mock(ctx) {
  // Nothing external (fonts, images, analytics) is fetched.
  await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
  await ctx.route((u) => u.pathname.startsWith('/api/') || /socket\.io/.test(u.href), async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
    const json = (x, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(x) });
    if (/socket\.io/.test(url.href)) return route.abort();
    if (p.includes('public-settings')) return json({ id: 'mockapp', public_settings: {} });
    if (p.endsWith('/entities/User/me')) return json(USER);
    let m = p.match(/\/entities\/(\w+)(?:\/(\w+))?$/);
    if (m) {
      const rows = DB[m[1]] || [];
      if (req.method() !== 'GET') return json({ id: `mock_${Date.now()}` });
      if (m[2]) return json(rows.find((r) => r.id === m[2]) || {});
      let q = {}; try { q = JSON.parse(url.searchParams.get('q') || '{}'); } catch { /* */ }
      return json(rows.filter((r) => match(r, q)));
    }
    m = p.match(/\/functions\/(\w+)/);
    if (m) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* */ }
      if (m[1] === 'family') {
        if (body.action === 'getMyMembership') return json({ membership: DB.FamilyMembership[0] });
        if (body.action === 'getMyFamily') return json({ family: DB.Family[0] });
        if (body.action === 'getFamilyLicenseInfo') return json({ billingStatus: 'active', isReadOnly: false, licensePlan: 'home', licensedMemberLimit: 4, activeMemberCount: 2 });
      }
      return json({ ok: true, data: [], rows: [] });
    }
    if (/\/agents\/conversations/.test(p)) return json(req.method() === 'GET' ? [] : { id: 'conv1', messages: [] });
    return json({ ok: true });
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=menuitem], [role=combobox], [role=checkbox], [role=radio]';
    const label = (el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`;
    const modal = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]');
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' || +cs.opacity === 0) return false;
      if (el.closest('[aria-hidden="true"],[inert]')) return false;
      if (modal && !modal.contains(el) && !el.closest('[data-theme-switcher]')) return false;
      // clipped by an overflow:hidden/scroll ancestor => not actually visible
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const c = getComputedStyle(a);
        if (/(hidden|auto|scroll|clip)/.test(c.overflowX + c.overflowY)) {
          const ar = a.getBoundingClientRect();
          if (r.right <= ar.left + 1 || r.left >= ar.right - 1 || r.bottom <= ar.top + 1 || r.top >= ar.bottom - 1) return false;
        }
      }
      return true;
    };
    // /Assistant is a deliberate full-screen takeover on phones (z-45 over the bottom nav).
    const takeover = location.pathname === '/Assistant' && innerWidth < 768;
    const els = [...document.querySelectorAll(SEL)].filter(vis).filter((e) => !(takeover && e.closest('nav.fixed')));
    const out = { overlaps: [], covered: [], clipped: [], overflowX: null };
    const sw = document.documentElement.scrollWidth;
    if (sw > innerWidth + 1) out.overflowX = `scrollWidth ${sw} > ${innerWidth}`;
    const rect = (e) => e.getBoundingClientRect();
    // Scrolling content passing under a fixed bar is normal; only compare
    // elements living in the same layer (both fixed, or both in the page flow).
    const fixedRoot = (e) => { for (let a = e; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return a; return null; };
    const layer = (e) => (fixedRoot(e) ? 'fixed' : 'flow');
    const sig = new Set();
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (a.closest('label') && a.closest('label') === b.closest('label')) continue;
      if (layer(a) !== layer(b)) continue;
      // A button deliberately embedded in a field (absolute, same wrapper) is not an overlap.
      const embedded = (f, btn) => /^(INPUT|TEXTAREA)$/.test(f.tagName) && f.parentElement.contains(btn) && getComputedStyle(btn.closest('.absolute') || btn).position === 'absolute';
      if (embedded(a, b) || embedded(b, a)) continue;
      const ra = rect(a), rb = rect(b);
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 3 && h > 3) { const k = label(a) + '|' + label(b); if (!sig.has(k)) { sig.add(k); out.overlaps.push(`${label(a)} x ${label(b)} (${Math.round(w)}x${Math.round(h)})`); } }
    }
    for (const el of els) {
      const r = rect(el);
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const at = document.elementFromPoint(cx, cy);
      if (at && !(takeover && at.closest('nav.fixed')) && layer(at) === layer(el) && at !== el && !el.contains(at) && !at.contains(el) && !(el.closest('label') && el.closest('label').contains(at))) out.covered.push(`${label(el)} covered by ${label(at)}`);
      if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.clipped.push(label(el));
    }
    return out;
  });
}

async function main() {
  const server = await createServer({ server: { port: 5600 + Math.floor(Math.random() * 300), strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-proxy-server'] });
  if (SHOTS) await mkdir(SHOTS, { recursive: true });
  const report = [];
  const rec = async (page, vw, name, extra = '') => {
    const r = await measure(page); r.vw = vw; r.name = name;
    report.push(r);
    const bad = r.overlaps.length + r.covered.length + r.clipped.length + (r.overflowX ? 1 : 0);
    console.log(`${bad ? 'FAIL' : 'ok  '} ${vw.join('x')} ${name}${extra}`);
    for (const k of ['overlaps', 'covered', 'clipped']) for (const s of r[k]) console.log(`      ${k}: ${s}`);
    if (r.overflowX) console.log(`      overflowX: ${r.overflowX}`);
    if (bad && SHOTS) await page.screenshot({ path: `${SHOTS}/${vw[0]}x${vw[1]}-${name.replace(/\W+/g, '_')}.png` });
  };
  try {
    for (const vw of VIEWPORTS) {
      const touch = vw[0] < 1024 || vw[1] > vw[0];
      const ctx = await browser.newContext({ viewport: { width: vw[0], height: vw[1] }, deviceScaleFactor: 1, hasTouch: touch, isMobile: vw[0] < 768, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
      await ctx.addInitScript(() => { localStorage.setItem('base44_access_token', 'mock'); localStorage.setItem('theme', 'light'); });
      ctx.setDefaultNavigationTimeout(120000); ctx.setDefaultTimeout(30000);
      await mock(ctx);
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
      // login (signed out)
      {
        const c2 = await browser.newContext({ viewport: { width: vw[0], height: vw[1] }, locale: 'es-MX' });
        c2.setDefaultNavigationTimeout(120000);
        await mock(c2); const p2 = await c2.newPage();
        for (const route of ['login', 'register', 'forgot-password']) {
          await p2.goto(`${base}/${route}`, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(900); await rec(p2, vw, route);
        }
        await c2.close();
      }
      for (const s of SCREENS) {
        if (ONLY && s !== ONLY) continue;
        errs.length = 0;
        await page.goto(`${base}/${s}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(700);
        await rec(page, vw, s, errs.length ? ` [errors: ${errs.join('; ')}]` : '');
        // open the first "add" style button to inspect the dialog
        const add = page.getByRole('button', { name: /^(\+\s*)?(nuev[oa]|agregar|añadir|crear|registrar|invitar)/i }).first();
        if (await add.count() && await add.isVisible().catch(() => false)) {
          await add.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(500);
          if (await page.locator('[role="dialog"]').count()) await rec(page, vw, `${s} (dialog)`);
          await page.keyboard.press('Escape'); await page.waitForTimeout(200);
        }
      }
      // mobile drawer / theme switcher
      const sw = page.locator('[data-theme-switcher] button[aria-expanded]');
      await page.goto(`${base}/Dashboard`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
      if (await sw.count()) { await sw.click(); await page.waitForTimeout(400); await rec(page, vw, 'theme switcher open'); await page.keyboard.press('Escape'); }
      await ctx.close();
    }
  } finally { await browser.close(); await server.close(); }
  if (argOf('--json')) await writeFile(argOf('--json'), JSON.stringify(report, null, 2));
  const fails = report.filter((r) => r.overlaps.length + r.covered.length + r.clipped.length || r.overflowX);
  console.log(`\n${fails.length} of ${report.length} states with issues`);
  process.exit(fails.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
