# Chrome Web Store listing: copy and paste

## Store listing tab

**Name** (from manifest): Guidecap: Step-by-Step Guide Recorder

**Summary** (max 132 characters, from manifest):
> Record your clicks and get a step-by-step guide with screenshots. Private: everything stays on your computer.

**Category:** Productivity → Workflow & Planning
**Language:** English

**Description:**
```
Turn any task in your browser into a step-by-step guide with screenshots, in seconds.

Click record, do the task, click stop. Guidecap captures a screenshot for every click, circles where you clicked, and writes the step for you (Click “Save settings”, Choose an option from “Region”, and so on). Tidy up the wording, then export.

PERFECT FOR
• IT and helpdesk how-tos: reset a password, set up MFA, add a user
• SOPs and onboarding docs for new team members
• Bug reports and QA steps
• Showing a client or family member exactly where to click

PRIVATE BY DESIGN
• Your guides never leave your computer. There's no cloud, no account and no upload.
• Guidecap never records what you type into fields.
• No analytics, no tracking, no ads.

FREE
• Unlimited recordings and guides
• Edit step text, reorder and delete steps
• Export to HTML, or print / save as PDF

GUIDECAP PRO: ONE-TIME $29, NO SUBSCRIPTION
• Redact: black out passwords, emails, API keys and customer data in screenshots
• Markdown export (.zip with images) for GitHub, Confluence, Notion or any wiki
• No "Made with Guidecap" footer on exports

Tip: press Alt+Shift+R to start and stop recording.
```

**Graphics** (in `store/out/`, regenerate with `npm run screenshots`):
- Screenshots (1280×800): `screenshot-1-editor.png`, `screenshot-2-redact.png`
- Small promo tile (440×280): `promo-small.png`
- Store icon (128×128): `extension/icons/icon128.png`

## Privacy tab

**Single purpose:**
> Guidecap records the user's clicks in the current tab and turns them into a step-by-step guide with screenshots.

**Permission justifications:**
- **storage:** Saves the user's guides (step text and screenshots) locally in the browser.
- **unlimitedStorage:** Guides contain many screenshots, which quickly exceed the default 10 MB local storage limit.
- **scripting:** Adds the click-recording script to a tab that was already open before the extension was installed, when the user starts a recording there.
- **Host permission (all sites):** Needed to capture screenshots of, and detect clicks on, whichever site the user chooses to record. Nothing happens on a page unless the user has started a recording.
- **Remote code:** No, the extension does not use remote code.

**Data usage:**
- Check **"Website content"**. Screenshots and the text of clicked elements are captured, but they are stored only on the user's device and never transmitted.
- If the form treats local-only data as not collected, you can leave everything unchecked. Either way, certify all three statements: not sold, not used for unrelated purposes, not used for creditworthiness.

**Privacy policy URL:**
> https://guidecap.jhunter6521.workers.dev/privacy

## Distribution tab
- Visibility: **Public**
- Regions: **All regions**
- Price: free. Pro is sold inside the extension through ExtensionPay, not through the Web Store.
