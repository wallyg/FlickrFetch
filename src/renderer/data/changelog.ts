export interface Release {
  version: string
  date: string
  highlights: string[]
}

const changelog: Release[] = [
  {
    version: '1.0.0',
    date: 'October 2026',
    highlights: [
      'FlickrFetch 1.0 — MVP complete',
      'Sign in with your Flickr account and browse your full photostream, albums, and collections',
      'Download individual photos and videos at original resolution with full metadata embedded',
      'Batch download entire albums with a live progress queue — queue multiple albums and they run in order',
      'Multi-select photos in any grid and download them together',
      'Flexible file naming: choose core format, separator, optional date, sequence number, and custom text',
      'Privacy badges and filters to see and sort by visibility level',
      'Configurable download folder, dock progress, and completion notifications in Settings',
    ]
  },
  {
    version: '0.17.4',
    date: 'October 2026',
    highlights: [
      'Fixed: cancelling a batch download then re-downloading the same album no longer shows "already queued"',
    ]
  },
  {
    version: '0.17.0',
    date: 'October 2026',
    highlights: [
      'Rebuilt file naming settings with full control: core format (title, ID, or combinations), separator choice, optional date prefix/suffix, sequence numbering, and custom text',
      'Live preview shows your exact filename format as you configure it',
    ]
  },
  {
    version: '0.16.0',
    date: 'October 2026',
    highlights: [
      'Privacy badges on non-public photos in all grids (friends-only, family, private)',
      'Privacy filter in album and photostream grids',
      'Dock icon shows download progress bar while a batch is running (toggle in Settings)',
      'Desktop notification when a batch download completes (toggle in Settings)',
      'Press Escape to close any modal',
    ]
  },
  {
    version: '0.15.0',
    date: 'October 2026',
    highlights: [
      'Collection cards now show a stack icon instead of broken covers',
      'Settings and Sign Out buttons updated with clearer icons',
      'About FlickrFetch dialog with version history',
    ]
  },
  {
    version: '0.13.0',
    date: 'October 2026',
    highlights: [
      'Video thumbnails now show a play icon in all grids',
      'Filter photos/videos/all in photostream and album grids',
      'Sort photostream by date posted or date taken',
      'Sort album photos by album order or date taken',
      'Grid size toggle (S/M/L) in all photo grids',
      'Select button moved to tab bar for cleaner layout',
      'Downloading the same album twice now prompts for confirmation',
    ]
  },
  {
    version: '0.12.4',
    date: 'October 2026',
    highlights: [
      'Fixed: downloads could hang indefinitely if Flickr API was slow to respond (now times out after 30 seconds and skips to the next photo)',
    ]
  },
  {
    version: '0.12.3',
    date: 'October 2026',
    highlights: [
      'Skip current batch while keeping the rest of the queue',
      'Cancel All stops everything at once',
      'Remove individual albums from the queue with ✕',
    ]
  },
  {
    version: '0.12.2',
    date: 'October 2026',
    highlights: [
      '"Open in Finder" button now appears directly in the queue bar when a download finishes or is cancelled',
      'Queue bar stays visible after completion so you can always open your folder',
      'Cancelled downloads with partial files no longer auto-dismiss',
    ]
  },
  {
    version: '0.12.0',
    date: 'October 2026',
    highlights: [
      'Queue bar overhaul: toast notification when a batch is added to queue',
      'Expanded panel shows batch-level progress with live filename ticker',
      'Collection cards now show a stack icon instead of broken photo covers',
      'Settings and Sign Out buttons updated with clearer icons',
    ]
  },
  {
    version: '0.11.0',
    date: 'October 2026',
    highlights: [
      'Multi-select in album grids and photostream',
      'Shift-click to select a range of photos',
      'Select All in album detail view',
      'Download selected photos as a batch',
    ]
  },
  {
    version: '0.10.0',
    date: 'September 2026',
    highlights: [
      'Batch download entire albums with one click',
      'Downloads queue automatically — start a second album while the first is running',
      'Progress bar and live count in the bottom queue bar',
      'Cancel a batch in progress',
      'Photos save to a subfolder named after each album',
      'Default download folder: ~/Pictures/FlickrFetch (configurable in Settings)',
    ]
  },
  {
    version: '0.9.0',
    date: 'September 2026',
    highlights: [
      'Browse Flickr Collections',
      'Navigate into sub-collections and their albums',
    ]
  },
  {
    version: '0.8.0',
    date: 'August 2026',
    highlights: [
      'Browse and download photos from your Albums',
      'Album covers and photo counts in the grid',
    ]
  },
  {
    version: '0.7.0',
    date: 'August 2026',
    highlights: [
      'App icon, splash screen, and wordmark',
      'Consistent FlickrFetch branding throughout',
    ]
  },
  {
    version: '0.6.0',
    date: 'July 2026',
    highlights: [
      'File naming options: by title, date + title, ID + title, or ID only',
      'Configurable in Settings',
    ]
  },
  {
    version: '0.5.0',
    date: 'July 2026',
    highlights: [
      'Metadata embedding via ExifTool',
      'Embeds title, description, tags, date taken, GPS coordinates, and owner name',
    ]
  },
  {
    version: '0.4.0',
    date: 'June 2026',
    highlights: [
      'Download photos to your Mac',
      'Choose download location with a folder picker',
      'Downloads the original full-resolution file',
    ]
  },
  {
    version: '0.3.0',
    date: 'June 2026',
    highlights: [
      'Browse your Flickr photostream',
      'Tap any photo to see full details and download',
    ]
  },
  {
    version: '0.2.0',
    date: 'May 2026',
    highlights: [
      'Sign in with your Flickr account via OAuth',
      'Credentials stored securely on your Mac — never shared',
    ]
  },
  {
    version: '0.1.0',
    date: 'May 2026',
    highlights: [
      'Initial release — FlickrFetch is born',
    ]
  }
]

export default changelog
