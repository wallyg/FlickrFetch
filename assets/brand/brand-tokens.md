# FlickrFetch brand tokens

Source of truth for color, type and the component rules. Tokens live in `src/renderer/index.html` (`:root`). Components reference them as `var(--ff-…)`; do not hardcode hex values.

Extended 24 Nov 2026 (Design System Pass, #219). The reasoning, the contrast numbers and the alternatives that were tried are in `docs/design/brand-extension-proposal.md`.

Contrast: WCAG ratios against white. Text has to reach 4.5, and dots, bars, rings and icons 3. Every colour below is listed with what it is allowed to do, because a colour that is fine as a dot can be unreadable as small text.

## Brand colours

| Token | Value | Use |
|---|---|---|
| `--ff-blue` | `#0063DC` (5.5) | Links, navigation, the outlined "Do this" button, "Flickr" half of wordmark |
| `--ff-pink` | `#FF0084` (3.8) | Selection outline, active-tab underline, check badges, "Fetch" half of wordmark. **Never small text** |
| `--ff-pink-action` | `#D00069` (5.4) | Main button fill (white text), and text on a selected row or chip |
| `--ff-tint` | `#FFF0F7` | Selected: soft pink fill |
| `--ff-navy` | `#1B2946` (14.5) | Headings, key text, icons. Not a button colour |
| `--ff-cream` | `#FCFAF6` | Brand surfaces (About, splash, onboarding) |
| `--ff-warm` | `#F7F5F1` | Warm panel background |

## Text and neutrals

| Token | Value | Use |
|---|---|---|
| `--ff-text` | `#111827` (17.7) | Body text |
| `--ff-text-secondary` | `#667085` (5.0) | Hints, dates, counts, captions: anything the reader has to read |
| `--ff-text-muted` | `#9CA3AF` (2.5) | **Never text that has to be read.** Icons, disabled controls, dividers |
| `--ff-surface` | `#FFFFFF` | Cards, panels, dialogs, inputs. Use this, not a typed `#fff` |
| `--ff-grey-100` | `#F3F4F6` | Quiet fill: disabled fields |
| `--ff-border` | `#E5E7EB` | Hairlines and card edges |
| `--ff-line-strong` | `#D4D4D8` | Button and field edges |
| `--ff-white` | `#FFFFFF` | Text on a filled button |

Old hand-typed greys map as: `#111 #1a1a1a #222 #333 #444` to `--ff-text`; `#555 #666 #6b7280 #777 #888` to `--ff-text-secondary`; `#999 #aaa #bbb` to `--ff-text-secondary` if it is text, `--ff-text-muted` if it is an icon; `#ccc #ddd #eee` to `--ff-border` or `--ff-line-strong`.

## Status: Issue, Warning, Fine, Dealt with

A status has a **mark** (dots, bars, rings), an **ink** (words) and a **pale background**. Green and red mean status only, never branding. Pink is not a status colour.

| Status | Mark | Ink | Pale background |
|---|---|---|---|
| Issue | `--ff-error` `#DC2626` (4.8) | `--ff-error-ink` `#B91C1C` | `--ff-error-bg` `#FCE8E8` |
| Warning | `--ff-warning` `#D97706` (3.2) | `--ff-warning-text` `#92400E` | `--ff-warning-bg` `#FEF3C7` |
| Fine | Light fill `--ff-fine-fill` `#CBD0D8` with a 1.5 px outline `--ff-fine` `#8693A6` (3.1). A dot is a ring | `--ff-text-secondary` | `--ff-grey-100` |
| Dealt with | `--ff-success` `#16A34A` (3.3) | `--ff-success-ink` `#15803D` | `--ff-success-bg` `#E8F8EA` |

- Slices in a ring or bar have a thin white gap between them.
- Words in a status colour use the ink on the pale background, never the mark colour. `--ff-slate` (`#94A3B8`, 2.6) stays only for "cancelled / inactive" marks and merges into Fine in the sweep; as text it is `#64748B`.

## Buttons: one language

| Look | Style | Rule |
|---|---|---|
| Main | Filled `--ff-pink-action`, white text (`primaryBtn`) | One per screen or dialog; commits |
| Do this | Outlined `--ff-blue`, blue text | The action on a row or card |
| Secondary | White with `--ff-line-strong` edge (`quietBtn`) | Everything else you can press |
| Look | Blue text, no box (`linkBtn`) | Opens something to look at, usually on Flickr |
| Put aside | Grey underlined text | Dismiss or defer: "This one is fine", "Not now", "Undo" |
| Destructive | The same shape, `--ff-error-ink` text and edge | Delete, Clear. A final "Yes, delete" is the only red-filled button |

- **A Main button is the same size as the Secondary buttons beside it.** It stands out by its pink fill, not by being taller. A picture on a button is a small icon (about 16 px), never a hero image, and buttons have no drop shadow. (On This Day's "Make a shareable collage" was the one exception; fixed in 3.12, #251. No other screen has a hero button.)

- One label per action across the app.
- Selection (chip, segment, list row, photo) is the soft pink look (`selectedOn`). Switches (on/off) have a pink track.

**Sizes and the sweep (3.13, #262).** `quietBtn` is the standard Secondary button; `smallBtn` is the same a size smaller (3 px 10 px, 12 px text) for a button in a row of text or a narrow bar; `doThisSmallBtn` is the outlined-blue action at that size. A subdued boxed grey button now uses the standard dark text, not grey text. About 85 hand-built buttons moved onto these looks; `tests/buttonGuard.test.ts` counts the boxed or pink buttons still typed out (chips, tabs, cards, tiles and selects among them, plus a few one-offs) and only lets that number go down. The filled blue buttons are gone: Download All Albums and the Discover people Search are Main (pink), and the Settings update button is a small Secondary. Left on purpose: the filled red confirm buttons, the dashed "show more" buttons, icon-only square buttons, and the sign-in page.

**Flickr's tools.** Opening one Flickr page is "Open on Flickr" with the external-link icon. Opening many photos in Flickr's own editor is "Open in Flickr's organizer" with the same icon (with a count where it helps: "(5)", "selected"). Never "Fix ..." and never "batch editor" (`tests/buttonGuard.test.ts` keeps it that way).

## Hover text

Every hover text uses our own card, the same look as the info notes: white surface, `--ff-border` edge, 8 px corners, soft shadow, 12.5 px text. A short name (an icon-only control) is one plain line in that card; an explanation uses the `RichNote` format (a heading, then bullets). Native `title=` tooltips are replaced during the Design System Pass.

The card must: stay fully inside the window (flip above or below, and slide sideways, instead of being cut off); not be clipped by a scrolling or `overflow: hidden` container (it is drawn at the top level of the page, not inside the control); work on disabled controls and on cut-off text; and appear for keyboard focus as well as the mouse.

How this is kept honest: the placement is one plain function (card size, the control's position and the window size in; a position out) with a test in `npm test` that tries every edge and corner, a card bigger than the room, and a tiny window, and fails if any part of the card could leave the window. A second test fails if the card is ever rendered inside its control instead of at the top level of the page, which is what would let a scrolling or `overflow: hidden` container clip it.

One info icon look everywhere; the Health Check one is the pulse (heartbeat) icon (placement to be decided on screen).

## Dialogs (3.13, #236)

Every dialog is built with `ui/Dialog.tsx` and its close mark is `ui/CloseButton.tsx`. Found before: eight dialogs with five widths (360, 420, 480, 640, 720), five shadows, two backdrop colours (the What's New window used a darker one), three different close marks (one a text cross), Esc working in four of them, clicking the backdrop closing three, and no rule for focus.

The rule: a dimmed backdrop (`--ff-scrim`) on the dialog layer; one card (`--ff-surface`, 12 px corners, `0 12px 40px` strong shadow); four widths (small 360 for a question, medium 480, wide 640 for Settings and long text, large 720, or a width of its own for the collage window); a drawn cross in the top right named "Close"; **Esc closes the dialog on top and only that one** (a note opened over About closes first); **clicking the backdrop closes it**; focus moves into the dialog when it opens, Tab stays inside, and focus returns to where it was when it closes. The History panel is a side panel, not a dialog: it keeps its own shape and gets Esc. `tests/dialogs.test.ts` keeps new dialogs on the shell.

## Sizes

- **Text:** 11 (labels, the floor), 12, 13 (body), 14 (card titles), 16, 18, 22, 24 (headings).
- **Corners:** 4, 6 (buttons, fields), 8, 12 (cards), 50 (pills, round).
- **Headings** (3.14, #272): three looks in `ui/kit.ts`, all navy and bold: `headingScreen` 18 (a screen or a dialog), `headingDialog` 16 (a small question), `headingCard` 14 (a card, row or group). A screen spreads one and adds only what is its own. No italics anywhere; a note is plain text. Chips: `chip` (pressable; selected is `selectedOn`), `chipCount`, `chipRemovable`, `chipLabel` (a label, not a control). Guards in `tests/styleScales.test.ts`.
- **Spacing** (padding, margin, gap; 3.14, #241): 0, 2, 4, 6, 8, 12, 16, 24, 32. Anything above 32 is a layout size, not a gap, and is free. A size between two steps goes to the nearest; a tie to the smaller. Main and Secondary buttons share one padding (4px 12px) so they are the same size side by side. `tests/spacingGuard.test.ts` fails on a size off the scale (ceilings in `tests/spacing-ceiling.json`, now empty). Measured in `docs/design/spacing-audit.md`.
- **Light only.** The app has no dark mode and this pass does not add one; `--ff-surface` keeps it possible later.

## Fonts

Lato is bundled in two weights only, **400 (regular) and 700 (bold)**, plus 400 italic. Use only those. Weights 500, 600 and 800 do not exist in the bundle, so today they quietly turn into 400 or 700 (127 uses at 24 Nov 2026); the sweep moves 600 and 800 to 700 and 500 to 400, which is what the screen already shows, so nothing looks different. Whether to add a real semibold later is #244. Text size floor 11 px.

## Layers and shadows

One short scale, so nothing fights over what sits on top (there were 19 different layer numbers up to 9999 and 36 different shadows):

| Layer | Number | Shadow |
|---|---|---|
| Page | 0 | none |
| Sticky bar, raised card | 10 | none, or the hairline `--ff-border` |
| Menu, dropdown | 100 | `0 4px 16px rgba(0,0,0,0.18)` |
| Dialog and its backdrop | 200 | `0 12px 48px rgba(0,0,0,0.3)` |
| Toast, banner | 300 | `0 4px 16px rgba(0,0,0,0.18)` |
| Hover card (D3) | 400 | `0 10px 30px rgba(0,0,0,0.18)` |

The hover card sits above everything, dialogs included. The sweep maps every existing layer number and shadow to the nearest of these.

## Icons

One style: line icons, stroke 1.5, round ends and corners, drawn on a 16 px grid, colour from the surrounding text. Today there are 70 inline icons with five stroke widths (1.5, 1.8, 2, 2.2, 2.5) and plain characters doing icon work (✕ 40 times, ✓ 21, ↗ 13, ⚠ 9). Controls (close, check, external link, warning, chevron) use a drawn icon, not a character. The cog (Settings) and the pulse (Health Check) are drawn to this rule. Sizes are confirmed in the sweep.

## States, focus and motion

Written once, in `src/renderer/index.html` (built in 3.13, #232; `tests/states.test.ts` keeps them there):

- **Focus:** every control shows a visible ring for keyboard users: 2 px `--ff-blue`, 2 px away from the edge, set once for the whole app with `:focus-visible` (with `!important`, because some controls turn their outline off inline). A mouse click does not show it.
- **Hover and pressed:** a button with a 1 px edge, and a select, takes a grey wash over its own colour (`--ff-wash-hover` 5% black, `--ff-wash-press` 10%), so a pink button stays pink and gets darker. Buttons without an edge (text links, tiles) keep whatever hover look their component gives them. The older hand-written hover handlers stay until the button sweep (#262).
- **Disabled:** half opacity and a not-allowed pointer; a disabled field is filled `--ff-grey-100`. A component that dims itself keeps its own opacity.
- **Checkboxes and radio buttons** use `--ff-pink-action` as their accent, the same pink as every other selection.
- **Motion:** transitions are 200 ms or shorter. When the Mac is set to reduce motion, animations and transitions are switched off. A spinner that shows work is going on keeps turning (`data-motion="keep"`).
- **Dark Mode:** `color-scheme: light` is declared, so form controls and scrollbars stay light; looking at it on screen is #239.

## Fields: text boxes, number boxes and selects (3.13, #237)

One look in `ui/kit.ts`: a 1 px `--ff-line-strong` edge (the quiet button's edge), 6 px corners, `--ff-surface` fill, 13 px text. `fieldBox` is the standard size (5 px 8 px padding, about as tall as a quiet button); `fieldCompact` (3 px 6 px) sits inside a row of text or a settings line; `selectBox` and `selectCompact` add the pointer. Spread one and add only what is special (a width, a smaller text size, room for a clear button): `{ ...fieldCompact, width: 72 }`. A box typed out in full fails `tests/states.test.ts`.

Found before the sweep: 14 text boxes and selects typed out by hand with six paddings (2 px 6 px up to 7 px 28 px) and two edge colours (`--ff-border` and `--ff-line-strong`); all 14 now use the kit. Left for later because they are search boxes inside their own wrapper with a search icon and a clear button (History, Discover people and groups, Collections, Albums, Photostream filter, Login): they look the same, but each lays itself out.

## Wording

One label per action, one phrase per state:
- **Cancel** abandons something; **Close** dismisses a window or note; **Done** finishes a task.
- **Try again** (retire "Retry") after something failed.
- **Loading…** when nothing more specific helps; otherwise "Loading <the thing>…". "Checking <the thing>…" only where Health Check is working. Not "Reading", "Getting" or "Looking through" (decided 26 Nov, #243).
- Buttons name what happens ("Download these 12"), never "OK".
- A problem reads "Couldn't <do it>." ("Couldn't load albums."), followed by Try again where it helps. Never "Failed to ...", "... could not be loaded" or "please".
- Health Check keeps its own words (snapshot, audits, check): the owner prefers them (decided 26 Nov).

Voice (draft, refined in the edit pass, #243): simple, clear, not too wordy. Plain words, said in the person's terms, no jargon, no apologies, no "please". One idea per line. A button is one to three words, a hint is one short sentence, the first line of a note is about a dozen words, and rules go in bullets. Sentence case; numerals with thousands separators. The Health Check texts (`docs/copy/check-copy.md`) set the tone.

The sweep produces the list of every label, loading line and message in use, with a proposed rewrite beside each for review, and maps each to these.

## Map colours

The map is an illustration drawn on a canvas, so it gets its own named colours: `--ff-map-water` `#DBE7F3`, `--ff-map-land` `#F4F1EA` and `--ff-map-edge` `#C4BEB0`. Circles use `--ff-blue` (88% opaque), single dots `--ff-navy`, the selected ring `--ff-pink`. The 15 typed colours in the Map panel and the cache controls move to these.

## Decisions

- **Navy is `#1B2946`.** `brand-color-guide.png` says `#1B2946`; `brand-style-guide.png` says `#0E2A4D`. The app uses `#1B2946`, so that is canonical. The style guide's dark wordmark background (`#0E2A4D`) is a separate artwork color and is left as drawn.
- **Primary buttons use `--ff-pink-action` (`#D00069`), not `#FF0084`.** White text on `#FF0084` is about 3.8:1, below 4.5; `#D00069` is 5.4.
- **Amber is `#D97706`** (was `#F59E0B`, 2.2:1) so warning dots, bars and rings reach 3:1.
- **Fine is a light fill with a thin 3:1 outline.** A solid mid-grey was rejected because it has nearly the same lightness as green and amber and blends into them in a ring.
- **The blue outlined "Do this" button is official** (row-level actions); pink stays one per screen.
- **Every hover text is our own card** (decided over keeping native tooltips for short names), with placement and cutoff handled.

## Typography

Lato, bundled via `@fontsource/lato` (400, 700, 400 italic) and applied globally in `index.html`. Bold for titles and key UI, Regular for body and labels, Italic for the tagline. Monospace is used only for filename examples.

## Files in this folder

| File | Purpose |
|---|---|
| `icon.icns`, `icon.png` | App icon (builder uses `icon.icns`) |
| `logo-tray.png` | Full-size logo (renderer uses a downsized copy at `src/renderer/assets/logo-tray.png`) |
| `splash.png` | Splash screen |
| `wordmark-light.webp` | Wordmark on cream background |
| `wave-texture.png` | 1200×630 wave texture for brand moments |
| `dmg-background.png`, `@2x` | DMG installer window background (540×380) |
| `social-preview.png` | GitHub social preview |
| `brand-color-guide.png`, `brand-style-guide.png` | Reference guides |

## Known gaps

- Dark-background wordmark (white "Flickr", pink "Fetch" on navy) is shown in the style guide but no source file exists here. It needs the original artwork exported.
- No vector (SVG) source for the icon or wordmark.
- The sweep (replacing hand-typed colours, sizes and hover texts with the above) and the `npm test` guard against new hand-typed colours are still to do.


## Added in the 3.12 sweep (#234, #233)

| Token | Value | Use |
|---|---|---|
| `--ff-info-bg` / `--ff-info-line` | `#EEF5FF` / `#CFE0F7` | Pale blue fill and edge for a note or chip that informs. Words on it use `--ff-blue` |
| `--ff-stage` | `#111111` | The dark behind a photo or video |
| `--ff-shadow-soft` / `-mid` / `-strong` | black at 12% / 18% / 30% | The colour of a shadow: small raised things, menus and panels, dialogs and the photo view |
| `--ff-shadow-menu` | `0 6px 20px` in `--ff-shadow-mid`-like black | A whole shadow for a menu or card floating over the page |
| `--ff-scrim` / `--ff-scrim-strong` | black at 50% / 65% | The dimmed backdrop behind a dialog; a darker veil over a photo |
| `--ff-badge-bg` | black at 55% | A small label sitting on a photo |
| `--ff-glass` / `--ff-glass-soft` | white at 85% / 75% | A white panel or chip over a photo or the map |

Tints of a brand colour (a hover wash, a selected row) are written `color-mix(in srgb, var(--ff-pink) 6%, transparent)`, so the colour stays the token's. Nothing in the interface types a hex or rgba colour; `npm test` keeps it that way (tests/colourGuard.test.ts). Left on purpose: the collage picture's own artwork (Share dialog), the three privacy badge hues in the photo view, the brand wave, and computed heat colours.

## Type and corner scales (3.12, #231)

- **Weights:** 400 and 700 only. 500 became 400, 600 and 800 became 700 (what the screen already showed).
- **Text sizes:** 11, 12, 13, 14, 16, 18, 22, 24 px; display sizes above 24 are free. Nothing is smaller than 11. The odd sizes moved to the nearest (8, 9, 10 and 10.5 to 11; 11.5 and 12.5 to 12; 13.5 and 15 to 14; 17 to 16; 20 to 18; 26 to 24).
- **Corners:** 0, 4, 6, 8, 12 and 50 (a pill). 1, 2, 3 to 4; 5 and 7 to 6; 9 and 10 to 8; 14 and 16 to 12; 20 and 99 to 50. A shape such as `'3px 3px 0 0'` is its own thing.
- `npm test` keeps all three (tests/styleScales.test.ts).
