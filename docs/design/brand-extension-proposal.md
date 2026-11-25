# Brand guide extension: proposal for sign-off (v3.11 Design System Pass, step 1)

Status: SIGNED OFF 24 Nov 2026 and merged into `assets/brand/brand-tokens.md` and `src/renderer/index.html`. Decisions: D1 deeper amber `#D97706`, Fine = today's light grey fill with a 3:1 outline (`#8693A6`); D2 the blue outlined "Do this" button is official; D3 every hover text is our own card, with a test for placement and cutoff. This file stays as the record of the reasoning. Still to do: the `npm test` guard against new hand-typed colours, then the sweep.

How to read it: **D1 to D3 are your calls** (they change how the app looks or feels). Everything else is a default I'd just apply. Contrast numbers are WCAG ratios (4.5 or more for small text, 3 or more for icons, dots, bars and rings).

---

## What stays exactly as it is

Navy `#1B2946`. `--ff-pink-action` `#D00069` for filled buttons. Pink `#FF0084` for selection (non-text). Blue `#0063DC` for links and navigation. Lato. The soft pink selected look (`--ff-tint` fill, pink edge). The shared button, chip and segment styles in `ui/kit.ts`. The tokens `--ff-tint`, `--ff-warm` and `--ff-line-strong`, which just get written into the guide.

---

## 1. Text colours (readability)

| Role | Token | Value | On white | Rule |
|---|---|---|---|---|
| Main text | `--ff-text` | `#111827` | 17.7 | Body, titles in dark |
| Headings | `--ff-navy` | `#1B2946` | 14.5 | Titles, key text |
| Secondary text | `--ff-text-secondary` | `#667085` | 5.0 | Hints, dates, counts, captions, anything the reader has to read |
| Quiet marks | `--ff-text-muted` | `#9CA3AF` | 2.5 | **Never text that has to be read.** Icons, disabled controls, dividers only |

- The guide used to say muted is "dates, tertiary text". That produced the 2.5:1 problem, so dates and tertiary text move to secondary.
- Hand-typed greys map like this in the sweep: `#111 #1a1a1a #222 #333 #444` to main text; `#555 #666 #6b7280 #777 #888` to secondary text; `#999 #aaa #bbb` to secondary if it is text, or quiet marks if it is an icon; `#ccc #ddd #eee` to `--ff-border` or `--ff-line-strong`.
- Bright pink is not a text colour (3.8). Pink text becomes `--ff-pink-action` (5.4). About 12 places today.
- Text floor: 11px. Today 22 places use 8 to 10px; they move to 11.

## 2. Status colours: one set of four (D1)

Each status gets three parts: a **mark** (dots, bars, rings), an **ink** (text that sits on a pale background) and a **pale background**.

| Status | Mark | Ink | Pale background | Notes |
|---|---|---|---|---|
| Issue | `--ff-error` `#DC2626` (4.8) | **new** `--ff-error-ink` `#B91C1C` (6.5; 5.5 on its background) | `--ff-error-bg` `#FCE8E8` | Red, as you decided. Replaces pink as Issue |
| Warning | `--ff-warning` `#F59E0B` (2.2) | `--ff-warning-text` `#92400E` (7.1) | `--ff-warning-bg` `#FEF3C7` | Amber mark is too pale as a dot or bar; see D1 |
| Fine | **new** `--ff-fine` `#8693A6` (3.1) as a 1.5 px outline around a light fill `#CBD0D8` (today's grey; token `--ff-fine-fill`). A dot becomes a ring | `--ff-text-secondary` | **new** `--ff-grey-100` `#F3F4F6` | The fill is unchanged from today; the thin outline is the only new thing and is the lightest slate that still reaches 3:1 against white. A solid mid-grey was tried (`#7C8AA0`) and rejected: it has nearly the same lightness as the green and deeper amber next to it, so it is hard to tell apart in a ring |
| Dealt with | `--ff-success` `#16A34A` (3.3) | **new** `--ff-success-ink` `#15803D` (5.0; 4.6 on its background) | `--ff-success-bg` `#E8F8EA` | Green stays "status only" |

- **D1 (your call, visible change):** meeting the 3:1 minimum for dots and bars means the amber mark gets a bit deeper, `#D97706` (3.2) instead of `#F59E0B`. Fine keeps today's light grey fill and gains a thin slate outline at 3:1, so it holds its edge on white and still reads as the quiet one (DECIDED by the owner, with the deeper amber; stripes were considered and passed over). Red and green marks stay. See the colour check page for all four Fine options. If you prefer the current lighter amber, I'd keep it but only ever pair it with a label or the amber ink next to it, never alone. My recommendation is the deeper amber.
- `--ff-slate` `#94A3B8` (2.6) is today's "cancelled / inactive" colour. As text it becomes `#64748B` (4.8); as a mark it merges into `--ff-fine`.
- Pink is not a status colour. The Overview bar chart highlights its biggest bar in pink next to a hand-typed blue; how that emphasis should look gets settled in the Overview refresh (#220), not here.

## 3. Neutral and surface scale

| Token | Value | Use |
|---|---|---|
| `--ff-surface` (new) | `#FFFFFF` | Cards, panels, dialogs, inputs. Replaces hand-typed `#fff` backgrounds, so the surface can be changed in one place (and a dark mode stays possible later) |
| `--ff-cream` | `#FCFAF6` | Brand moments (About, splash, onboarding) |
| `--ff-warm` | `#F7F5F1` | Warm panel background (already in use, now documented) |
| `--ff-grey-100` (new) | `#F3F4F6` | Quiet fill: Fine rows, disabled fields |
| `--ff-border` | `#E5E7EB` | Hairlines and card edges |
| `--ff-line-strong` | `#D4D4D8` | Button and field edges |

## 4. Buttons, one language (D2)

| Look | Style | Rule |
|---|---|---|
| **Main** | Filled `--ff-pink-action`, white text | One per screen or dialog: the thing that commits (Rebuild, Download, Turn on) |
| **Do this** | Outlined blue (the 3.8 "fix" button), blue text | The action on a row or card: Open in Flickr's organizer, Fix |
| **Secondary** | White with the quiet edge (`quietBtn`) | Everything else you can press: Show the photos, Zoom in here, Change |
| **Look** | Blue text, no box (`linkBtn`) | Opens something to look at, usually on Flickr: Open album ↗ |
| **Put aside** | Grey underlined text | Dismiss or defer: This one is fine, Not now, Undo |
| **Destructive** | The same shape as above, with `--ff-error-ink` text and edge | Delete, Clear. A final "Yes, delete" is the only red-filled button |

- **D2 (your call):** this makes the blue outlined button official instead of retiring it, because rows with their own action are most of Health Check. The old rule "one pink per screen" stays, but screens with several rows no longer need several pinks. One label per action across the app (one name for "open in Flickr", one for "mark fine").
- Selection (chip, segment, list row, photo) keeps the soft pink look.
- Switches (on/off) keep the pink track. Selection chips keep the soft pink. Two different things, two looks; stragglers in `PhotoGrid`, `HistoryPanel` and the download box get brought in line.

## 5. Hover text (D3)

| Kind | Use it for | Format |
|---|---|---|
| Native tooltip (`title=`) | The name of an icon-only control, up to about six words ("Zoom in", "Open on Flickr") | Plain, no sentences |
| Info note (`InfoTip`, `HoverNote`, the info icon) | Anything longer: what a check does, why a number is what it is | The `RichNote` rule format: a heading, then bullets |

- 98 native tooltips exist today. The sweep reads each one: keep it if it is a short name, otherwise turn it into an info note.
- Native tooltips cannot be formatted, so "one format everywhere" is only possible by that split. **D3 (your call):** I'd keep the split rather than replace native tooltips with our own component, which costs a lot to build and test for little gain.
- One info icon look everywhere (today there are two). The Health Check one becomes the pulse (heartbeat) icon you liked. Where it sits is still open (my suggestion: the right end of the Health Check sub-tab row, opening "How Health Check works"); decide when you see it.

## 6. Sizes

- **Text:** 11 (labels, floor), 12 (small), 13 (body), 14 (card titles), 16, 18, 22 and 24 for headings. The odd 15, 17, 20, 26, 34 and 38 get moved to the nearest.
- **Corners:** 4, 6 (buttons, fields), 8, 12 (cards), 50 (pills and round). The odd 2, 3, 5, 7, 9, 10, 11, 14, 16 and 20 move to the nearest.
- **Spacing:** no scale proposed. I haven't measured it, and the screens are fairly consistent. Revisit only if the sweep shows a problem.
- **Light only:** the app has no dark mode and this pass does not add one. The guide says so, so nobody wonders. The new `--ff-surface` token keeps it possible later.

## 7. Guard and sweep (steps 2 and 3, after sign-off)

- A check in `npm test` fails when a new hand-typed hex colour is added to the renderer. It starts from today's count (814) and the ceiling only goes down as the sweep proceeds.
- The sweep maps each hand-typed value to the nearest token, you review the visible changes, then it's replaced in one pass with its own UAT.

## Open questions for you

1. **D1:** deeper amber and Fine grey (my recommendation), or keep today's lighter ones and pair them with labels?
2. **D2:** make the blue outlined row button official (my recommendation), or retire it for the grey secondary button?
3. **D3:** native tooltips for short names plus the formatted note for everything longer (my recommendation), or build our own tooltip for all?
