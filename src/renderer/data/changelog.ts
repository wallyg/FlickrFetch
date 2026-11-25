export interface Release {
  version: string
  date: string
  highlights: string[]
  milestone?: string  // for X.0 releases: one-sentence headline shown instead of bullets
}

const changelog: Release[] = [
  {
    version: '3.10',
    date: 'November 2026',
    highlights: [
      'Map — a new tab that shows your photos with a location as dots and numbered circles on a map of the world. Drag to move, scroll with two fingers to move, pinch or Cmd and scroll to zoom. The circles split as you zoom in. Click one to see its photos (newest first), open one on Flickr, or download them all. The map repeats sideways so you can cross the date line, stops at the poles, and keeps its place when the photo panel opens and closes',
      'Map filters — show only photos or only videos, one privacy level, photos with certain tags (any or all of them), photos in an album, a date range (taken or posted), or only photos whose location is precise or only vague. The counts, the circles and the downloads all follow the filters',
      'Street map — a switch on the Map (off until you turn it on) draws streets and place names under your photos, using OpenStreetMap. Turning it on asks OpenStreetMap for the squares of map you are looking at, and nothing else is sent. The pictures are saved on this computer, and Settings shows how much room they take, lets you set a limit and clear them',
      'Vague location — a new Warning in Photos for photos whose location is only a country or region, so they sit in the middle of it on the map. It can be an Issue or Off in Tune checks like any other check',
      'Narrower windows — the window can now be made as narrow as about 560 points (there was no limit before). The tabs wrap onto a second line instead of being cut off, and History and Settings show only their icons when there is no room for their names',
      'The tab order is now Photostream, Albums, Collections, Tags, Timeline, On This Day, Map, then Health Check'
    ]
  },
  {
    version: '3.8',
    date: 'November 2026',
    highlights: [
      'Cmd+F (Ctrl+F on Windows) now jumps to the search box on Photostream, Collections, History, and the Discover People and Groups tabs, and only the tab you are looking at answers it.',
      'Health Check is easier to read — every check now has a one-line description and short rules you can open (ⓘ), Issues are red and Warnings amber, the tabs run Overview, Photos, Albums, Tags, Backup, and the Albums summary splits into your albums and the photos in them. May not fit can be shown by reason, and each May be missing suggestion can be opened to see the photos, untick the ones that do not belong, and open the rest in Flickr\'s organizer.',
      'Tune checks is shorter to move around — jump chips for Photos, Albums and Tags, and every check folds to one line (switch coloured by what it means, a mark on the ones you changed).',
      'Clearer wording in the sign-out, reset-records and History clear boxes: what happens on one line, what is not affected on the next. The Problem screen is split into shorter paragraphs.',
      'Album fit — two new lists in the Albums tab. "May not fit its album" shows photos taken long before or after the rest of their album, or far from where the rest were taken; a photo is left alone when the photos taken right beside it are in the same album. "May be missing from an album" suggests photos whose title starts with a place most of whose photos are in the album, or that were taken right beside photos already in it, with a button to open them in Flickr\'s batch editor. Each suggestion says why, and nothing is added or removed for you',
      'What an album is about — FlickrFetch guesses whether each album is organised by date, place or subject (or by nothing in particular) from its own photos and lets you change it album by album in Tune checks (How each album is judged), or from a suggestion. Both lists are Warnings and can be Off in Tune checks. No new scan is needed',
      'Wrong place — "May not fit its album" now also flags a photo filed in another place\'s album (its title, or the photos taken right beside it, point to a neighbouring district\'s album) and a photo that sits in two albums for different places. Both can be switched off in Tune checks',
      'Location hints — in Photos, a photo with no location now suggests where it was taken, from photos taken within a few minutes of it that agree with each other (with a map link), and a photo with no title or a camera-file title suggests how its title could start. A new Warning, "Far from the place its title names", lists geotags far from the city their title says. Nothing is changed for you: add the location or title in Flickr',
      'Reasons for "This one is fine" — after you mark something fine, a small bar at the bottom offers a few quick reasons for that check (or your own words), and you can skip it. The reasons stay on this computer, show under each check in Tune checks, and can be saved as a spreadsheet, so the checks can be tuned from what you actually dismiss. Undo removes the reason too',
      'Singular and plural — a new Warning in the Tags tab for the rare form of a tag you mostly use the other way (alleys beside alley). It is flagged only when the two are never on the same photo and the photos keep similar company, so tags you use both ways on purpose, possessives and different words are left alone. Fix it by replacing the rare tag on Flickr',
      'Possessive on its own — a new Warning in the Tags tab for a one-word possessive tag such as Cliff\'s, which is usually either the plain name (Cliff) or missing its second word (Cliff\'s Amusement Park). Names of restaurants, bars and shops, and longer names, are left alone',
      'Download updated photos no longer fetches again photos you saved through a selection, and a failed sign-in request gives a plain message instead of telling you to check a file',
      'Possible duplicates — a new Warning in the Photos tab that groups photos with the same date and time taken, to the second, that were uploaded at different times (a re-upload matches; a burst does not). Each group shows its photos side by side with upload time, tags, albums and privacy, marks the first upload, and lets you open them on Flickr, send them to the batch editor, or mark the group Not duplicates. Nothing is deleted. The minimum gap between uploads is a number in Tune checks',
      'A safer Rebuild — if Flickr\'s list changes while FlickrFetch is reading it (a photo uploaded mid-scan, say), your list is now left as it was and you are asked to run Rebuild again, instead of photos being dropped from it. Discover now lists everyone you follow (not just the first 200), and title searches there look through up to 1,000 results',
      'Fewer lost changes and dead ends — a setting changed just before you close Settings is now saved, and History and Discover show a Try again instead of waiting forever when something fails to load; pressing Next twice at the end of a Discover page no longer skips a photo',
      'Safer downloads and sign-in — a download that fails or is cancelled no longer damages a copy already on your disk, a stalled connection now times out instead of hanging, folder names from Flickr can no longer step outside your download folder, and the sign-in no longer writes your token to the log',
      'Photos missing a tag on the Tags overview, and a fifth clue: a title that names the tag (such as "Eiffel Tower at night" and the tag Eiffel Tower)',
      'Fewer false alarms in Tags — "Names stuck together" now flags a tag only when every piece is also a tag you use on its own, and "Run-ons" skips real words such as cheesecake',
      'Photos missing a tag — a new Warning in the Tags tab. It suggests a tag for photos that most similar photos carry: a tag that nearly always comes with another (brooklyn and nyc), the same album, the same title place, or photos taken right beside it. A tag is suggested only when at least two of these agree. Each row is one tag with a button that opens the photos in Flickr\'s batch editor so you can add it there',
      'How each check decides — hover the name of any check in Tune checks (ⓘ) or in the lists to see exactly how it works, in plain words',
      'Tune checks shows the numbers behind the Album fit lists and the new missing-tag check, with live counts, so you can calibrate them. Titles that start with a place are optional: an automatic setting switches those rules off when too few of your titles have one'
    ]
  },
  {
    version: '3.7',
    date: 'November 2026',
    highlights: [
      'Album checks — a new Albums tab in Health Check lists photos that are in no album, empty albums, albums in no collection, albums with a single photo, albums with no description and albums that share a title. Photos in no album and empty albums are Issues, the rest are Warnings, and each can be Off in Tune checks. Photos in no album can be sent to Flickr\'s batch editor to be put in an album',
      'Fewer false "No tags" — Flickr\'s photo list sometimes leaves out the tags of a photo that has them, so FlickrFetch now double-checks every photo that looks untagged before listing it. Your next Update does this once for the photos already listed',
      'One more scan — FlickrFetch now reads which photo is in which album, so your library list needs a Rebuild once more (Health Check, then the data button, then Rebuild; a few minutes). After that, Update keeps the albums current'
    ]
  },
  {
    version: '3.6',
    date: 'November 2026',
    highlights: [
      'More photo checks — Health Check now finds photos taken in the future or after they were uploaded, placeholder dates (such as 1 January 1970), descriptions that are only a link, only code, a list of tags or a copy of the title, photos with only one tag, photos with too many tags (the limit is yours to set), photos located at 0, 0, and photos far from the others taken around the same time. Each one is an Issue, a Warning or Off, like the rest',
      'More tag checks — Health Check also lists generic tags (photo, camera, iphone and so on; the word list is yours to edit), tags that are only numbers (years are left alone), tags that are really file names (IMG_1234), and, if you switch it on, tags used on a single photo',
      'Videos counted as videos — On This Day, the Timeline and the camera roll now say "50 photos and 2 videos", videos show a small play badge, and collages leave them out',
      'Backup report — a new Backup tab in Health Check shows how much of your library you have downloaded and the date of your last download, with lists of what is not downloaded, what is new since your last download, and what changed on Flickr after you downloaded it. Each list has a Download button. From now on FlickrFetch also remembers which size each photo came down at, so a fourth list shows photos saved smaller than the original (free Flickr accounts only get sizes up to 1024 px)',
      'Fix in Flickr\'s batch editor — one click opens Flickr\'s own editor with the photos from a Health Check list, a tag, a day, a month or your selection already loaded (500 at a time). Right-click a photo for the same',
      'Easier to read and use — Health Check list sidebars have clear section titles and scroll when long, every Health Check list has a Sort box above it (including Title Z to A), checks that cannot count until you rebuild show a dash, the Tags tab can sort Z to A, the Photostream can sort by Flickr\'s "most interesting" (Flickr ranks about 4,000 photos that way), Cmd+F jumps to the Filter box in Health Check lists, and Open on Flickr is now a blue button on photo cards',
      'First launch — the app is now signed as a whole, so a downloaded copy should say it cannot verify the developer (with Open Anyway) instead of calling itself damaged',
      'One more scan — the new checks need your library list rebuilt once more (Health Check, then the data button, then Rebuild; a few minutes). Until then they show zero'
    ]
  },
  {
    version: '3.5',
    date: 'November 2026',
    highlights: [
      'On This Day — a new tab shows photos taken on today\'s date in other years, grouped by year. A big calendar page anchors the top, with Yesterday and Tomorrow beside it and a Jump to date button; boxes below show the years as bars (busiest highlighted), the most-used tags with counts, the time of day as a small chart, and how many photos have a location. A public / not public switch filters the view',
      'On This Day card and notification — a one-line notice at the top of My Flickr tells you how many photos you took on this date; point at it to see the years, the busiest year, the most common tags and a few of the photos (hide it for the day, or turn it off in Settings). Optionally get one macOS notification a day while FlickrFetch is open',
      'Timeline — a new tab shades every month you took photos. Click a month to see it day by day as a calendar, then click a day to see its photos. A key above the grid explains the shading, a back button says where it goes, and arrows step to the previous or next month or day. Each month square also shows its photo count. Open any month or day in the Photostream, or download it',
      'Camera roll — click a day on the Timeline to see its photos, or press Camera roll on a month to see the whole month in calendar order, grouped by day with a heading for each, oldest or newest first. See in On This Day shows that date across the years',
      'Easier long pages — a round up-arrow button appears at the bottom right of the Photostream, Albums, Collections, the Tags list, On This Day, the Timeline, the camera roll and the Health Check lists once you scroll down, and takes you back to the top. On This Day has a Photo size slider, and Cmd+F on Albums jumps to the search box. On This Day also puts a line between years, shows each year\'s Open in Photostream and Download as small buttons with icons, and shows tag counts in brackets so they do not read as part of the tag',
      'Collages and cards — turn a day\'s photos into a shareable picture: choose 1 to 6 photos, a layout (Grid, Feature, Banner, Row, Column) and a frame (Polaroid, Matched, Paper, Gallery, Film) whose colors come from your photos. Tick "Use public photos only" to leave out private ones. Add short Flickr links, then save or copy the image at standard or large size and in a shape that suits where it is going: auto, square, portrait, story or wide, with the photos resizing to fill the shape. Each collage opens with a calendar page, "On This Day", how many photos that day holds, and its most common tags on one row, with a small "Created with FlickrFetch" mark in the corner, and every year sits on its own photo. If you ticked photos first you can use those or one from each year',
      'Tags browsing — clicking # now opens a row of digits 0 to 9, and Other opens a row of writing systems (Chinese & Japanese, Accented Latin, Greek, Cyrillic and more), with accented Latin split by plain letter when the group is large',
      'New Health Check tab and tab bar — Tag audit and Photo health moved out of the Tags tab into their own Health Check tab (switch between the two at the top). The Tags tab is back to browsing tags, with a pointer to Health Check. The controls on Health Check now share one compact row (the On This Day card steps aside on Health Check, Tags and Timeline), so more of the report fits on screen. In the lists, the Open / Marked fine choice, sort and export now sit in the left column under the problem types, and a Filter box sits under them. One thin divider separates the views from the checkup: Photostream, Albums, Collections, On This Day, Timeline, Tags | Health Check. Each line in the audit Plan box now shows its problem type and has a ✕ to remove it, and the audit lists can be sorted by most photos, fewest photos or A to Z',
      'Health Check front page and Tune checks — Health Check now opens on an Overview with a scorecard for Tags and for Photos, the Biggest Issues to address across both, and the Warnings to review. Every check is an Issue (a problem that needs attention, counted in your score), a Warning (listed, never lowers the score) or Off, and Tune checks (a tab in Settings, also reached from the Health Check tab) lets you set each one, and FlickrFetch can quietly Update your library list for you: every time you open it, once a day (the default), or never. Update replaces Refresh and Rebuild replaces Full rescan, both behind one data button that shows how fresh your library list is. Plan opens as a panel from its button instead of pushing the page down, and both dashboards are redesigned around one headline, one chart by type and a Biggest Issues to address list',
      'One look for buttons — the main action on each screen is now pink everywhere, chosen switches and list rows share one soft pink highlight, and other buttons share one quiet style',
      'One more scan — On This Day and the Timeline need your library list rebuilt once more (Rebuild on the Health Check tab, a few minutes) to learn which photos are public and where they were taken. Until then everything works except the public / not public switch. Nothing on Flickr is changed',
      'The About screen now says FlickrFetch checks GitHub for new versions (there are still no FlickrFetch servers, analytics or tracking), and the Problem screen no longer lists album names among the embedded fields'
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
