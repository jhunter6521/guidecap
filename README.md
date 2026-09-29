# Guidecap

A Chrome extension that records your clicks and turns them into a step-by-step guide
with screenshots. Everything stays on the user's computer.

- **Free:** unlimited recording, editing, HTML export, print/PDF.
- **Pro ($29 one-time, via ExtensionPay):** redaction, Markdown (.zip) export, no footer.

## How it works

| File | Job |
|------|-----|
| `extension/manifest.json` | Manifest V3 config: permissions, popup, the Alt+Shift+R shortcut |
| `extension/content.js` | Runs on web pages. While recording, reports each click and a short description of what was clicked. It never reads typed values. |
| `extension/background.js` | Service worker. Starts and stops recordings, takes a screenshot for each click (queued, because Chrome allows about 2 per second), and saves steps. |
| `extension/popup.*` | Toolbar popup with the Start and Stop buttons |
| `extension/editor.*` | Guide list and editor: edit, reorder and delete steps, redact, export |
| `extension/zip.js` | Small ZIP writer for the Markdown export |
| `extension/config.js` | ExtensionPay ID and Pro price |
| `extension/ExtPay.js` | ExtensionPay library (payments and licensing) |

Guides are kept in `chrome.storage.local`. Each guide stores its step metadata, and each
screenshot is saved separately under `img:<stepId>`. Redactions and click circles are
stored as fractions of the image size and drawn on at display and export time, so the
original screenshot is never changed.

There's no build step. The `extension/` folder *is* the extension.

## Try it in Chrome

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose the `extension` folder. From Windows with WSL, the path is
   `\\wsl$\Ubuntu\home\jhunter\projects\guidecap\extension`.
3. Pin the Guidecap icon, open any website, and click **Start recording**.

After changing code, click the ↻ reload button on the extension's card.

## Package for the Chrome Web Store

```bash
python3 package.py        # writes dist/guidecap-<version>.zip
```
Increase `version` in `extension/manifest.json` before each upload.
The store listing text is in [STORE_LISTING.md](STORE_LISTING.md).

## Tests and store screenshots

These need Node and Puppeteer (`npm install`). Both scripts load the real extension in headless Chrome.

```bash
# end-to-end test: record, edit, export
(cd tests/site && python3 -m http.server 8765) &
npm test

# regenerate the store images into store/out/
(cd store && python3 -m http.server 8765) &
npm run screenshots
```
On a minimal WSL install, Chrome may need `sudo apt install libnss3 libasound2t64`.

## Website (landing page + privacy policy)

`site/` is a small static site, deployed to Cloudflare as the Worker `guidecap`
(see `wrangler.jsonc`, which serves only that folder). Every push to `main` redeploys it.

- Home: https://guidecap.jhunter6521.workers.dev
- Privacy policy: https://guidecap.jhunter6521.workers.dev/privacy

Once the Chrome Web Store listing is approved, paste its link into `STORE_URL` in `site/index.html`.
