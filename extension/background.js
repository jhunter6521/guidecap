importScripts('ExtPay.js', 'config.js');

const extpay = ExtPay(EXTPAY_ID);
extpay.startBackground();

// Storage layout (chrome.storage.local):
//   recording      { on, guideId }
//   guides         [{ id, title, created, updated, stepCount }]   index for the list view
//   guide:<id>     { id, title, created, steps: [{ id, title, xr, yr, url, redactions: [] }] }
//   img:<stepId>   JPEG data URL of the step's screenshot

const store = chrome.storage.local;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Chrome allows about 2 captureVisibleTab calls per second, so captures are queued.
let queue = Promise.resolve();
let lastCapture = 0;
const enqueue = fn => (queue = queue.catch(() => {}).then(fn));

async function capture(windowId) {
  const wait = 550 - (Date.now() - lastCapture);
  if (wait > 0) await sleep(wait);
  lastCapture = Date.now();
  return chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 85 });
}

async function updateIndex(guide) {
  const { guides = [] } = await store.get('guides');
  const entry = { id: guide.id, title: guide.title, created: guide.created, updated: Date.now(), stepCount: guide.steps.length };
  const i = guides.findIndex(g => g.id === guide.id);
  if (i >= 0) guides[i] = entry; else guides.push(entry);
  await store.set({ guides });
}

async function addStep(guideId, step, dataUrl) {
  const key = 'guide:' + guideId;
  const guide = (await store.get(key))[key];
  if (!guide) return;
  guide.steps.push(step);
  await store.set({ [key]: guide, ['img:' + step.id]: dataUrl });
  await updateIndex(guide);
}

function setBadge(on) {
  chrome.action.setBadgeText({ text: on ? 'REC' : '' });
  if (on) chrome.action.setBadgeBackgroundColor({ color: '#e5484d' });
}

const isRecordable = url => /^https?:/.test(url || '');

async function start(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!isRecordable(tab.url)) throw new Error('Chrome does not allow recording on this page. Open a website first.');

  const guide = { id: crypto.randomUUID(), title: 'Untitled guide', created: Date.now(), steps: [] };
  await store.set({ ['guide:' + guide.id]: guide, recording: { on: true, guideId: guide.id } });
  await updateIndex(guide);
  setBadge(true);

  // Tabs opened before the extension was installed don't have the content script yet.
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).catch(() => {});

  await enqueue(async () => {
    const img = await capture(tab.windowId);
    const host = new URL(tab.url).hostname;
    await addStep(guide.id, { id: crypto.randomUUID(), title: `Go to ${host}`, xr: null, yr: null, url: tab.url, redactions: [] }, img);
  });
}

async function stop() {
  const { recording } = await store.get('recording');
  await store.set({ recording: { on: false, guideId: null } });
  setBadge(false);
  await queue.catch(() => {});
  if (recording?.guideId) chrome.tabs.create({ url: chrome.runtime.getURL('editor.html?id=' + recording.guideId) });
}

async function onStep(msg, sender) {
  const { recording } = await store.get('recording');
  if (!recording?.on || !sender.tab?.active) return;
  const step = { id: crypto.randomUUID(), title: String(msg.title).slice(0, 200), xr: msg.xr, yr: msg.yr, url: msg.url, redactions: [] };
  enqueue(async () => {
    try {
      const img = await capture(sender.tab.windowId);
      await addStep(recording.guideId, step, img);
    } catch (e) {
      console.warn('Guidecap: skipped a step', e);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'step') { onStep(msg, sender); return false; }
  if (msg?.type === 'start') {
    start(msg.tabId).then(() => sendResponse({ ok: true }), e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg?.type === 'stop') {
    stop().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-recording') return;
  const { recording } = await store.get('recording');
  if (recording?.on) return stop();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) start(tab.id).catch(e => console.warn('Guidecap:', e.message));
});

// A browser restart ends any recording that was in progress.
chrome.runtime.onStartup.addListener(() => {
  store.set({ recording: { on: false, guideId: null } });
  setBadge(false);
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { recording } = await store.get('recording');
  setBadge(!!recording?.on);
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('editor.html?welcome=1') });
});
