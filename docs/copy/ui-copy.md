# UI copy review (3.13, #243)

Status (26 Nov 2026): **Decisions 1 and 2 are applied** (63 lines changed in the app, kept in line by `tests/buttonGuard.test.ts`). **Decision 3 is declined:** the owner prefers the Health Check wording as it is (snapshot, audits). Still to do: the Cancel, Close and Done audit and the empty lines (see the end of this section), then the line-by-line read of notes, Settings text, README and changelog.

Rules (from `assets/brand/brand-tokens.md`): Cancel abandons, Close dismisses, Done finishes; Try again after a failure; buttons name what happens; plain words, no apologies, no "please", sentence case.

## Already applied (rules you agreed earlier)
| Was | Now |
|---|---|
| Retry 3 failed (download bar, two places) | Try 3 failed again |
| Batch names "Retry: <album>" | "Try again: <album>" |
| Confirm (four steps in History > clear records) | Clear records (three), Clear all records (one) |

## Decision 1: loading lines (applied)
The brand rule says "Loading…" when nothing more specific helps, otherwise "Reading <thing>…". Applied literally, "Loading albums…" would become "Reading albums…", which sounds odd for things fetched from Flickr. **Proposed:** "Loading <thing>…" everywhere, and "Checking <thing>…" only where Health Check is working. Drop "Reading", "Getting" and "Looking through". (If you prefer the rule as written, say so and I will apply that instead.)

| Screen | Now | Proposed |
|---|---|---|
| Albums settings | Reading your albums… | Loading your albums… |
| Camera roll, On This Day, Timeline | Looking through your photos… | Loading your photos… |
| Duplicates | Looking for duplicates… | Checking for duplicates… |
| Album fit, Tags audit | Loading the photos… | Loading photos… |
| Discover groups | Loading group pool… | Loading the group's photos… |
| Albums, Backup, Photos, Tags checks | Checking your albums / library / photos / tags… | keep |
| Everything else | Loading photos… / albums… / collections… / contacts… / records… / Explore… / album photos… | keep |
| Albums | Counting… | Loading… |
| Several screens | Loading… | keep (nothing more specific helps) |

## Decision 2: errors say "Couldn't <do it>." and offer Try again (applied)
Today there are three patterns: "Failed to load X", "X could not be loaded" and "This could not be loaded." **Proposed:** "Couldn't load <the thing>." followed by a Try again button where one makes sense.

| Screen | Now | Proposed |
|---|---|---|
| Albums, Collections, Photos (3), Explore, Groups, Group pool, Albums/Collections/Album (Discover) | Failed to load albums (and the same for each) | Couldn't load albums. (and the same for each) |
| History, Backup, Health Check (several), Duplicates, Album Checks | This could not be loaded. | Couldn't load this. |
| Album fit, Audit | The photos could not be loaded | Couldn't load the photos. |
| Discover people | Your contacts could not be loaded. | Couldn't load your contacts. |
| Photo view | Could not load video / Video failed to play | Couldn't load the video. / Couldn't play the video. |
| Share | Could not copy the image. / Could not copy the links. | Couldn't copy the image. / Couldn't copy the links. |
| Share | Could not get these pictures from Flickr. Check your connection and try again. | Couldn't get these pictures from Flickr. Check your connection, then try again. |
| Map | The street map could not be loaded (are you online?). Showing the outline. | Couldn't load the street map. Check your connection. Showing the outline instead. |
| Map | The map could not be read. Try moving it again. | Couldn't read the map. Try moving it again. |
| Duplicates | Some photos in that group could not be updated. The list has been reloaded. | Couldn't update some photos in that group. The list is reloaded. |
| Sign-in | Failed to open Flickr. | Couldn't open Flickr. |
| Sign-in | Please enter the authorization code from Flickr. | Enter the code Flickr gave you. |
| Sign-in | Could not verify code. / Could not verify code. Please try connecting again. | Couldn't check that code. / Couldn't check the code. Connect again. |
| Sign-in | Invalid code — please check you entered it correctly and try again. | That code is not right. Check it and try again. |
| Sign-in | Could not connect to Flickr. Check your internet connection and try again. | Couldn't reach Flickr. Check your internet connection, then try again. |
| Sign-in | Flickr refused the sign-in request. Please try again in a little while. | Flickr turned down the sign-in. Try again in a little while. |
| Sign-in | Flickr is rate-limiting requests. Please wait 30 seconds and try again. | Flickr is asking us to slow down. Wait 30 seconds, then try again. |
| Sign-in | Incomplete response from Flickr — please try again | Flickr's answer was cut short. Try again. |
| Sign-in | No pending auth session — please click Connect to Flickr again | The sign-in timed out. Choose Connect to Flickr again. |
| Sign-in | Failed to get request token from Flickr | Couldn't start the sign-in with Flickr. |
| Any Flickr error | Flickr API error: <message> | Flickr returned an error: <message> |

## Decision 3: jargon in the Health Check "How it works" note (declined: keep snapshot and audits)
"Snapshot" and "audits" are our words, not yours; the app calls them the saved list and checks everywhere else.

| Now | Proposed |
|---|---|
| FlickrFetch keeps a snapshot of your photos, tags and albums on this computer. Health Check runs a set of audits against that snapshot, so results come quickly. | FlickrFetch keeps a saved list of your photos, tags and albums on this computer. Health Check runs its checks against that list, so results come quickly. |
| Each audit can be Off, a Warning or an Issue (change them in Tune checks). | Each check can be Off, a Warning or an Issue (change them in Tune checks). |
| Health Check never changes anything unless you choose to. For now you fix things on Flickr, then press Update to refresh the snapshot. | Health Check never changes anything unless you choose to. For now you fix things on Flickr, then press Update to refresh the list. |
| Albums: uses the album list the snapshot keeps. A Rebuild reads every album. | Albums: uses the album list FlickrFetch keeps. A Rebuild reads every album. |

## Still to look at (not changed)
- Cancel is used 21 times: check each is really "abandon" and not "dismiss" (then it should say Close).
- Empty lines (20 found, for example "No albums found for your Flickr account.", "Nothing here.", "Nothing to show."): same voice, plus say what to do next where there is something to do.
- Hover notes, Settings descriptions, the README and the changelog: not yet read line by line.

## Appendix: every distinct line of text in the app, by screen
Found automatically in `src/renderer` (text between tags: 428 distinct lines; hover text, placeholders and labels: 205 more). Lines that are built from variables or sit in the main process are not all here. Default for every line: keep.


### App.tsx

- Loading…

### components/AboutModal.tsx

- A local backup for your Flickr photos.
- Privacy
- Flickr Attribution
- Email
- Questions & Feedback
- My Flickr
- View My Photos
- GitHub Repo
- Source, Releases & Issues
- © 2026 Wally Gobetz. All rights reserved.

### components/AlbumBox.tsx

- [aria-label] Find an album
- [aria-label] Albums

### components/AlbumCheckSettings.tsx

- Health Check · Albums
- Health Check settings

### components/AlbumFitRows.tsx

- Date
- Place
- Subject (tag)
- Anything (leave alone)
- Reset to the app&apos;s pick
- Cancel
- Change
- Loading the photos…
- Open album
- Undo
- This one is fine
- [aria-label] Judge this album by

### components/AlbumFitSettings.tsx

- [k, String(v)])) as Record
- May not fit its album
- May be missing from an album
- Reset to the standard numbers

### components/AlbumKindList.tsx

- This could not be loaded.
- Try again
- Reading your albums…
- No albums yet. A Rebuild reads them.
- Only the ones I chose
- No album matches.
- Reset
- shown &&
- [placeholder] Find an album…
- [aria-label] Find an album

### components/AlbumList.tsx

- No albums found for your Flickr account.
- Name contains
- Starts with
- Ends with
- Exact match
- [placeholder] Search albums…
- [title] List view

### components/AlbumPhotoGrid.tsx

- 0 && pageInfo && pageInfo.page
- Loading photos…
- Title contains
- Starts with
- Ends with
- Exact match
- Default album order
- Newest posted
- Oldest posted
- Newest taken
- Oldest taken
- Downloaded
- License
- Privacy
- Tags
- Date
- All dates
- Last 7 days
- Last 30 days
- This year
- Last year
- Since a date…
- Between two dates…
- to
- Search whole photostream
- Clear all
- Clear filters
- [title] This album is empty
- [body] Photos added to it on Flickr will show up here.
- [placeholder] Search…
- [placeholder] paris, travel…
- [label] Quick ranges
- [label] Custom
- [title] No photos match these filters
- [body] Try removing a filter.

### components/AlbumsPanel.tsx

- Your albums have not been read yet
- A Rebuild reads every album once, along with your photos. It takes a few minutes.
- Rebuild
- Counting…
- Issue
- Warning
- Fine
- Every check in this group is switched off (Tune checks).
- (albums with the most photos flagged; click for the list)
- Show
- Filter
- This list
- Export this list
- Show in Finder
- Checking your albums…
- Open photo
- Open on Flickr
- Open album
- This one is fine
- Undo
- [title] Open this list
- [placeholder] Filter by title…
- [aria-label] Filter by title
- [title] Save every row of this list as a spreadsheet
- [aria-label] Show only one kind of reason
- [aria-label] Select this photo
- [label] Open in Flickr's organizer
- [title] Opens the album's page on Flickr. Click Edit there to change the album or take the photo out.

### components/AuditOverview.tsx

- This could not be loaded.
- Try again
- Build your library list first (Tags tab).
- How clean is your tag list?
- tags in your library
- Issues by type
- No check is set to Issue (see Tune checks).
- Photos that carry at least one tag with that problem. A photo can appear under more than one type.
- Biggest issues to address
- (by photos affected)
- Nothing flagged.
- Biggest warnings to heed
- Warnings by type
- (never lowers the score)

### components/AuditPanel.tsx

- Why these photos?
- Loading the photos…
- This one is fine
- Undo
- Open on Flickr
- Nothing added yet.
- View photos
- Copied
- Save as spreadsheet
- Show in Finder
- Build your library list first (Health Check tab, or Tags tab), then come back to check it.
- Show
- Filter
- This list
- Export this list
- Checking your tags…
- Fixed
- Add to plan
- [title] Open this tag's page on your Flickr account
- [aria-label] Your plan
- [title] The kind of problem this came from
- [title] Remove from plan
- [aria-label] Remove from plan
- [placeholder] Filter this list…
- [aria-label] Filter this list
- [title] Save every row of this list as a spreadsheet
- [aria-label] Show only one kind of problem
- [aria-label] Edit the replacement tags
- [title] Open this tag's page on your Flickr account, to fix it there

### components/BackupPanel.tsx

- How much of your library is downloaded?
- (from FlickrFetch’s own records)
- This could not be loaded.
- Try again
- Backup
- Filter
- This list
- Checking your library…
- Nothing here.
- Open on Flickr
- Download this one
- [title] Open this list
- [placeholder] Filter by title…
- [aria-label] Filter by title
- [title] Opens the usual download confirmation

### components/BatchEditButton.tsx

- Promise
- 0 && hint &&
- If it did not load, close the earlier editor tab, wait a few seconds and press again.
- 0 && part + 1

### components/CameraRoll.tsx

- See in On This Day
- Open in Photostream
- Download selected
- Clear
- Looking through your photos…
- Download this day
- d.photos.length &&
- [title] This date in every year

### components/ChangelogModal.tsx

- What's New
- Latest

### components/CleanupPanel.tsx

- setNarrow(el.clientWidth
- Loading…
- Scan my photos
- [title] Build your library list first
- [aria-label] Tune checks
- [title] Tune checks: choose which checks are an Issue, a Warning or Off (opens Settings)

### components/CollectionDetail.tsx

- This collection is empty.
- Sub-collections
- Albums
- [title] List view

### components/CollectionList.tsx

- Loading collections…
- No collections found for your Flickr account.
- Contains
- Starts with
- Ends with
- Exact
- [placeholder] Search collections…

### components/DateFilterBar.tsx

- 0 && !open &&
- Privacy
- Needs one Rebuild of your library list.
- Open Health Check
- Album
- Pick one or more; photos in any of them show.
- Clear all
- [aria-label] Photos or videos

### components/DateViewParts.tsx

- Video
- [title] Not public
- [title] Video

### components/DiscoverExplore.tsx

- Explore
- Today's most interesting photos on Flickr
- Select
- Loading Explore…
- Creator, License, Photo URL, and Photo ID
- Video
- Clear Selection
- Cancel
- [title] No photos found
- [body] Try again in a moment.

### components/DiscoverGroups.tsx

- My Groups
- Select
- Cancel
- Newest posted
- Oldest posted
- Date taken (newest)
- Date taken (oldest)
- Downloaded
- License
- Tags
- Date
- All time
- Last 7 days
- Last 30 days
- This year
- Last year
- Custom range
- Loading group pool…
- Browse photos from groups you belong to
- Loading groups…
- [label] Download Group
- [placeholder] Search titles…
- [placeholder] tag1 tag2…
- [title] This group pool is empty
- [body] No public photos have been added to it yet.
- [title] No photos match these filters
- [placeholder] Filter groups…
- [title] No groups yet
- [body] Join a group on Flickr and it will show up here.

### components/DiscoverPeople.tsx

- 0 ? currentPhotos.length - 1 : null); return
- Back
- Photos
- Albums
- Collections
- Cancel
- contains
- starts with
- ends with
- exact match
- Photo ID
- Album order
- Date taken (newest)
- Date taken (oldest)
- Downloaded
- License
- Date
- Clear
- Loading album…
- Newest posted
- Oldest posted
- Most interesting
- Tags
- All time
- Last 7 days
- Last 30 days
- This year
- Last year
- Custom range
- Clear filters
- Loading photos…
- Loading albums…
- Loading collections…
- Sub-collections
- People
- Browse photos from anyone on Flickr
- Loading contacts…
- Your contacts could not be loaded.
- Try again
- [label] Download Album
- [label] Download All
- [placeholder] tag1 tag2…
- [title] No public photos
- [body] This person hasn't shared any photos publicly.
- [title] No photos match these filters
- [body] Try removing a filter, or load more photos.
- [title] List view
- [title] No public albums
- [body] This person hasn't shared any albums publicly.
- [title] No public collections
- [body] This person hasn't shared any collections publicly.
- [title] This collection is empty
- [placeholder] Filter contacts or search Flickr by username…
- [title] You're not following anyone yet
- [body] People you follow on Flickr will show up here. You can also find someone by username above.

### components/DownloadConfirmModal.tsx

- Confirm Download
- Quality
- Save to
- Metadata embedding
- None
- Loading…
- Export as
- Change Settings
- Cancel

### components/DownloadQueueBar.tsx

- See the list
- 0 || progress !== null) &&
- : isDone ?
- : isCancelled ?
- Pause
- Resume
- Clear completed
- [title] Opens Health Check > Backup > Saved smaller than the original
- [title] Dismiss
- [title] Remove from queue

### components/DuplicateSettings.tsx

- Uploaded at least this many minutes apart
- Reset to the standard number
- [title] Two photos with the same date and time taken are possible duplicates only when they were uploaded at least this far apart. Longer finds fewer, surer groups; shorter lets in more bursts.

### components/DuplicatesList.tsx

- boolean): Promise
- Looking for duplicates…
- This could not be loaded.
- Try again
- Not duplicates
- Undo
- First upload
- 0 && !sameTitle(p.title, first.title) &&
- Different title
- Open on Flickr
- [aria-label] Select this photo

### components/FineReasonHost.tsx

- Noted. Thank you.
- Other…
- Skip
- Save
- Back
- [placeholder] In a few words
- [aria-label] Your reason

### components/HealthCheckSettings.tsx

- Keep the library list up to date
- Update automatically
- Tune checks
- Choose how each check is treated. Changes apply at once.
- [aria-label] Update automatically

### components/HealthOverview.tsx

- This could not be loaded.
- Try again
- Rebuild your library list first (the data button, top right).
- How complete is your library?
- photos in your library
- Issues by type
- No check is set to Issue (see Tune checks).
- Gaps by year taken
- (share of that year's photos; years under 100 photos left out)
- All gaps
- More checks…
- Biggest issues to address
- (years where one gap is unusually common)
- No year stands out.
- Biggest warnings to heed
- (by photos affected; never lowers the score)
- [aria-label] Another check
- [aria-label] Bars by year showing the share of photos with the chosen gap

### components/HealthPanel.tsx

- One more scan needed
- Rebuild
- Show
- Filter
- This list
- Export this list
- Show in Finder
- Checking your photos…
- Open on Flickr
- Show on the map
- Show on a map
- This one is fine
- Undo
- [placeholder] Filter by title…
- [aria-label] Filter by title
- [title] Save every photo in this list as a spreadsheet
- [title] Show every year again
- [aria-label] Show only one kind of title problem
- [aria-label] Select this photo
- [title] Opens the Map tab on this place, with a mark

### components/HealthScopeSettings.tsx

- ): Promise
- Include videos in the checks
- Videos
- Privacy
- [aria-label] No location: videos
- [aria-label] No location: privacy

### components/HistoryPanel.tsx

- This could not be loaded.
- Try again
- Loading…
- These files were not downloaded because they already exist in your download folder. Change conflict behavior in Settings to overwrite or rename instead.
- Cancel
- r.lastDownloadedAt
- By title
- By photo ID
- Downloaded
- All time
- Last 24 hours
- Last 7 days
- Last 30 days
- Last 60 days
- Custom range…
- Apply
- Album
- All
- Loading records…
- Loading album photos…
- Clear filters
- Untitled
- Remove download record?
- Clear photo download records
- From the last:
- 24 hours
- 7 days
- 30 days
- 60 days
- Before a date…
- After a date…
- Clear all
- Your files are not deleted. Smart Download will treat these photos as never downloaded.
- Confirm
- Clear download records before this date:
- Clear download records after this date:
- Clear all photo download records?
- Download History
- Batches
- Photos
- Discover
- [title] Your history starts here
- [body] Every batch you download shows up here, with what was saved and what was skipped. Batches are kept for 90 days.
- [title] Clear search
- [title] Clear date filter
- [title] Clear start date
- [title] Clear end date
- [title] Clear album filter
- [title] No downloads recorded yet
- [body] Photos are tracked here as you download them.
- [title] No records match these filters
- [body] Try removing a filter.
- [title] Updated on Flickr since last download
- [title] Confirm removal
- [title] Cancel
- [title] Remove this download record
- [title] No Discover downloads yet
- [body] Photos you download from People, Groups, and Explore will appear here.
- [aria-label] Close

### components/LibraryOverview.tsx

- This could not be loaded.
- Try again
- Tags
- No tag check is set to Issue.
- Photos
- Photo checks need one Rebuild of your library list.
- No photo check is set to Issue.
- Biggest Issues to address
- (by photos affected, across tags and photos; click for the list)
- No Issues right now.
- Warnings to review
- (could be better; these never lower the scores above)
- Nothing to show.
- photos
- tags
- Tune checks…

### components/LocationHintSettings.tsx

- The numbers behind the hints in the Photos checks (a suggested location, a suggested title start). Change one at a time and watch the counts.
- Reset to the standard numbers

### components/MapCacheControls.tsx

- Size limit
- MB
- In use
- Clear
- Cancel
- Deletes only the saved map images, not your photos. They download again as you browse.

### components/MapPanel.tsx

- (count
- No photo locations yet
- The map uses the library list FlickrFetch keeps on this computer. A Rebuild reads it, along with the place each photo was taken.
- Rebuild
- match ·
- in view
- 0 && !drawerOpen &&
- Show street map
- Privacy
- Tags
- Album
- Pick one or more; photos in any of them show.
- Date
- All dates
- Last 7 days
- Last 30 days
- This year
- Last year
- Since a date…
- Between two dates…
- to
- Located
- Clear all
- © OpenStreetMap contributors
- About the street map
- Draws streets under your photos, using OpenStreetMap, a free community map.
- To do that, FlickrFetch asks it for the map images of the area you are looking at, so it learns roughly where you look. Nothing else is sent: not your photos, account or name.
- The map images (not your photos) are saved on this computer, so places you have seen load fast and work offline. Turn it off any time, here or in Settings.
- Turn on street map
- Not now
- The place from Health Check is marked.
- Remove mark
- The street map could not be loaded (are you online?). Showing the outline.
- No photo with a location matches these filters.
- The map could not be read. Try moving it again.
- The country outline is not installed, so only your photos are shown.
- Zoom in here
- Loading…
- Click a photo to see it larger.
- [placeholder] paris, travel…
- [aria-label] Tags
- [aria-label] Clear tags
- [aria-label] Date range
- [label] Quick ranges
- [label] Custom
- [aria-label] From date
- [aria-label] To date
- [aria-label] Zoom in
- [aria-label] Zoom out
- [title] Street map data from OpenStreetMap
- [aria-label] About the street map
- [aria-label] Photos at this spot
- [aria-label] Close

### components/MissingTagSettings.tsx

- [k, String(v)])) as Record
- The numbers behind this check. Change one at a time and watch the counts.
- Reset to the standard numbers

### components/OnThisDayCard.tsx

- Daily notification on
- See them ›
- Hide for today
- [aria-label] Show the years, tags and photos for this day
- [title] One macOS notification a day while FlickrFetch is open. Turn it off any time in Settings.
- [title] Notify me daily: one macOS notification a day while FlickrFetch is open. You can turn it off in Settings.
- [aria-label] Notify me daily
- [title] Hide this notice until tomorrow

### components/OnThisDayPanel.tsx

- Looking through your photos…
- Build your tag list first (Tags tab). It also keeps the dates On This Day needs.
- On This Day
- Jump to date…
- Today
- marks photos that are not public. Arrow counts follow the switches.
- Photo size
- Counts, years and the boxes below follow this tag.
- Collage from selected
- Download selected
- Clear
- 12 am
- 6 am
- noon
- 6 pm
- have a map location.
- Photos by year
- Open in Photostream
- [title] Pick any date; only the month and day are used
- [aria-label] Pick a date
- [title] Uses the date each photo was taken
- [aria-label] Jump to date
- [aria-label] Photo size
- [aria-label] Show all photos again
- [title] Across the years
- [title] Most-used tags
- [title] Time of day
- [title] Places

### components/PhotoDetail.tsx

- Copied
- el.clientHeight + 4 && el.scrollTop + el.clientHeight
- Open on Flickr
- Photo Resolution
- Dates
- Taken
- Posted
- Updated
- Location
- No location data
- Description
- No description
- Tags
- No tags
- Camera
- Aperture
- Shutter
- ISO
- Focal length
- License
- Photo URL
- Photo ID
- Download
- Updated on Flickr since your last download
- Last Downloaded
- Cancel
- [title] Copy to clipboard
- [title] Previous (←)
- [title] Next (→)
- [title] Open this photo's page on Flickr
- [label] Copy attribution
- [title] Copy a credit line for this Creative Commons photo
- [label] Copy all metadata
- [title] Copy every field shown here as plain text
- [title] Clear download record for this photo

### components/PhotoGrid.tsx

- 0 && page
- Try again
- Title contains
- Starts with
- Ends with
- Exact match
- Photo ID…
- Not on Flickr
- Open
- Newest posted
- Oldest posted
- Newest taken
- Oldest taken
- Most interesting (Flickr’s ranking)
- Downloaded
- License
- Privacy
- Tags
- Date
- All dates
- Last 7 days
- Last 30 days
- This year
- Last year
- Since a date…
- Between two dates…
- to
- Clear all
- Clear filters
- Clear search
- [title] Your photostream is empty
- [body] Photos and videos you upload to Flickr will show up here.
- [placeholder] Search…
- [placeholder] Enter photo ID…
- [placeholder] paris, travel…
- [label] Quick ranges
- [label] Custom
- [title] No photos match these filters
- [title] No photos match your search
- [body] Try different words, or remove a filter.

### components/PhotoGridShared.tsx

- Video
- All photos
- Not downloaded
- Downloaded

### components/PhotoPeek.tsx

- Promise

### components/PhotoStrip.tsx

- SHOWN && !all &&

### components/ProblemModal.tsx

- The Problem FlickrFetch Solves
- [aria-label] Close

### components/RuleRail.tsx

- r.pending && stateOf(r.id) !== 'off') &&
- A dash means that check needs a Rebuild first.
- stateOf(r.id) === 'off') &&
- [title] How this list is ordered
- [aria-label] Sort this list
- [title] This check needs a Rebuild before it can count

### components/SelectBar.tsx

- Clear
- [label] Open selected in Flickr's organizer

### components/SettingsModal.tsx

- el.clientHeight + 4 && el.scrollTop + el.clientHeight
- Settings
- Notifications &amp; Dock
- On This Day
- Street map
- Try again
- Download Folder
- Change…
- Photo Resolution
- Development only
- Only in
- npm run dev
- . Your account is Pro; this does not change any download.
- If File Already Exists
- Core
- Part Separator
- Optional Parts
- Date stamp
- Auto-number
- Custom label
- Size indicator
- Title Transform
- Case
- Replace spaces
- Off
- On
- Character substitutions
- Core metadata
- Keep Flickr's HTML
- Location
- GPS coordinates
- Strip GPS from private
- Rights &amp; provenance
- Output files
- Sidecar JSON
- Preview
- Reset all settings to defaults?
- Cancel
- Reset
- Defaults restored
- Restore defaults
- Done
- [label] Show dock progress
- [label] Notify when complete
- [label] Show the On This Day card
- [label] Daily On This Day notification
- [label] Show street map
- [text] What to do when a downloaded file has the same name as one already in the folder.
- [label] Show in Finder when done
- [text] The main part of every filename. The other parts go before or after it.
- [text] A counter (001, 002, 003…) that resets at the start of each batch.
- [placeholder] e.g. Vacation, Japan 2024…
- [text] Adds the download size to the filename: orig, xl, lg, med, sm, sq. Useful when downloading different sizes of the same photo.
- [text] Changes the capital letters of the whole filename.
- [text] Brackets are kept in filenames by default. Turn these on to remove them.
- [text] Saves the photo's location in the file, when Flickr has one.
- [text] Saves a .json file next to each photo or video with its Flickr details (title, tags, date, GPS, license and more).

### components/ShareDialog.tsx

- t.length
- One photo from each year
- One photo from each year. (Tick photos on the page first to choose your own.)
- Arrangement
- Standard
- Large (2×)
- Short Flickr link under each photo
- A saved picture can't hold a clickable link, so it is printed. "Copy links" gives clickable ones to paste beside it. "Created with FlickrFetch" is always included.
- Save image…
- Copy image
- Copy links
- Could not get these pictures from Flickr. Check your connection and try again.
- Try again
- [aria-label] Close
- [label] Photos
- [title] Leaves out any photo that is private, friends only or family only
- [label] Look
- [label] Shape and size
- [label] Extras

### components/SmartDownloadButton.tsx

- Download All
- All photos in this source
- Download Updated
- Photos changed since last download
- Download Never Downloaded
- Only photos not yet downloaded
- [aria-label] More download options

### components/TagScanParts.tsx

- Cancel
- Your library list
- Update now
- Looks for new and edited photos, usually a few seconds. It does not notice deleted photos.
- Rebuild from scratch…
- Reads every photo again, three to five minutes. Use it after deleting photos, or if the counts look wrong.
- FlickrFetch has been updated since you last rebuilt your local library list. The new version checks a few more details about your photos and albums, so some checks stay empty until you rebuild. Press Rebuild once. It will take just a few minutes.
- Rebuild…
- Not now
- tags on
- [aria-label] Library data: update or rebuild
- [aria-label] Your library list
- [title] Hide this until you next open FlickrFetch

### components/TagsPanel.tsx

- Loading…
- Scan my photos
- Scan cancelled. Nothing was saved.
- Open Health Check ›
- setSort(e.target.value as NonNullable
- Most photos first
- All
- · pick the next letter above to narrow further
- No tags match.
- Clear
- View photos
- [title] Build your tag list
- [placeholder] Find tags… (matches “new york” and “newyork”)

### components/TimelineNav.tsx

- [title] Esc does the same

### components/TimelinePanel.tsx

- Looking through your photos…
- Build your tag list first (Tags tab). It also keeps the dates the Timeline needs.
- Fewer
- More
- Grey means none.
- Open in Photostream
- Camera roll
- Click a day to see its photos. Each day is shaded against this month's busiest day.
- [title] The month's photos in date order, grouped by day

### components/TuneChecks.tsx

- changed
- Reset to the standard list
- How each album is judged
- Open the Album Checks tab
- Save them as a spreadsheet
- [aria-label] Jump to a group of checks

### pages/LoginPage.tsx

- Your photos.
- All of them.
- Everything about them.
- Almost there
- 1. Authorize in your browser
- 2. Enter your authorization code
- [placeholder] Paste the code from Flickr
- [aria-label] Authorization code

### pages/MainPage.tsx

- Flickr
- Fetch
- My Flickr
- Discover
- PRO
- Sign out
- Select All
- Clear Selection
- Cancel
- Reset download records?
- Smart Download will then treat them as never downloaded.
- Reset records
- Sign out of Flickr?
- You&rsquo;ll need to reconnect your Flickr account to use FlickrFetch.
- Your downloaded photos and your download history stay on this computer.
- [label] History
- [label] Settings
- [title] Refresh photostream
- [label] Download All
- [label] Download Album
- [title] More actions

### ui/BackToTop.tsx

- [aria-label] Back to the top
- [title] Back to the top

### ui/HoverNote.tsx

- [aria-label] How this works
