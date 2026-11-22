export interface Release {
  version: string
  date: string
  highlights: string[]
  milestone?: string  // for X.0 releases: one-sentence headline shown instead of bullets
}

const changelog: Release[] = [
  {
    version: '3.5',
    date: 'November 2026',
    highlights: [
      'On This Day — a new tab shows the photos you took on today\'s date in other years, grouped by year, with your busiest year, most-used tags, time of day and places at a glance. Filter by public or not public, jump to any date, and click a tag to narrow it down. A slim notice at the top of My Flickr tells you how many photos you have for today (hide it for the day, or turn it off in Settings), and you can switch on one macOS notification a day',
      'Timeline and camera roll — every month you took photos, shaded and counted. Click a month for a day-by-day calendar, then a day for its photos in date order, with arrows to the next or previous month or day. Open any month or day in the Photostream, or download it',
      'Collages and cards — turn a day\'s photos into a shareable picture: 1 to 6 photos, five layouts, five frames, and a shape to suit where it\'s going (square, portrait, story or wide), with short Flickr links. "Public photos only" keeps private ones out. Save or copy it at standard or large size',
      'Health Check — Tag audit and Photo health now have their own tab, opening on an Overview: a score for your tags and your photos, your biggest issues, charts by type and by year, and warnings worth a look. Every check is an Issue (counted in your score), a Warning (listed, never lowers it) or Off, and you choose in Settings → Health Check. The lists have a filter, sorting, a plan to work through on Flickr, and export to a spreadsheet',
      'Stays fresh by itself — FlickrFetch can quietly update your library list every time you open it, once a day (the default), or never. One data button on Health Check shows how fresh it is, with Update and Rebuild',
      'Smoother everywhere — a back-to-top button on long pages, Cmd+F in Albums jumps to the search box, a photo-size slider on On This Day, one pink main action per screen, and rows you can reach with the keyboard. In Tags, # opens the digits 0 to 9 and Other opens writing systems (Chinese & Japanese, Greek and more)',
      'One more scan — On This Day and the Timeline need your library list rebuilt once (Health Check, then the data button, then Rebuild; a few minutes) to learn which photos are public and where they were taken. Until then everything works except the public / not public switch. Nothing on Flickr is changed',
      'The About and Problem screens now describe the app accurately: it checks GitHub for new versions, and album names are not listed among the embedded fields'
    ]
  },
  {
    version: '3.4',
    date: 'November 2026',
    highlights: [
      'Tag audit — a new Audit switch in the Tags tab lists likely tag problems by type: names stuck together after a lost comma, possible typos, accented tags with no plain twin (Flickr search can\'t find accented tags), plain tags that may need accents, odd characters, run-ons, and tags typed more than one way. Each finding has an editable suggested fix',
      'Plan and "This one is fine" — add findings to a plan, a checklist to work through on Flickr (copy it or save it as a spreadsheet), or mark a finding fine to hide it for good. After a Refresh, items you\'ve fixed tick themselves off',
      'Export this list and Open on Flickr — save any list as a spreadsheet (it opens in your Downloads folder), and jump from any tag straight to its page on Flickr',
      'Metadata health — a new Health switch lists photos with no title or a camera-file title (IMG_1234), no description, no tags, or no location, with thumbnails, as a to-do list for Flickr',
      'Dashboards — both Audit and Health open on an Overview: number tiles, bars by type, how clean your library is, the biggest single issues, a by-year chart, and where the gaps cluster. Click anything to open its list',
      'One more scan — Health needs your tag list rebuilt once (Full rescan, a few minutes). It also keeps titles, descriptions, locations and thumbnails on your computer. Nothing on Flickr is changed',
      'The Full rescan confirmation now says "Rescan" instead of "Queue Again"'
    ]
  },
  {
    version: '3.3',
    date: 'November 2026',
    highlights: [
      'Tags tab — a new tab in My Flickr that lists every tag you\'ve used. Build the list once (a minute or two for a big library), then browse by letter, narrow with a second row of letters, or search by "contains", "starts with", "ends with", or exact match. Pick several tags and press View photos to see them in your photostream, ready to download',
      'Tags show as you typed them — "New York" instead of "newyork" — and tags you\'ve typed more than one way are flagged. Searching "new york" or "newyork" finds the same tag',
      'Refresh and Full rescan — Refresh only reads photos that changed since last time; Full rescan starts over. Press Cmd+F (Ctrl+F on Windows) to jump to the tag search',
      'Click a tag — in a photo\'s details, every tag is now a button. From your photostream it shows all your photos with that tag; from inside an album it filters that album, with a link to search your whole photostream instead',
      'Links in descriptions work — links, bold, italic, and lists in a photo\'s description now display properly instead of showing raw code',
      'Cleaner descriptions in your files — downloaded photos now get a plain-text description (links written as "text (address)"). A new "Keep Flickr\'s HTML" switch in Settings → Metadata keeps the original instead',
      'New buttons on every photo — Open on Flickr, Copy attribution (a ready-made credit line for Creative Commons photos), and Copy all metadata. Right-click a photo in the grid for Open on Flickr and Copy Flickr link',
      'Fixed tag searches that found nothing for tags with accented letters, such as Québec or Honshū',
      'Easier-to-read tooltips and confirmation messages — separate ideas now sit on their own lines',
    ]
  },
  {
    version: '3.2',
    date: 'November 2026',
    highlights: [
      'License filter — filter photos in your photostream and albums, Groups, and People by Creative Commons, Public Domain, US Government, or All Rights Reserved, so you can find photos you\'re free to reuse',
      'Filters respond as you go — the Apply buttons are gone; dropdowns and buttons take effect instantly, typed searches run when you pause, and your photos stay on screen (dimmed) while new results load instead of flashing blank',
      'Brand waves — the soft FlickrFetch wave pattern now appears in the About window and behind the People and My Groups headers',
      'Friendlier empty screens — "nothing here" messages now say what\'s going on and what to try next',
      'Sidecar JSON files — an opt-in setting (Settings → Metadata → Output files) that saves a companion .json file next to each downloaded photo with its title, tags, date, location, and license',
      'Clearer download history — each batch now shows a colored status dot and badges for downloaded, errors, and skipped, with expandable details; failed photos open by default when a batch partly succeeded',
      'Lato throughout — the brand typeface now appears across the whole app, not just the sign-in screen',
      'Brand color cleanup — buttons, badges, and status messages now use one consistent set of brand colors',
      'Branded installer — the Mac installer window now has the FlickrFetch look',
      'Smaller app — the logo image is a third of its previous size',
    ]
  },
  {
    version: '3.1',
    date: 'November 2026',
    highlights: [
      'Group photo date filter — narrow a group\'s photos by when they were taken or posted, using presets or a custom range',
      'Filters now apply when you say so — the Groups filter drawer has an Apply button, so changing several filters no longer reloads the grid after each one',
      'Large group warning — downloading all photos from a very large group now asks you to confirm first, since it can take a while to start',
      'Fixed the grid going blank when filters emptied the results and then cleared',
    ]
  },
  {
    version: '3.0',
    date: 'November 2026',
    milestone: 'FlickrFetch 3.0 — justified photo grid with real aspect ratios, plus polish throughout',
    highlights: [
      'Justified photo grid — photos now display at their true aspect ratios instead of uniform square crops; a row height slider (100–300px) lets you dial in how dense or spacious the grid feels',
      'Downloaded badge — a green checkmark badge appears in the top-right corner of tiles you\'ve already saved, so you can see at a glance what\'s in your library without opening every photo',
      'Queue bar redesigned — the status area is now two lines: count and status on top, album name below; long names truncate gracefully instead of crowding the important info',
      'Clearer queue controls — a "Clear completed" button appears whenever batches finish stacking, replacing the per-item dismiss buttons',
      '"Reset records" now confirms in-app — tapping the overflow menu (⋯) on an album brings up an in-app modal instead of a system dialog, consistent with how every other confirmation works',
      'Sign out now requires a confirmation step — a quick in-app check before disconnecting your Flickr account',
    ]
  },
  {
    version: '2.4',
    date: 'November 2026',
    highlights: [
      'Export any album, collection, or selection as a ZIP archive — choose "Individual files" or "ZIP archive" before starting a batch download; a manifest.json is included automatically',
      'Update notifications — FlickrFetch now checks for new releases at launch and shows a badge on the Settings icon plus a banner inside Settings when an update is available',
      'Filter any photo grid by download status — use the Downloaded dropdown in More Filters to show All, Not Downloaded, or Downloaded photos',
      'List view across every photo grid — switch between grid and list with the density toggle; list view shows a download arrow on photos you\'ve already saved',
      'Strip parentheses or square brackets from photo titles in File Naming — useful when titles like "NYC Highline (2024)" clutter filenames',
    ]
  },
  {
    version: '2.3',
    date: 'November 2026',
    highlights: [
      'Collections now show a 2×2 photo collage thumbnail on each card — at a glance you can see what\'s in each collection',
      'Search and filter your collections by name, just like Albums',
      'Download All Albums — queue every album in a collection with one tap; each album downloads into its own subfolder under the collection\'s folder',
      'Batch history now shows exactly which photos failed in past downloads — tap "failed" on any batch row to expand the list',
      'List view for albums and collections — switch between grid and list with the density toggle; your preference sticks across the app',
      'Discover People now has a Collections tab — browse any user\'s collection hierarchy, drill into sub-collections, and open albums, just like your own Collections tab',
      'Fixed: collection mosaics now show photos from each sub-collection instead of repeating the same one',
    ]
  },
  {
    version: '2.2',
    date: 'November 2026',
    highlights: [
      'Pause and resume downloads mid-queue — handy when you need your connection back; the queue holds its place and picks up where it left off',
      'Failed downloads are now listed by name after a batch completes — tap "Retry X failed" to re-queue just the ones that errored',
      'Fixed: grid density in Discover People no longer affects your main photostream grid size',
      'Fixed: History no longer mixes in Discover downloads with your own photostream and album batches',
      'Fixed: Discover load-more photo count now stays accurate when a title filter is active',
      'Fixed: Discover posted-date filter now uses your local midnight instead of UTC',
    ]
  },
  {
    version: '2.15',
    date: 'November 2026',
    highlights: [
      'Discover now remembers your place — switching to You and back keeps your scroll position and open album',
      'People tab: friends and family photos now appear alongside public contacts\' photostreams',
      'People tab: full search, media filter, sort, grid size, and date-range filter on both photostreams and album photo views',
      'Discover download history tracked separately — Discover downloads appear in their own section in History',
      'Lazy image loading across all photo grids — large libraries scroll and filter faster',
      'You and Discover pills now show tooltips on hover',
      '"The Problem FlickrFetch Solves" — new link on the sign-in screen and in About for the full backstory',
    ]
  },
  {
    version: '2.1',
    date: 'November 2026',
    highlights: [
      'New Discover mode — browse and download photos from your contacts, groups, and Flickr\'s Explore feed',
      'People tab: search your contacts, browse their photostream and albums, download individual photos or select multiple',
      'Groups tab: browse your group pools with a filter for quick lookup; download the full pool or select photos',
      'Explore tab: browse today\'s most interesting photos on Flickr; download individually or in bulk',
      'Creator, License, Photo URL, and Photo ID are always embedded when downloading Discover photos — required for proper attribution',
      'Downloads route to organized subfolders: Users/username/, Groups/groupname/, and Explore/',
    ]
  },
  {
    version: '2.0',
    date: 'November 2026',
    milestone: 'FlickrFetch 2.0 — a polished, cohesive app built on two years of features',
    highlights: [
      'Brand color system applied throughout — navy headers, consistent blue and pink accents, cream backgrounds',
      'Header redesigned: History and Settings are now icon buttons with tooltips; Sign out moved inline with the account handle',
      'Terminology standardized app-wide — "Show in Finder," "Clear Filters," "Download," and other labels are now consistent everywhere',
      'Dates in photo detail now include time — Taken, Posted, and Updated all show date and time, not just date',
      'Settings changes apply immediately — no Save button; every toggle and picker saves as you go',
      '"Last downloaded" date in photo detail is more prominent; "Updated on Flickr since your last download" warning stands out as an amber box',
      'Download confirm modal redesigned — Quality and Save to shown in a summary card; metadata fields split into what\'s embedding and what\'s not; Track checkbox reads as a clear decision',
      'Queue bar now distinguishes "skipped" (file already exists) from "size unavailable" (requested resolution not on Flickr)',
      'Empty states added throughout — albums, collections, and history filters all explain what\'s missing and offer a next action',
      'Since v1.0: batch downloads with queue, Smart Sync and download history, full-text and tag search, date and privacy filters, video playback, photo detail view, metadata embedding with per-field controls, Creative Commons badges, file naming with tokens, and 70+ quality-of-life improvements across two years of active development',
    ]
  },
  {
    version: '1.11',
    date: 'November 2026',
    highlights: [
      'History panel has a new Photos tab — browse every photo you\'ve downloaded with thumbnail, title, date, and photo ID',
      'Search photo download records by title or photo ID; filter by download date range (presets or custom) or by album',
      'Remove individual photo download records inline, or clear records in bulk by time range, before/after a date, or all at once',
      'Album "Reset records" button now resets all photos in the album — not just the ones currently loaded on screen',
      'Photo ID search in the photostream toolbar now filters the grid live; an "Open →" button appears when the photo isn\'t in the loaded set',
    ]
  },
  {
    version: '1.10',
    date: 'November 2026',
    highlights: [
      'Download History panel (clock icon in toolbar) shows every batch — source, date, and a breakdown of saved, skipped, and already-downloaded photos',
      'Smart Download on albums and photostream: "Download Never Downloaded" skips photos you already have; "Download Updated" fetches only photos changed on Flickr since your last download',
      'Photo detail shows when a photo was last downloaded, with a warning if it\'s been updated on Flickr since',
      'Dates section in photo detail now includes the Flickr "Updated" date alongside Taken and Posted',
      '"Track this download" checkbox on the confirm modal — uncheck to run a batch without recording it in history',
      'Queue bar done message now includes "already downloaded" count when smart filter excludes photos',
    ]
  },
  {
    version: '1.9',
    date: 'November 2026',
    highlights: [
      'CC license badges now appear inline in the metadata panel — Attribution, NonCommercial, NoDerivs, and ShareAlike icons next to the license name',
      'Metadata fields with no value now show a clear "No description" / "No tags" message instead of blank space',
      'Video loading shows a spinner overlay on the thumbnail while playback initializes — no more blank black area',
      'Photo and album grids show a shimmer skeleton while loading instead of an empty canvas with centered text',
      'Download confirmation modal summarizes photo/video count, quality setting, destination folder, and all active metadata fields before the queue starts',
      'Photostream scan progress bar appears while auto-loading pages with an active filter; "Scan next 1,000" and "Scan all remaining" buttons offered after the 10-page auto-load cap',
      'Album search covers all pages — when a search is active, remaining album pages are fetched automatically so no albums are missed',
      'Download done message now reads "24 original photos saved successfully" for clarity',
    ]
  },
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
