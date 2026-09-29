// End-to-end test: loads the extension in headless Chrome, records clicks on
// tests/site, then checks the editor and both exports. See README for how to run.
const puppeteer = require('puppeteer');
const path = require('path');
const EXT = path.resolve(__dirname, '../extension');
const sleep = ms => new Promise(r => setTimeout(r, ms));
require('fs').mkdirSync(path.join(__dirname, 'out'), { recursive: true });
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes('background.js'));
  const sw = await swTarget.worker();
  const errors = [];
  sw.on('console', m => console.log('[sw]', m.type(), m.text()));
  await sleep(1000);
  // Close the welcome tab opened on install, but check it rendered first.
  for (const p of await browser.pages()) {
    if (p.url().includes('editor.html?welcome')) {
      await p.waitForSelector('.welcome', { timeout: 8000 });
      console.log('welcome page ok');
      await p.close();
    }
  }
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('page: ' + e.message));
  await page.goto('http://localhost:8765/index.html');
  await page.bringToFront();
  await sleep(500);
  const startRes = await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://localhost:8765/*' });
    try { await start(t.id); return 'started'; } catch (e) { return 'ERR ' + e.message; }
  });
  console.log('start:', startRes);
  await sleep(800);
  await page.click('#email'); await page.keyboard.type('secret-value'); await sleep(800);
  await page.click('#pw'); await page.keyboard.type('hunter2'); await sleep(800);
  await page.click('#save'); await sleep(800);
  await page.click('#users'); await sleep(1200);
  await sw.evaluate(() => stop());
  const edTarget = await browser.waitForTarget(t => t.url().includes('editor.html?id='), { timeout: 10000 });
  const ed = await edTarget.page();
  ed.on('pageerror', e => errors.push('editor: ' + e.message));
  ed.on('console', m => { if (m.type() === 'error') errors.push('editor console: ' + m.text()); });
  await ed.setViewport({ width: 1100, height: 900 });
  await ed.waitForSelector('.step canvas', { timeout: 15000 });
  const titles = await ed.$$eval('.step-title', els => els.map(e => e.value));
  console.log('steps:', JSON.stringify(titles, null, 1));
  const stored = await ed.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null), (k, v) => typeof v === 'string' && v.startsWith('data:') ? '[img]' : v));
  console.log('leaks typed text?', /secret-value|hunter2/.test(stored));
  // exports
  const cdp = await ed.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(__dirname, 'out') });
  await ed.evaluate(() => exportHtml());
  // simulate Pro to test redaction + markdown
  await ed.evaluate(() => { pro = true; renderGuide(); });
  await ed.evaluate(() => { guide.steps[1].redactions = [{ x: .02, y: .6, w: .3, h: .06 }]; renderGuide(); exportMarkdown(); });
  await sleep(1500);
  await ed.screenshot({ path: path.join(__dirname, 'out/editor.png'), fullPage: false });
  await ed.evaluate(() => { location.href = 'editor.html'; });
  await ed.waitForSelector('.guide-row'); 
  await ed.screenshot({ path: path.join(__dirname, 'out/list.png') });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
