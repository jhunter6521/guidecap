# Guidecap: launch and money plan

_Started: 2026-09-28_

## Why this app
- **People pay for this.** Scribe charges about $25/user/month and Tango is similar.
  Folge sells a local-only desktop version for $89 one-time. Dubble, a small indie
  competitor, makes about $2.7K/month.
- **The gap (corrected 2026-09-29):** we first thought no local-only extension offered
  **redaction** or **Markdown export**. That was wrong: Kadr and Step Tracker offer both for free
  (see Competitors). They have almost no users, so the real contest is being found in store
  search. What stays ours: **automatic** redaction worked out from the page (v0.2), solid-box
  redaction instead of blur, never recording typed text, and a one-time price.
- **Where buyers find it:** Chrome Web Store search ("step by step guide", "scribe
  alternative", "SOP", "how-to screenshots").
- **Running cost:** $0. No servers. ExtensionPay handles payments and licensing.

## Honest expectations
Most extensions get few installs. Realistic targets for a focused indie extension:
about $100–500/month within 6–12 months, and $1–3K/month within 12–18 months if it
catches on. At $29, 10 sales/month is $290/month. This is a small bet, not a sure thing.

## Competitors (checked 2026-09-29)
| Tool | Price | Redaction | Markdown | Local-only | Users |
|---|---|---|---|---|---|
| Scribe | Free, Pro $25/mo | Pro blur; auto-redaction is Enterprise | Pro | No | Market leader |
| Tango | Free (5 guides), Pro $22/mo | Pro blur; auto-blur is Enterprise | Paid | No | Large |
| Folge (desktop) | 5 guides free, $89 once | Blur | Yes, plus Word, PPT, Confluence | Yes | n/a |
| Dubble | Free, Pro $18/mo | Free blur | Free "Magic Copy" | No | 10k |
| Kadr | Free, open source | Free, detects PII in the image | Free | Yes | 3 |
| Step Tracker | Free | Free, by hand | Free, plus Word, video | Yes | 68 |
| Chrome Step Recorder | Free | None | No | Yes | 4k, not updated since 2023 |

What we lack that others have: arrows and text on screenshots, crop, Word export, and
copying a guide into Notion or Confluence in one step.

Our angles: auto-redaction at capture time using page structure (the paid tools only offer it on
Enterprise plans); solid boxes, which can't be reversed like blur sometimes can; never recording keystrokes;
and replacing Windows Steps Recorder (PSR), which Microsoft has deprecated. Step Tracker already
uses the "Steps Recorder" name.

## Launch checklist
Everything else has been done by Claude.

- [x] Build the extension (v0.1.0) and test it end-to-end in headless Chrome
- [x] Store listing text, screenshots, promo tile ([STORE_LISTING.md](STORE_LISTING.md), `store/out/`)
- [x] Landing page + privacy policy in `site/`
- [x] **You:** in Cloudflare, go to Workers & Pages → Create → Import a repository → `jhunter6521/guidecap`,
      with project name `guidecap`. Leave the build settings at their defaults; `wrangler.jsonc` handles them.
- [x] **You:** try it in Chrome (Load unpacked, see README). About 5 minutes.
- [x] **You:** create an ExtensionPay account at extensionpay.com, connect Stripe, and
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
- v0.2: **auto-redaction** (the new Pro headline). At each click, find input fields, emails and
  API-key-like text on the page and black them out automatically, with an easy undo. Then
  consider making manual redaction free, since free alternatives already offer it.
- v0.2 or v0.3: arrows and text boxes on screenshots; crop a screenshot; add a manual screenshot step;
  copy a guide to the clipboard for pasting into Notion or Confluence
- v0.3: record typed text as "Type 'X'" (with an opt-in and auto-skip for password fields);
  a Confluence storage-format export
- Later: a Team plan, if companies ask for shared templates or branding

## Decisions log
- 2026-09-28: Picked Guidecap after the user asked for something small that Claude builds end to end.
  $29 one-time Pro (undercuts Folge at $89 and avoids Scribe's subscription).
- 2026-09-29: Competitor research showed free local-only tools already have redaction and Markdown.
  Decided to launch v0.1 as is, stress solid-box redaction, no keystroke recording and the Steps
  Recorder angle in the listing, and make auto-redaction the v0.2 Pro headline.
