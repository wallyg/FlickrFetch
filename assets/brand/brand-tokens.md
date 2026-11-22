# FlickrFetch brand tokens

Source of truth for color and type. Tokens live in `src/renderer/index.html` (`:root`). Components reference them as `var(--ff-…)`; do not hardcode hex values.

| Token | Value | Use |
|---|---|---|
| `--ff-blue` | `#0063DC` | Links, navigation, "Flickr" half of wordmark |
| `--ff-pink` | `#FF0084` | Selection, active tab, "Fetch" half of wordmark, accents |
| `--ff-pink-action` | `#D00069` | Primary button fill (see note) |
| `--ff-navy` | `#1B2946` | Headings, key text, icons |
| `--ff-cream` | `#FCFAF6` | Brand surfaces (About, splash, onboarding) |
| `--ff-white` | `#FFFFFF` | Content backgrounds |
| `--ff-text` | `#111827` | Primary body text |
| `--ff-text-secondary` | `#667085` | Secondary text, hints |
| `--ff-text-muted` | `#9CA3AF` | Dates, tertiary text |
| `--ff-border` | `#E5E7EB` | Borders, dividers |
| `--ff-success` / `--ff-success-bg` | `#16A34A` / `#E8F8EA` | Success, completed, saved |
| `--ff-error` / `--ff-error-bg` | `#DC2626` / `#FCE8E8` | Errors, destructive actions |
| `--ff-warning` | `#F59E0B` | Partial success, caution |
| `--ff-slate` | `#94A3B8` | Cancelled / inactive status |

## Decisions

- **Navy is `#1B2946`.** `brand-color-guide.png` says `#1B2946`; `brand-style-guide.png` says `#0E2A4D`. The app uses `#1B2946`, so that is canonical. The style guide's dark wordmark background (`#0E2A4D`) is a separate artwork color and is left as drawn.
- **Primary buttons use `--ff-pink-action` (`#D00069`), not `#FF0084`.** White text on `#FF0084` is about 3.8:1, below the 4.5:1 WCAG AA minimum for normal text; `#D00069` is about 5.4:1. Use `--ff-pink` for non-text accents (selection outline, active-tab underline, check badges).
- **Green and red mean status only**, never branding.

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
