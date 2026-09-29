const store = chrome.storage.local;
const params = new URLSearchParams(location.search);
const main = document.getElementById('main');

let pro = false;
let guide = null;            // the open guide
const images = new Map();    // stepId -> HTMLImageElement

// ---------- helpers ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => (s || 'guide').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'guide';
const pad = n => String(n).padStart(2, '0');

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  el('a', { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- Pro (ExtensionPay) ----------

const extpay = ExtPay(EXTPAY_ID);

async function checkPro() {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
    const user = await Promise.race([extpay.getUser(), timeout]);
    pro = !!user.paid;
    await store.set({ proCache: pro });
  } catch {
    // Offline or ExtensionPay unreachable: fall back to the last known status.
    pro = !!(await store.get('proCache')).proCache;
  }
  document.getElementById('proStatus').textContent = pro ? 'Pro ✓' : '';
  document.getElementById('upgradeBtn').hidden = pro;
}

const upgrade = document.getElementById('upgrade');
document.getElementById('price').textContent = PRO_PRICE;
document.getElementById('upgradeBtn').addEventListener('click', () => upgrade.showModal());
document.getElementById('closeUpgrade').addEventListener('click', () => upgrade.close());
document.getElementById('buy').addEventListener('click', () => { extpay.openPaymentPage(); upgrade.close(); });
document.getElementById('login').addEventListener('click', e => { e.preventDefault(); extpay.openLoginPage(); upgrade.close(); });

// Re-check after the user comes back from the payment page.
window.addEventListener('focus', async () => {
  const was = pro;
  await checkPro();
  if (pro !== was && guide) renderGuide();
});

function requirePro() {
  if (pro) return true;
  upgrade.showModal();
  return false;
}

// ---------- saving ----------

async function saveGuide() {
  await store.set({ ['guide:' + guide.id]: guide });
  const { guides = [] } = await store.get('guides');
  const i = guides.findIndex(g => g.id === guide.id);
  const entry = { id: guide.id, title: guide.title, created: guide.created, updated: Date.now(), stepCount: guide.steps.length };
  if (i >= 0) guides[i] = entry; else guides.push(entry);
  await store.set({ guides });
}

let saveTimer;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveGuide, 400);
}

async function deleteGuide(id) {
  const key = 'guide:' + id;
  const g = (await store.get(key))[key];
  const keys = [key, ...(g?.steps || []).map(s => 'img:' + s.id)];
  await store.remove(keys);
  const { guides = [] } = await store.get('guides');
  await store.set({ guides: guides.filter(x => x.id !== id) });
}

// ---------- drawing ----------

function drawStep(canvas, step, preview) {
  const img = images.get(step.id);
  if (!img) return;
  const w = canvas.width = img.naturalWidth;
  const h = canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Redactions are solid boxes. Blurring or pixelating text can sometimes be reversed.
  ctx.fillStyle = '#1b1f24';
  for (const r of step.redactions || []) ctx.fillRect(r.x * w, r.y * h, r.w * w, r.h * h);
  if (preview) {
    ctx.fillStyle = 'rgba(124, 58, 237, .45)';
    ctx.fillRect(preview.x * w, preview.y * h, preview.w * w, preview.h * h);
  }

  if (step.xr != null) {
    const x = step.xr * w, y = step.yr * h;
    const r = Math.max(18, w * 0.022);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(229, 72, 77, .18)';
    ctx.fill();
    ctx.lineWidth = Math.max(3, w / 450);
    ctx.strokeStyle = '#e5484d';
    ctx.stroke();
  }
}

function renderedDataUrl(step) {
  const c = document.createElement('canvas');
  drawStep(c, step);
  return c.toDataURL('image/jpeg', 0.88);
}

// ---------- list view ----------

async function showList() {
  document.title = 'My guides · Guidecap';
  const { guides = [] } = await store.get('guides');
  guides.sort((a, b) => b.updated - a.updated);
  main.replaceChildren();

  if (params.has('welcome')) {
    main.append(el('section', { class: 'welcome' },
      el('h2', {}, 'Welcome to Guidecap 👋'),
      el('p', {}, '1. Pin Guidecap: click the puzzle-piece icon in Chrome\'s toolbar, then the pin next to Guidecap.'),
      el('p', {}, '2. Open any website, click the Guidecap icon, and press "Start recording".'),
      el('p', {}, '3. Do the task. Each click becomes a step with a screenshot. Stop when you\'re done (or press Alt+Shift+R).'),
      el('p', { class: 'muted' }, 'Everything stays on your computer. Nothing is uploaded.')));
  }

  main.append(el('div', { class: 'list-head' }, el('h1', {}, 'My guides'),
    el('span', { class: 'muted' }, `${guides.length} guide${guides.length === 1 ? '' : 's'}`)));

  if (!guides.length) {
    main.append(el('div', { class: 'empty' }, 'No guides yet. Click the Guidecap icon on any website and press "Start recording".'));
    return;
  }
  for (const g of guides) {
    main.append(el('div', { class: 'guide-row' },
      el('div', {},
        el('a', { href: 'editor.html?id=' + encodeURIComponent(g.id) }, g.title || 'Untitled guide'),
        el('div', { class: 'meta' }, `${g.stepCount} steps · ${new Date(g.updated).toLocaleString()}`)),
      el('button', {
        class: 'small', onclick: async () => {
          if (!confirm(`Delete "${g.title}"? This can't be undone.`)) return;
          await deleteGuide(g.id);
          showList();
        }
      }, 'Delete')));
  }
}

// ---------- guide view ----------

async function showGuide(id) {
  const key = 'guide:' + id;
  guide = (await store.get(key))[key];
  if (!guide) {
    main.replaceChildren(el('div', { class: 'empty' }, 'This guide no longer exists. ', el('a', { href: 'editor.html' }, 'Back to my guides')));
    return;
  }
  const data = await store.get(guide.steps.map(s => 'img:' + s.id));
  await Promise.all(guide.steps.map(async s => {
    const src = data['img:' + s.id];
    if (src) images.set(s.id, await loadImage(src));
  }));
  // Drop steps whose screenshot is missing.
  guide.steps = guide.steps.filter(s => images.has(s.id));
  renderGuide();
}

function renderGuide() {
  document.title = `${guide.title} · Guidecap`;
  const title = el('input', {
    class: 'guide-title', value: guide.title, 'aria-label': 'Guide title',
    oninput: e => { guide.title = e.target.value; document.title = `${guide.title} · Guidecap`; saveSoon(); }
  });
  if (guide.title === 'Untitled guide') setTimeout(() => title.select(), 0);

  const proTag = pro ? null : el('span', { class: 'pro-tag' }, 'PRO');
  const toolbar = el('div', { class: 'toolbar' },
    el('button', { class: 'primary', onclick: exportHtml }, 'Download HTML'),
    el('button', { onclick: printGuide }, 'Print / Save as PDF'),
    el('button', { onclick: exportMarkdown }, 'Markdown (.zip)', proTag),
    el('span', { class: 'spacer' }),
    el('button', { onclick: () => { location.href = 'editor.html'; } }, 'All guides'),
    el('button', {
      onclick: async () => {
        if (!confirm('Delete this guide? This can\'t be undone.')) return;
        await deleteGuide(guide.id);
        location.href = 'editor.html';
      }
    }, 'Delete guide'));

  main.replaceChildren(title, toolbar);
  if (!guide.steps.length) main.append(el('div', { class: 'empty' }, 'This guide has no steps.'));
  guide.steps.forEach((step, i) => main.append(stepCard(step, i)));
}

function stepCard(step, i) {
  const canvas = el('canvas', { 'aria-label': `Screenshot for step ${i + 1}` });
  drawStep(canvas, step);
  const hint = el('p', { class: 'hint', hidden: true }, 'Drag over anything sensitive to black it out. Click "Done" when finished.');

  const move = async dir => {
    const j = i + dir;
    if (j < 0 || j >= guide.steps.length) return;
    [guide.steps[i], guide.steps[j]] = [guide.steps[j], guide.steps[i]];
    await saveGuide();
    renderGuide();
  };

  const redactBtn = el('button', {
    title: 'Black out sensitive info',
    onclick: () => {
      if (!requirePro()) return;
      const on = canvas.classList.toggle('redacting');
      redactBtn.firstChild.textContent = on ? 'Done' : 'Redact';
      hint.hidden = !on;
    }
  }, 'Redact', pro ? null : el('span', { class: 'pro-tag' }, 'PRO'));

  const undoBtn = el('button', {
    title: 'Remove the last redaction', hidden: !step.redactions?.length,
    onclick: () => {
      step.redactions.pop();
      undoBtn.hidden = !step.redactions.length;
      drawStep(canvas, step);
      saveSoon();
    }
  }, 'Undo redaction');

  // Drag to add a redaction box. Coordinates are stored as fractions of the image size.
  let start = null;
  const point = e => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    };
  };
  const rectFrom = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  canvas.addEventListener('pointerdown', e => {
    if (!canvas.classList.contains('redacting')) return;
    start = point(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (start) drawStep(canvas, step, rectFrom(start, point(e)));
  });
  canvas.addEventListener('pointerup', e => {
    if (!start) return;
    const r = rectFrom(start, point(e));
    start = null;
    if (r.w > 0.004 && r.h > 0.004) {
      (step.redactions ||= []).push(r);
      undoBtn.hidden = false;
      saveSoon();
    }
    drawStep(canvas, step);
  });

  return el('article', { class: 'step' },
    el('div', { class: 'step-head' },
      el('span', { class: 'num' }, String(i + 1)),
      el('input', { class: 'step-title', value: step.title, 'aria-label': `Step ${i + 1} text`, oninput: e => { step.title = e.target.value; saveSoon(); } }),
      el('div', { class: 'step-tools' },
        redactBtn, undoBtn,
        el('button', { title: 'Move up', 'aria-label': 'Move step up', disabled: i === 0, onclick: () => move(-1) }, '↑'),
        el('button', { title: 'Move down', 'aria-label': 'Move step down', disabled: i === guide.steps.length - 1, onclick: () => move(1) }, '↓'),
        el('button', {
          title: 'Delete step', 'aria-label': 'Delete step',
          onclick: async () => {
            guide.steps.splice(i, 1);
            images.delete(step.id);
            await store.remove('img:' + step.id);
            await saveGuide();
            renderGuide();
          }
        }, '✕'))),
    canvas, hint);
}

// ---------- export ----------

const FOOTER_TEXT = 'Made with Guidecap: step-by-step guides from your clicks';

function exportHtml() {
  const steps = guide.steps.map((s, i) =>
    `<li><p>${esc(s.title)}</p><img src="${renderedDataUrl(s)}" alt="Step ${i + 1}"></li>`).join('\n');
  const footer = pro ? '' : `<p class="footer">${esc(FOOTER_TEXT)}</p>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(guide.title)}</title>
<style>
body{margin:0;background:#f6f7f9;color:#161a21;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:40px 20px 60px}
h1{font-size:2rem;line-height:1.2;margin:0 0 28px}
ol{padding:0;margin:0;list-style:none;counter-reset:s}
li{counter-increment:s;background:#fff;border:1px solid #dfe3ea;border-radius:12px;padding:16px;margin-bottom:20px}
li p{margin:0 0 12px;font-weight:600;display:flex;gap:10px;align-items:center}
li p::before{content:counter(s);flex:none;width:28px;height:28px;border-radius:50%;background:#2563eb;color:#fff;display:grid;place-items:center;font-size:.9rem}
img{display:block;max-width:100%;height:auto;border-radius:6px;border:1px solid #dfe3ea}
.footer{color:#5d6675;font-size:.85rem;text-align:center}
@media (prefers-color-scheme:dark){body{background:#111418;color:#e8ebf0}li{background:#1a1e25;border-color:#2c323c}img{border-color:#2c323c}.footer{color:#9aa3b2}}
</style></head>
<body><main><h1>${esc(guide.title)}</h1><ol>
${steps}
</ol>${footer}</main></body></html>`;
  download(new Blob([html], { type: 'text/html' }), slug(guide.title) + '.html');
}

function exportMarkdown() {
  if (!requirePro()) return;
  const mdEsc = s => String(s).replace(/([\\`*_[\]<>#|])/g, '\\$1');
  const files = [];
  let md = `# ${mdEsc(guide.title)}\n\n`;
  guide.steps.forEach((s, i) => {
    const name = `images/step-${pad(i + 1)}.jpg`;
    files.push({ name, data: dataUrlToBytes(renderedDataUrl(s)) });
    md += `${i + 1}. ${mdEsc(s.title)}\n\n   ![Step ${i + 1}](${name})\n\n`;
  });
  files.unshift({ name: 'guide.md', data: new TextEncoder().encode(md) });
  download(makeZip(files), slug(guide.title) + '.zip');
}

function printGuide() {
  const area = document.getElementById('print');
  const list = el('ol');
  guide.steps.forEach((s, i) => list.append(el('li', {}, el('p', {}, el('b', {}, s.title)), el('img', { src: renderedDataUrl(s), alt: `Step ${i + 1}` }))));
  area.replaceChildren(el('h1', {}, guide.title), list, pro ? null : el('p', { class: 'footer' }, FOOTER_TEXT));
  // Give the images a moment to decode before the print dialog snapshots the page.
  setTimeout(() => window.print(), 150);
}

// ---------- start ----------

(async () => {
  await checkPro();
  const id = params.get('id');
  if (id) showGuide(id); else showList();
})();
