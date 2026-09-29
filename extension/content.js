// Runs on web pages. While recording, reports each click to the background
// worker with a short description of what was clicked. Never records typed values.
(() => {
  if (window.__guidecapLoaded) return;
  window.__guidecapLoaded = true;

  let recording = false;
  chrome.storage.local.get('recording').then(r => { recording = !!r.recording?.on; }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.recording) recording = !!changes.recording.newValue?.on;
  });

  const INTERACTIVE = 'a,button,input,select,textarea,summary,label,[role=button],[role=link],' +
    '[role=menuitem],[role=tab],[role=checkbox],[role=radio],[role=option],[role=switch],[contenteditable]';
  const TEXT_INPUT_EXCLUDE = ['submit', 'button', 'reset', 'image', 'file', 'color', 'range', 'checkbox', 'radio'];

  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const short = s => { s = clean(s); return s.length > 60 ? s.slice(0, 57) + '…' : s; };

  function labelFor(el) {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return l.textContent;
    }
    return el.closest('label')?.textContent || '';
  }

  function describe(target) {
    const interactive = target.closest(INTERACTIVE);
    const el = interactive || target;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const isField = tag === 'textarea' || el.isContentEditable ||
      (tag === 'input' && !TEXT_INPUT_EXCLUDE.includes(type));

    let name = el.getAttribute('aria-label') || '';
    if (!name && (tag === 'input' || tag === 'textarea' || tag === 'select')) {
      name = labelFor(el) || el.getAttribute('placeholder') || el.getAttribute('name') || '';
    }
    if (!name && tag === 'input' && (type === 'submit' || type === 'button')) name = el.value;
    // Never use a field's own contents as its name: that could be what the user typed.
    if (!name && !isField && interactive) name = el.innerText;
    if (!name && !isField && !interactive) name = el.textContent.slice(0, 200);
    if (!name) name = el.getAttribute('title') || el.getAttribute('alt') ||
      el.querySelector?.('img[alt]')?.getAttribute('alt') || '';
    name = short(name);
    const q = name ? `"${name}"` : '';

    if (tag === 'select') return q ? `Choose an option from ${q}` : 'Choose an option';
    if (tag === 'input' && (type === 'checkbox' || type === 'radio')) return q ? `Select ${q}` : 'Select the option';
    if (isField) return q ? `Click the ${q} field and enter your text` : 'Click the field and enter your text';
    return q ? `Click ${q}` : 'Click here';
  }

  document.addEventListener('pointerdown', e => {
    if (!recording || !e.isTrusted || e.button !== 0) return;
    const target = e.composedPath()[0];
    if (!(target instanceof Element)) return;
    let title;
    try { title = describe(target); } catch { title = 'Click here'; }
    chrome.runtime.sendMessage({
      type: 'step',
      title,
      xr: e.clientX / window.innerWidth,
      yr: e.clientY / window.innerHeight,
      url: location.href
    }).catch(() => {});
  }, true);
})();
