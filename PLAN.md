# Guidecap: launch and money plan

_Started: 2026-09-28_

## Why this app
- **People pay for this.** Scribe charges about $25/user/month and Tango is similar.
  Folge sells a local-only desktop version for $89 one-time. Dubble, a small indie
  competitor, makes about $2.7K/month.
- **The gap:** the free local-only Chrome extensions (SnapSteps, StepSnap, Chrome Step
  Recorder) are basic first versions. None offers **redaction** or **Markdown/wiki export**,
  which are the two things IT and ops people need to publish docs safely.
- **Where buyers find it:** Chrome Web Store search ("step by step guide", "scribe
  alternative", "SOP", "how-to screenshots").
- **Running cost:** $0. No servers. ExtensionPay handles payments and licensing.

## Honest expectations
Most extensions get few installs. Realistic targets for a focused indie extension:
about $100–500/month within 6–12 months, and $1–3K/month within 12–18 months if it
catches on. At $29, 10 sales/month is $290/month. This is a small bet, not a sure thing.

## Launch checklist
Everything else has been done by Claude.

- [x] Build the extension (v0.1.0) and test it end-to-end in headless Chrome
- [x] Store listing text, screenshots, promo tile ([STORE_LISTING.md](STORE_LISTING.md), `store/out/`)
- [x] Privacy policy page (hosted on the existing Cloudflare site)
- [ ] **You:** try it in Chrome (Load unpacked, see README). About 5 minutes.
- [ ] **You:** create an ExtensionPay account at extensionpay.com, connect Stripe, and
      register the extension with ID **`guidecap`**. Add a plan: **$29, one-time**.
      If `guidecap` is taken, tell Claude the ID you got and it will update `config.js`.
- [ ] **You:** register as a Chrome Web Store developer ($5 one-time), upload
      `dist/guidecap-0.1.0.zip`, and paste in the text and images from STORE_LISTING.md.
      Review usually takes a few days.
- [x] GitHub repo: github.com/jhunter6521/guidecap

## After launch (Claude can do these)
- **Store search:** refine the listing wording based on what brings installs.
- **Launch posts:** r/sysadmin, r/ITCareerQuestions, r/msp, Product Hunt, Hacker News (Show HN).
- **Search traffic:** a small landing page plus "Scribe alternative (free, private)" and
  "how to write IT documentation with screenshots" articles.
- **Track weekly:** installs (Web Store dashboard), Pro sales (ExtensionPay), reviews.

## Roadmap (only once people are using it)
- v0.2: arrows and text boxes on screenshots; crop a screenshot; add a manual screenshot step
- v0.3: record typed text as "Type 'X'" (with an opt-in and auto-skip for password fields);
  a Confluence storage-format export
- Later: a Team plan, if companies ask for shared templates or branding

## Decisions log
- 2026-09-28: Picked Guidecap after the user asked for something small that Claude builds end to end.
  $29 one-time Pro (undercuts Folge at $89 and avoids Scribe's subscription).
