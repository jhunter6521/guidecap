// End-to-end test: loads the extension in headless Chrome, records clicks on
// tests/site, then checks the saved steps, the editor and both exports.
// Serves tests/site itself. Exits with code 1 if any check fails. See README.
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');

const EXT = path.resolve(__dirname, '../extension');
const SITE = path.join(__dirname, 'site');
const OUT = path.join(__dirname, 'out');
const PORT = 8765;
const ORIGIN = `http://localhost:${PORT}`;
const SECRETS = ['secret-value', 'hunter2'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(ok, name, detail) {
  if (ok) console.log('  ok   ' + name);
  else { failures++; console.log('  FAIL ' + name + (detail ? `\n       ${detail}` : '')); }
}

function serve() {
  return http.createServer((req, res) => {
    const file = path.join(SITE, path.normalize(decodeURIComponent(req.url.split(/[?#]/)[0])).replace(/^[/\\]+/, '') || 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }).listen(PORT);
}

async function waitForFile(file, timeout = 10000) {
  for (const end = Date.now() + timeout; Date.now() < end; await sleep(200)) {
    if (fs.existsSync(file) && !fs.existsSync(file + '.crdownload')) return fs.readFileSync(file);
  }
  return null;
}

// Reads an uncompressed ZIP (what extension/zip.js writes) into { name: Buffer }.
function readZip(buf) {
  const files = {};
  for (let p = 0; buf.readUInt32LE(p) === 0x04034b50;) {
    const size = buf.readUInt32LE(p + 18), nameLen = buf.readUInt16LE(p + 26), extraLen = buf.readUInt16LE(p + 28);
    const start = p + 30 + nameLen + extraLen;
    files[buf.toString('utf8', p + 30, p + 30 + nameLen)] = buf.subarray(start, start + size);
    p = start + size;
  }
  return files;
}

// Average color of a small patch of an image, at fractions (fx, fy) of its size.
// Decoded in the editor page because Node has no JPEG decoder.
function sampleColor(page, src, fx, fy) {
  return page.evaluate(async (src, fx, fy) => {
    const img = await loadImage(src);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(Math.round(fx * c.width) - 2, Math.round(fy * c.height) - 2, 5, 5).data;
    const avg = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) avg[k] += d[i + k] / 25;
    return avg.map(Math.round);
  }, src, fx, fy);
}
const isWhite = ([r, g, b]) => r > 230 && g > 230 && b > 230;
const isDark = ([r, g, b]) => r < 50 && g < 50 && b < 50;
const isBlue = ([r, g, b]) => b > 200 && r < 120;

async function run(browser) {
  const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes('background.js'));
  const sw = await swTarget.worker();
  const errors = [];
  sw.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') errors.push('worker: ' + m.text()); });
  await sleep(1000);

  console.log('install');
  let welcome = false;
  for (const p of await browser.pages()) {
    if (p.url().includes('editor.html?welcome')) {
      welcome = !!(await p.waitForSelector('.welcome', { timeout: 8000 }).catch(() => null));
      await p.close();
    }
  }
  check(welcome, 'welcome page opens on install');

  console.log('recording');
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('page: ' + e.message));
  await page.goto(ORIGIN + '/index.html');
  await page.bringToFront();
  await sleep(500);
  const startRes = await sw.evaluate(async origin => {
    const [t] = await chrome.tabs.query({ url: origin + '/*' });
    try { await start(t.id); return 'started'; } catch (e) { return 'ERR ' + e.message; }
  }, ORIGIN);
  check(startRes === 'started', 'recording starts', startRes);
  await sleep(800);

  await page.click('#email'); await page.keyboard.type(SECRETS[0]); await sleep(800);
  await page.click('#pw'); await page.keyboard.type(SECRETS[1]); await sleep(800);
  await page.click('#save'); await sleep(800);
  // Five clicks 100 ms apart. Chrome only allows about 2 screenshots a second, so these queue up.
  for (let i = 1; i <= 5; i++) { await page.click('#b' + i); await sleep(100); }
  await sleep(3500); // let the screenshot queue drain
  await page.click('#users'); await sleep(800);
  // A link to another page: its screenshot should still show the page that was clicked.
  await Promise.all([page.waitForNavigation(), page.click('#reports')]);
  await sleep(1200);
  await page.click('#export'); await sleep(1200);
  await sw.evaluate(() => stop());

  const expected = [
    'Go to localhost',
    'Click the "Email address" field and enter your text',
    'Click the "Password" field and enter your text',
    'Click "Save settings"',
    'Click "Burst 1"', 'Click "Burst 2"', 'Click "Burst 3"', 'Click "Burst 4"', 'Click "Burst 5"',
    'Click "Manage users"',
    'Click "Open reports"',
    'Click "Export report"',
  ];
  const edTarget = await browser.waitForTarget(t => t.url().includes('editor.html?id='), { timeout: 10000 });
  const ed = await edTarget.page();
  ed.on('pageerror', e => errors.push('editor: ' + e.message));
  ed.on('console', m => { if (m.type() === 'error') errors.push('editor console: ' + m.text()); });
  await ed.setViewport({ width: 1100, height: 900 });
  await ed.waitForSelector('.step canvas', { timeout: 15000 });

  const all = await ed.evaluate(() => chrome.storage.local.get(null));
  const guideKey = Object.keys(all).find(k => k.startsWith('guide:'));
  const steps = all[guideKey]?.steps || [];
  const titles = steps.map(s => s.title);
  check(JSON.stringify(titles) === JSON.stringify(expected), `all ${expected.length} clicks saved as steps with the right text`,
    'got: ' + JSON.stringify(titles, null, 1).replace(/\n/g, '\n       '));
  check(steps.every(s => typeof all['img:' + s.id] === 'string' && all['img:' + s.id].startsWith('data:image/jpeg')),
    'every step has a screenshot');
  const text = JSON.stringify(all, (k, v) => typeof v === 'string' && v.startsWith('data:') ? '[img]' : v);
  check(!SECRETS.some(s => text.includes(s)), 'typed text is not saved in storage');
  check(all.recording?.on === false, 'recording is off after stopping');

  // Look steps up by position, so these checks still run if the step text is wrong.
  const stepImg = title => all['img:' + steps[expected.indexOf(title)]?.id];
  if (stepImg('Click "Open reports"')) {
    const c = await sampleColor(ed, stepImg('Click "Open reports"'), 0.95, 0.5);
    check(isWhite(c), 'screenshot for a link click shows the page that was clicked, not the next page', `color ${c}`);
  }
  if (stepImg('Click "Export report"')) {
    const c = await sampleColor(ed, stepImg('Click "Export report"'), 0.95, 0.5);
    check(isBlue(c), 'steps are recorded on the next page after a link click', `color ${c}`);
  }

  const cards = await ed.$$eval('.step-title', els => els.map(e => e.value));
  check(JSON.stringify(cards) === JSON.stringify(titles), 'editor shows every step');

  console.log('exports');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const cdp = await ed.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT });

  await ed.evaluate(() => exportHtml());
  const html = (await waitForFile(path.join(OUT, 'untitled-guide.html')))?.toString();
  check(!!html, 'HTML export downloads');
  if (html) {
    check((html.match(/<img src="data:image\/jpeg/g) || []).length === expected.length, 'HTML export has one image per step');
    check(expected.every(t => html.includes(t.replace(/"/g, '&quot;'))), 'HTML export has every step\'s text');
    check(!SECRETS.some(s => html.includes(s)), 'HTML export has no typed text');
    check(html.includes('Made with Guidecap'), 'free HTML export has the footer');
  }

  const locked = await ed.evaluate(() => { exportMarkdown(); const open = upgrade.open; upgrade.close(); return open; });
  check(locked, 'Markdown export asks free users to upgrade');

  // Simulate Pro, then black out an empty white area of the first screenshot.
  const REDACT = { x: 0.5, y: 0.45, w: 0.3, h: 0.2 };
  await ed.evaluate(r => { pro = true; guide.steps[0].redactions = [r]; renderGuide(); exportMarkdown(); }, REDACT);
  const zipBuf = await waitForFile(path.join(OUT, 'untitled-guide.zip'));
  check(!!zipBuf, 'Markdown export downloads (Pro)');
  if (zipBuf) {
    const zip = readZip(zipBuf);
    const md = zip['guide.md']?.toString() || '';
    const images = Object.keys(zip).filter(n => /^images\/step-\d\d\.jpg$/.test(n));
    check(images.length === expected.length, 'Markdown zip has one image per step', `found ${images.length}`);
    check(images.every(n => md.includes(`](${n})`)), 'guide.md links to every image');
    check(!SECRETS.some(s => md.includes(s)), 'Markdown export has no typed text');
    const img = zip['images/step-01.jpg'];
    if (img) {
      const src = 'data:image/jpeg;base64,' + img.toString('base64');
      const inside = await sampleColor(ed, src, REDACT.x + REDACT.w / 2, REDACT.y + REDACT.h / 2);
      const outside = await sampleColor(ed, src, REDACT.x + REDACT.w / 2, REDACT.y + REDACT.h + 0.1);
      check(isDark(inside), 'redacted area is blacked out in the exported image', `color ${inside}`);
      check(isWhite(outside), 'area outside the redaction is unchanged', `color ${outside}`);
    }
  }

  await ed.screenshot({ path: path.join(OUT, 'editor.png') });
  await ed.evaluate(() => { location.href = 'editor.html'; });
  await ed.waitForSelector('.guide-row');
  await ed.screenshot({ path: path.join(OUT, 'list.png') });

  // ExtensionPay can't be reached from the test, so a warning about it is expected.
  const real = errors.filter(e => !/extensionpay/i.test(e));
  check(!real.length, 'no JavaScript errors', real.join('\n       '));
}

(async () => {
  const server = serve();
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 800 },
  });
  try {
    await run(browser);
  } catch (e) {
    failures++;
    console.log('  FAIL test stopped early: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
