# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this repo is

`bloomstudio-pages` is a small collection of **standalone, self-contained HTML
pages** for **bloom studio** — a Japanese direction / design / AI-support studio.
Each page is embedded into a Wix site via **URL embed** (an `<iframe>` pointing at
the hosted HTML). There is no build step, no framework, no package manager, and no
server-side code. Each `.html` file is a complete, independent deliverable.

Content is in **Japanese** (`<html lang="ja">`). Preserve the tone: calm, warm,
plain-spoken, reassuring — aimed at small-business owners (e.g. salon owners aged
40–60). Avoid hype and jargon.

## Files

| File | Purpose | Title |
| --- | --- | --- |
| `price_mai_web.html` | Price list ("MAI" pricing variant) — AI lessons, direction, and production services with prices | 料金表｜bloom studio（MAI） |
| `lua_jisseki.html` | Case study / works page for the client "ヘナ専門美容室 LUA 様" (before → work → after → CTA) | お手伝いした事例｜ヘナ専門美容室 LUA 様 |
| `contact_web.html` | Contact page — LINE consultation CTA plus a 3-step "flow" section | お問い合わせ｜bloom studio |
| `README.md` | One-line description | — |

Naming is descriptive and ad hoc (page purpose + optional client/variant tag).
When adding a page, follow the same pattern: `<purpose>_<variant>.html`.

## Shared design system

All pages repeat the same inline CSS design system. Keep it consistent when
editing or adding pages — copy the tokens and structural patterns rather than
inventing new ones.

**Color tokens** (declared as CSS custom properties in `:root`):

```css
:root{
  --navy:#1B2A4A;  /* headers, footers, primary text accents */
  --gold:#B99A5B;  /* CTA buttons, small-caps labels, accents */
  --ink:#2E3440;   /* body text */
  --sub:#6B7280;   /* secondary/muted text */
  --line:#E3DDD2;  /* dividers */
  --bg:#FDFCF9;    /* page/card background */
  --soft:#F5F2EB;  /* soft fill (declared; used sparingly) */
}
```

Page background outside the card is `#EDEAE3`; the content sits in a centered
card (`.wrap`, `max-width:680px`).

**Typography**
- Japanese body: `"Yu Mincho","YuMincho","Hiragino Mincho ProN",serif`
- Latin / display (brand name, PRICE/CONTACT titles): `"Times New Roman",serif`,
  with wide `letter-spacing` (`.2em`–`.4em`).

**Structural conventions**
- Every page is mobile-first: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  a single `.wrap` column capped at `680px`.
- Reset: `*{ box-sizing:border-box; margin:0; padding:0; }`.
- `.head` — navy block with `.brand` ("bloom studio" + a `<small>` tagline like
  `DIRECTION / DESIGN`) and a large title.
- `.foot` — navy block with `bloom studio` and the tagline
  `AI・デザイン・ホームページ制作`.
- `h2` section headers: navy background, white text, a gold English label in a
  `.en` span (e.g. `<span class="en">ABOUT</span>`).
- `.cta a` — gold pill button linking to the official LINE account.

**Shared LINE CTA link** (used across pages):
`https://line.me/R/ti/p/%40541xvlrw`

## Conventions when editing

- **Keep pages self-contained.** All CSS stays inline in `<style>`. Do not add
  external stylesheets, fonts, scripts, images, or CDN links — pages must render
  standalone inside a Wix iframe with no dependencies.
- **Match the existing design tokens and structure** rather than introducing new
  colors, fonts, or layout patterns. If a change should apply everywhere, update
  each file consistently (there is no shared/partial include).
- **Preserve Japanese content and tone.** Only change copy when asked. Keep
  `lang="ja"` and `<meta charset="UTF-8">`.
- **Prices and client details are real business content** — do not alter numbers,
  service names, or client names unless explicitly requested.
- Line breaks in copy use explicit `<br>` for intentional phrasing; respect them.

## Git workflow

- Development branch for current work: `claude/claude-md-docs-tyq5pm`.
- Default branch: `main`.
- Commit with clear, descriptive messages. Push with
  `git push -u origin <branch-name>`.
- There is nothing to build, lint, or test — validation is visual. To check a
  page, open the `.html` file directly in a browser (ideally at a mobile width,
  since these render inside a ~mobile iframe).

## Deployment

Pages are consumed by Wix via URL embed, so the hosted URL of each `.html` file
is what matters. Do not rename files without confirming the embed URLs are
updated on the Wix side — a rename breaks the live embed.
