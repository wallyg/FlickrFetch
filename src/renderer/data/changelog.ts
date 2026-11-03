export interface Release {
  version: string
  date: string
  highlights: string[]
  milestone?: string  // for X.0 releases: one-sentence headline shown instead of bullets
}

const changelog: Release[] = [
  {
    version: '1.8',
    date: 'November 2026',
    highlights: [
      'Login screen redesigned — cleaner two-column layout with both authorization steps visible upfront',
      'Photo counter in the detail viewer now reads "Photo 8 of 100" instead of "8 / 100+"',
      'Load count updated to "100 of 71,098 photos loaded · Scroll for more"',
      'Album download button now reads "Download Album" for clarity',
      '"Download Size" setting renamed to "Photo Resolution"; detail view label updated to match',
      '"Dimensions" label in photo detail renamed to "Photo Resolution"',
      'Selection toolbar: "Deselect All" renamed to "Clear Selection"; count reads "4 photos selected"',
      'Cancel button in selection toolbar is now gray, distinguishing it from navigation links',
      'About screen: What\'s New moved to the left column as a compact link below the version badge',
      'About screen: updated product description and Flickr attribution copy',
    ]
  },
  {
    version: '1.7',
    date: 'November 2026',
    highlights: [
      'ExifTool is now bundled — no Homebrew installation required for metadata embedding',
      'Search your photostream and albums by title — choose contains, starts with, ends with, or exact match',
      'Tag filter: search for photos by one or more tags, with any/all matching',
      'Date range filter: narrow by date taken or date posted, with one-click presets and custom date ranges',
      'Privacy filter now includes Friends & Family as a distinct option, matching Flickr\'s own privacy levels',
      'All search and filter controls available in both the photostream and album photo views',
      'Filter drawer keeps secondary filters (Tags, Date, Privacy, Camera placeholder) tucked away until needed',
      'Active filters show as dismissible chips below the toolbar; sort order aligned across all views',
      'Album list has its own name search with the same operator options',
    ]
  },
  {
    version: '1.6',
    date: 'November 2026',
    highlights: [
      'Videos now play in the photo detail view — click the play button to stream at the best available quality',
      'Back button moved to the top-left corner of the image panel for easier navigation',
      'Metadata panel reordered: Location now appears just after Dates, followed by Description, Tags, and Camera',
      'Dimensions label added to the pixel size display',
    ]
  },
  {
    version: '1.5',
    date: 'November 2026',
    highlights: [
      'Download All and Select All now respect the active Photos/Videos and Privacy filters',
      'Photo detail: video indicator, human-readable location, Date Posted, camera EXIF, and copy buttons on title and description',
      'Dates section in photo detail shows both Date Taken and Date Posted together',
      'Filter toolbar stays visible while scrolling; shows match count and a "Clear filters" link when a filter is active',
      'Auto-load searches multiple pages when a filter is active; "Keep searching" resumes after the 10-page cap',
      'Completed batch downloads stack in the queue bar — each stays with its own dismiss button',
      'Album list now has the S/M/L grid size toggle',
      'Settings: "Restore defaults" resets all preferences to factory values',
    ]
  },
  {
    version: '1.4',
    date: 'October–November 2026',
    highlights: [
      'New full-page photo detail view: large image panel alongside a metadata info panel',
      'Navigate photos with ← → keys or arrow buttons without leaving the view',
      'Size picker remembers your choice for the session',
      'Metadata panel with one-click copy buttons for GPS, URL, and photo ID',
      'Single-save dialog respects your naming settings and selected size',
    ]
  },
  {
    version: '1.2',
    date: 'October 2026',
    highlights: [
      'Metadata controls: toggle each field on/off individually (Title, Description, Tags, Date, Creator, GPS)',
      'Embed Creative Commons license, Flickr photo URL, and photo ID',
      'Option to strip GPS coordinates from private photos',
    ]
  },
  {
    version: '1.1',
    date: 'October 2026',
    highlights: [
      'Settings redesigned with three tabs: General, Downloads, and File Naming',
      'Profile banner shows your avatar and "Flickring since" year',
      'Choose download size: Original, X-Large, Large, Medium, Small, or Square',
      'Set what happens when a filename already exists: rename, skip, or overwrite',
      'Open Finder automatically when a batch completes',
      'Filename transforms: replace spaces with separator, force lowercase or UPPERCASE',
      'Add the download size as an optional filename part',
    ]
  },
  {
    version: '1.0',
    date: 'October 2026',
    milestone: 'FlickrFetch 1.0 — first complete release',
    highlights: []
  },
  {
    version: '0.17',
    date: 'October 2026',
    highlights: [
      'Rebuilt file naming settings: choose core format (title, ID, or combinations), separator, date prefix/suffix, sequence numbering, and custom text',
      'Live preview shows your exact filename format as you configure it',
    ]
  },
  {
    version: '0.16',
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
    version: '0.15',
    date: 'October 2026',
    highlights: [
      'Collection cards now show a stack icon instead of broken covers',
      'Settings and Sign Out buttons updated with clearer icons',
      'About FlickrFetch dialog with version history',
    ]
  },
  {
    version: '0.13',
    date: 'October 2026',
    highlights: [
      'Video thumbnails now show a play icon in all grids',
      'Filter photos/videos/all in photostream and album grids',
      'Sort photostream and album photos by date posted or date taken',
      'Grid size toggle (S/M/L) in all photo grids',
      'Downloading the same album twice now prompts for confirmation',
    ]
  },
  {
    version: '0.12',
    date: 'October 2026',
    highlights: [
      'Queue bar overhaul: live progress with filename ticker and a toast notification when batches are added',
      'Skip current batch, Cancel All, or remove individual albums from the queue with ✕',
      '"Open in Finder" button appears in the queue bar when a download finishes',
      'Fixed: downloads now time out after 30 seconds if Flickr API is slow, instead of hanging indefinitely',
    ]
  },
  {
    version: '0.11',
    date: 'October 2026',
    highlights: [
      'Multi-select in album grids and photostream',
      'Shift-click to select a range of photos',
      'Select All in album detail view',
      'Download selected photos as a batch',
    ]
  },
  {
    version: '0.10',
    date: 'September 2026',
    highlights: [
      'Batch download entire albums with one click',
      'Downloads queue automatically — start a second album while the first is running',
      'Progress bar and live count in the bottom queue bar',
      'Photos save to a subfolder named after each album',
      'Default download folder: ~/Pictures/FlickrFetch (configurable in Settings)',
    ]
  },
  {
    version: '0.9',
    date: 'September 2026',
    highlights: [
      'Browse Flickr Collections',
      'Navigate into sub-collections and their albums',
    ]
  },
  {
    version: '0.8',
    date: 'August 2026',
    highlights: [
      'Browse and download photos from your Albums',
      'Album covers and photo counts in the grid',
    ]
  },
  {
    version: '0.7',
    date: 'August 2026',
    highlights: [
      'App icon, splash screen, and wordmark',
      'Consistent FlickrFetch branding throughout',
    ]
  },
  {
    version: '0.6',
    date: 'July 2026',
    highlights: [
      'File naming options: by title, date + title, ID + title, or ID only',
      'Configurable in Settings',
    ]
  },
  {
    version: '0.5',
    date: 'July 2026',
    highlights: [
      'Metadata embedding via ExifTool',
      'Embeds title, description, tags, date taken, GPS coordinates, and owner name',
    ]
  },
  {
    version: '0.4',
    date: 'June 2026',
    highlights: [
      'Download photos to your Mac',
      'Choose download location with a folder picker',
      'Downloads the original full-resolution file',
    ]
  },
  {
    version: '0.3',
    date: 'June 2026',
    highlights: [
      'Browse your Flickr photostream',
      'Tap any photo to see full details and download',
    ]
  },
  {
    version: '0.2',
    date: 'May 2026',
    highlights: [
      'Sign in with your Flickr account via OAuth',
      'Credentials stored securely on your Mac — never shared',
    ]
  },
  {
    version: '0.1',
    date: 'May 2026',
    highlights: [
      'Initial release — FlickrFetch is born',
    ]
  }
]

export default changelog
