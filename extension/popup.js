const $ = id => document.getElementById(id);

async function init() {
  const { recording } = await chrome.storage.local.get('recording');
  const on = !!recording?.on;
  $('idle').hidden = on;
  $('busy').hidden = !on;
  if (on) {
    const key = 'guide:' + recording.guideId;
    const guide = (await chrome.storage.local.get(key))[key];
    $('count').textContent = guide?.steps.length ?? 0;
  }
}

$('start').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const res = await chrome.runtime.sendMessage({ type: 'start', tabId: tab.id });
  if (res?.ok) return window.close();
  $('err').textContent = res?.error || 'Could not start recording.';
  $('err').hidden = false;
});

$('stop').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'stop' });
  window.close();
});

init();
