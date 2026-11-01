# FlickrFetch

Mac desktop app for downloading your personal Flickr library at original resolution with metadata embedded.

## Features

- Sign in with your Flickr account via OAuth
- Browse your photostream, albums, and collections
- Download photos and videos at full original resolution
- Metadata embedded automatically: title, description, tags, GPS, date taken, camera EXIF
- Batch download entire albums with a live progress queue
- Queue multiple albums — they run in order automatically
- Multi-select photos in any grid and download them together
- Flexible file naming: core format, separator, optional date, sequence number, custom text
- Privacy badges and filters (public / friends / family / private)
- Configurable download folder, dock progress bar, and completion notifications

## Requirements

- macOS (Apple Silicon)
- [ExifTool](https://exiftool.org) — install via Homebrew: `brew install exiftool`
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

## Build

```
npm run build
```

The DMG is output to `dist/`.

## Development

```
npm run dev
```

## Tech Stack

- Electron + React + TypeScript (electron-vite)
- OAuth 1.0a via `oauth-1.0a`
- ExifTool for metadata embedding
- electron-builder for DMG packaging

## Notes

- `src/main/config.ts` is gitignored — never commit your API credentials
- Code signing is not configured; macOS will show a Gatekeeper warning on first open (right-click → Open to bypass)

## Roadmap

Open issues track everything planned — bugs, upcoming features, and longer-term ideas:

- [View all open issues](https://github.com/wallyg/FlickrFetch/issues)
- [v2.0 milestone items](https://github.com/wallyg/FlickrFetch/issues?q=is%3Aopen+label%3Av2.0)
- [v3.0 deferred](https://github.com/wallyg/FlickrFetch/issues?q=is%3Aopen+label%3Av3.0)
- [v4.0 deferred](https://github.com/wallyg/FlickrFetch/issues?q=is%3Aopen+label%3Av4.0)

---

© 2026 Wally Gobetz
