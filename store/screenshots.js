// Generates Chrome Web Store images into store/out/:
//   screenshot-1-editor.png, screenshot-2-redact.png (1280x800), promo-small.png (440x280)
// Needs a local server for store/demo.html on port 8765 (see README).
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EXT = path.resolve(__dirname, '../extension');
const OUT = path.join(__dirname, 'out');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const sw = await (await browser.waitForTarget(t => t.type() === 'service_worker')).worker();
  await sleep(1000);
  for (const p of await browser.pages()) if (p.url().includes('welcome')) await p.close();

  const page = await browser.newPage();
  await page.goto('http://localhost:8765/demo.html');
  await page.bringToFront();
  await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://localhost:8765/*' });
    await start(t.id);
  });
  await sleep(900);
  for (const sel of ['#reset1', '#tmp', 'label[for=force]', '#save']) {
    await page.click(sel);
    if (sel === '#tmp') await page.keyboard.type('Temp-Pass-2026!');
    await sleep(900);
  }
  await sw.evaluate(() => stop());
  const ed = await (await browser.waitForTarget(t => t.url().includes('editor.html?id='))).page();
  await ed.setViewport({ width: 1280, height: 800 });
  await ed.waitForSelector('.step canvas');

  await ed.evaluate(() => {
    guide.title = 'How to reset a user\'s password';
    guide.steps.splice(0, 1);                                   // drop the "Go to localhost" step
    guide.steps[0].title = 'Click "Reset password" next to the user';
    guide.steps[1].title = 'Enter a temporary password';
    guide.steps[2].title = 'Tick "Require change at next sign-in"';
    guide.steps[3].title = 'Click "Reset password" to confirm';
    renderGuide();
  });
  await sleep(300);
  await ed.screenshot({ path: path.join(OUT, 'screenshot-1-editor.png') });

  // Show a redaction over the email column on the first step.
  await ed.evaluate(() => {
    pro = true;
    guide.steps[0].redactions = [{ x: 0.33, y: 0.225, w: 0.215, h: 0.205 }];
    renderGuide();
    document.querySelector('.step-tools button').click();      // turn on Redact mode for step 1
    document.getElementById('upgradeBtn').hidden = true;
    document.getElementById('proStatus').textContent = 'Pro ✓';
    window.scrollTo(0, 0);
  });
  await sleep(300);
  await ed.screenshot({ path: path.join(OUT, 'screenshot-2-redact.png') });

  // Small promo tile.
  const tile = await browser.newPage();
  await tile.setViewport({ width: 440, height: 280 });
  const icon = fs.readFileSync(path.join(EXT, 'icons/icon128.png')).toString('base64');
  await tile.setContent(`<body style="margin:0;width:440px;height:280px;display:flex;align-items:center;gap:22px;padding:0 34px;box-sizing:border-box;
    background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;font-family:system-ui,sans-serif">
    <img src="data:image/png;base64,${icon}" width="96" height="96">
    <div><div style="font-size:34px;font-weight:800;letter-spacing:-.02em">Guidecap</div>
    <div style="font-size:17px;line-height:1.35;opacity:.92;margin-top:6px">Click through a task.<br>Get a step-by-step guide.<br><b>Nothing is uploaded.</b></div></div></body>`);
  await tile.screenshot({ path: path.join(OUT, 'promo-small.png') });

  await browser.close();
  console.log('Wrote', fs.readdirSync(OUT).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
