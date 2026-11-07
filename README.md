# FlickrFetch

Mac desktop app for downloading your personal Flickr library at original resolution with metadata embedded.

## The Problem FlickrFetch Solves

Flickr is one of the longest-running photo communities on the internet, and for many photographers it holds years — sometimes decades — of work. But getting your photos off Flickr in any meaningful way has always been harder than it should be.

Flickr's native export tools let you download your photos, but the files you get are largely stripped of context. The titles, descriptions, tags, album names, dates, and license information you spent years adding live on Flickr's servers — not in the files themselves. Download a photo through Flickr's interface and you get a JPEG. The story behind it stays behind.

This matters because metadata embedded in a file travels with it. It survives a move to a new photo library, a backup drive, or a different platform. Metadata that only exists in Flickr's database disappears the moment Flickr does — or the moment you leave.

FlickrFetch was built to close that gap. It downloads photos and videos from your Flickr library and embeds the metadata directly into each file using industry-standard EXIF and IPTC fields — title, description, tags, GPS coordinates, capture date, album, license, and more. The result is a true archive: files that are self-describing, portable, and not dependent on Flickr remaining online or your account remaining active.

For photographers who built their archive on Flickr, FlickrFetch is the difference between a backup and an archive.

## Features

- Sign in with your Flickr account via OAuth
- Browse your photostream, albums, and collections
- Download photos and videos at full original resolution
- Metadata embedded automatically: title, description, tags, GPS, date taken, creator, CC license
- Per-field metadata controls — toggle each field on or off individually
- Batch download entire albums or multi-select photos with a live progress queue
- Queue multiple albums — they run in order automatically
- **Smart Sync** — skip photos you've already downloaded, or fetch only photos updated since your last download
- **Download history** — track every batch and browse per-photo download records
- Full-text search with operators (contains, starts with, ends with, exact)
- Tag filter, date range filter, and privacy filter (public / friends / family / private)
- Photo detail view with full metadata panel, navigation, and video playback
- Flexible file naming: core format, separator, date, sequence number, custom text, case transforms
- Configurable download folder, conflict behavior, dock progress, and completion notifications

## Download

[Latest release →](https://github.com/wallyg/FlickrFetch/releases/latest)

**Recommended:** use the `.pkg` installer — macOS walks you through a standard install with no extra steps.

If you use the `.dmg`, run this once after dragging to Applications:

```
xattr -cr /Applications/FlickrFetch.app
```

## Requirements

- macOS (Apple Silicon)
- Node.js 18+

## Setup

1. Clone the repo
2. Get a Flickr API key at [flickr.com/services/apps](https://www.flickr.com/services/apps)
3. Copy the credentials file and add your keys:
   ```
   cp src/main/config.example.ts src/main/config.ts
   ```
   Then edit `src/main/config.ts` with your API key and secret.
4. Install dependencies:
   ```
   npm install
   ```

## Development

```
npm run dev
```

## Build

```
npm run build
```

Outputs both a DMG and a PKG installer to `dist/`.

## Tech Stack

- Electron + React + TypeScript (electron-vite)
- OAuth 1.0a via `oauth-1.0a`
- ExifTool (bundled via `exiftool-vendored`) for metadata embedding
- better-sqlite3 for download history storage
- electron-builder for DMG and PKG packaging

## Notes

- `src/main/config.ts` is gitignored — never commit your API credentials
- App is not yet code-signed; the PKG installer handles Gatekeeper automatically

## Roadmap

Open issues track everything planned:

- [View all open issues](https://github.com/wallyg/FlickrFetch/issues)
- [v3.0](https://github.com/wallyg/FlickrFetch/issues?q=is%3Aopen+label%3Av3.0)
- [v4.0+](https://github.com/wallyg/FlickrFetch/issues?q=is%3Aopen+label%3Av4.0)

---

© 2026 Wally Gobetz
