# Unslop summary: AI Sales Agent frontend

Method by Damir Sokolovsky (@heydamir), CC BY 4.0. Video credit: "unslop by @heydamir".

Video: `unslop/unslop-story.mp4` (square, 8.1 s, Overview screen before to after). Source: `unslop/unslop-story/story.html`.

## Direction
Product: a CRM where AI finds prospects, writes outreach and replies, and hands the lead to a human when it is ready to talk money.
Character: calm, exact, a little warm. World: a deal ledger at a desk at night.
Signature: a flat status dot plus a word for AI state (active, paused, your turn). No glow, no pulse.

## Files touched
41 files in `apps/web` (all pages, shared components, global CSS, theme, layout), plus new `apps/web/src/components/ui.tsx` (`StatusDot`, `LeadStatus`, `Icon`).
No routes, features, content or section order changed.

## Tokens introduced
- Surfaces (graphite): `#0f0f10` sidebar, `#141415` page, `#19191b` card, `#1e1e20` input, `#232325` raised, `#28282b` hover.
- Hairlines: text colour at 6 / 9 / 16 percent. Text: `#ededed`, `#a1a1a6`, `#85858b`.
- One accent, cobalt: `#3d6fd8` (fills), `#86a9f2` (text and icons). Semantic: `#4cc38a`, `#e3a94d`, `#ee7378`.
- Type: IBM Plex Sans plus IBM Plex Mono for figures, self-hosted via next/font. Weights 400 and 500 (600 rare).
- Radii 4 / 8 / 12 / 16. Spacing on a 4px grid. One easing `cubic-bezier(0.22, 1, 0.36, 1)`, durations 150 / 200 / 300 ms.

## Main before and after
- Purple gradient hero, logo tile, chart bars and glows are gone. The hero is a plain card with a large mono figure.
- Funnel chart: neutral bars with the accent on the leading stage only.
- 91 uppercase uses, 132 letter-spacing uses and the 700 to 800 weights removed. Labels are sentence case.
- Emoji and glyph icons (hand, gear, warning, arrows, tick) replaced by status dots or removed. Coloured outline chips became dot plus word (priority, lead status, AI state).
- Coloured outlined buttons are neutral. Pill radii replaced by 4px tags. `transition: all` and colour shadows removed.
- Copy: page titles shortened (Leads, Activity, Settings, Gmail, Companies...), "Governance", "Dossier", "Intelligence" wording dropped, exclamation mark removed, shouty banner rewritten.
- About 480 hex values and 196 rgba values remapped to the new palette, 128 font sizes and 50 spacing values snapped to the scale.

## Checks
`tsc --noEmit` clean, `next build` passes, API unit tests 340 of 340 pass, Overview, Leads, Conversations verified in the browser. The e2e smoke test is API-only and was not re-run. Not covered: a full visual pass of every secondary page (Gmail, Settings, Onboarding, Notifications), a few remaining Title Case strings, and the Mark won / Mark lost buttons in the deal section still carry green and red outlines.
No generated images were used.
