# Copy edit review (#268), first pass

Written 26 Nov 2026. How to use it: each line below has a number. Reply with the numbers you want changed ("A1 to A4, C1, C3, F all") and I apply only those, keep everything else as written, and add a test where a rule can be checked. Anything you do not mention stays as it is.

**What I read:** every Settings description, every hover note and (i) text, the dialogs (Confirm download, About, The problem FlickrFetch solves, collage, sign-in, download bar, "Marked fine, why?"), the empty and "nothing here" lines (about 35), the README, and the 3.13 changelog. About 180 lines of Settings text and 60 notes, plus the rest.

**What I left alone:** the Health Check front pages, filter rows and anything else 3.14 will reword (#220, #257); and the lines that already follow the rules (most of what I read: they say what happens, in short plain sentences).

**Voice used for the rewrites** (from `assets/brand/brand-tokens.md`): simple, clear, not too wordy; plain words; no jargon, no "please"; one idea per line; sentence case; "Couldn't …" for problems; Health Check keeps its own words (snapshot, audits).

## Already corrected (two statements that were wrong, not a matter of taste)

- **Settings > File naming > Size indicator** said the codes were "orig, xl, lg, med, sm, sq". The file names actually use **o, xl, l, m, s, sq**. Now reads: "Adds a short size code to the file name: o (original), xl, l, m, s or sq (square). Useful when downloading different sizes of the same photo." A test now checks it against the real codes.
- **Settings > Album Checks** said "the On, Warning and Off choices". The choices are called **Issue, Warning and Off** everywhere else. Fixed, and tested.

## A. One spelling: American

The app already writes "license", "organizer", "color". A few places use British spellings. One rule: American.

| # | Where | Current | Proposed |
|---|---|---|---|
| A1 | Tune checks, Album fit (3 notes) | "neighbours", "nearby neighbours" | "neighbors" |
| A2 | Tune checks, Album fit | "City - Neighbourhood: Subject" | "City - Neighborhood: Subject" |
| A3 | Tune checks (Album fit, Location hints) | "metres", "...and this many metres" | "meters", "...and this many meters" |
| A4 | Timeline key | "Grey means none." | "Gray means none." |

## B. Headings: "and" instead of "&", and one name written one way

"Friends & Family" stays (it is Flickr's own name).

| # | Where | Current | Proposed |
|---|---|---|---|
| B1 | Settings > General | "Notifications & Dock" | "Notifications and Dock" |
| B2 | Settings > Metadata | "Rights & provenance" | "Rights and provenance" |
| B3 | About | "Questions & Feedback", "Source, Releases & Issues" | "Questions and feedback", "Source code, releases and issues" |
| B4 | About link, sign-in link | "The Problem FlickrFetch Solves ›" (capitals) | "The problem FlickrFetch solves ›" (the heading it opens already reads this way) |

## C. Settings descriptions

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| C1 | Dock progress | "Animate the dock icon during downloads" | "Show download progress on the Dock icon" | Says what you see |
| C2 | Notify when complete | "macOS notification when a batch finishes" | "A macOS notification when a download finishes" | "batch" is our word, not yours |
| C3 | On This Day card | "A small card at the top of My Flickr when photos were taken on today's date" | "A small card at the top of My Flickr when you have photos from today's date in earlier years" | It never counts this year |
| C4 | Download folder | "Where batch downloads are saved. Single-photo downloads use your Mac's Save dialog instead." | "Where albums, collections and chosen photos are saved. A single photo downloaded from its detail view asks where to save it." | Names what is covered |
| C5 | Photo resolution | "Which image size to download. Original is recommended for archiving. Videos always download at the highest quality, whatever you choose here." | "Which size to download. Original is best for archiving. Videos always download at their highest quality." | Shorter, same meaning |
| C6 | If file already exists | "What to do when a downloaded file has the same name as one already in the folder." | "What to do when a file with the same name is already in the folder." | Shorter |
| C7 | Show in Finder when done | "Reveal the downloaded files in Finder after a batch completes" | "Show the downloaded files in Finder when a download finishes" | "Reveal", "batch" |
| C8 | Part separator | "Joins all parts together. Example: 2024-03-15·NYC - Highline.jpg (where · is your chosen separator)." | "Goes between the parts of a file name. With a dot: 2024-03-15.NYC - Highline.jpg." | The example uses a real separator |
| C9 | Optional parts | "Each part wraps around the core using the separator. Prefix goes before it, suffix after." | "Each part goes before (prefix) or after (suffix) the main part, joined by the separator." | "wraps around the core" is hard to picture |
| C10 | Sequence number | "A counter (001, 002, 003…) that resets at the start of each batch." | "A counter (001, 002, 003…) that starts again at 001 for each download." | "batch", "resets" |
| C11 | Title transform | "Changes the capital letters of the whole filename." | "Makes the whole file name lowercase or uppercase." | Says the two choices |
| C12 | Strip GPS from private | Label "Strip GPS from private"; "When a photo is private, skip GPS even if GPS embedding is on. Useful for location privacy." | Label "Leave GPS out of private photos"; "Private photos are saved without a location, even when GPS is on. A file that already has a location keeps it." | "Strip" promises to remove one that is there (decided earlier: reword, do not change behavior) |
| C13 | Album fit: cluster | "Share of an album in its cluster (%)": "Outliers are called out only when at least this much of the album sits in its dates or tags. Higher is stricter: fewer albums are judged." | "How much of an album must follow a pattern (%)": "A photo is called out only when at least this much of its album shares the same dates or tags. Higher judges fewer albums." | "cluster" and "outliers" |
| C14 | Album fit: out of place | "Out of place: times the album's own spread": "A photo further from the middle of its album than this many times the album's own spread is flagged. Lower flags more." | "Out of place: how many times the album's usual spread": "A photo is flagged when it is farther from the middle of its album than this many times the album's usual spread. Lower flags more." | "spread" explained |
| C15 | Album fit: nearby | "Nearby means within this many minutes": "Shared with May not fit. Longer finds more neighbours." | "Nearby means within this many minutes": "Used by May not fit too. A longer time finds more nearby photos." | One idea per line |

## D. Dialogs and the sign-in screen

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| D1 | Collage dialog, two loading lines | "Getting sharper pictures from Flickr…" / "Getting bigger pictures from Flickr…" | "Loading sharper pictures…" / "Loading bigger pictures…" | Brand wording rule: "Loading", not "Getting" |
| D2 | Collage dialog, error | "Couldn't get these pictures from Flickr. Check your connection, then try again." | "Couldn't load these pictures. Check your connection and try again." | Same rule |
| D3 | About | "Download and preserve your Flickr photos and videos in their original quality, with metadata intact and control over your local archive." | "Download your Flickr photos and videos with their titles, tags, dates and locations saved inside the files." | "Original quality" is not true for free accounts; says the real benefit |
| D4 | "Marked fine, why?" bar | "Noted. Thank you." | "Saved." | Short, no thanks needed |
| D5 | Sign-in screen | Three different words for the same step: "Connect Flickr account", "authorization code", "Authorize in your browser" | Keep "Connect Flickr account" for the button; call the code "the code from Flickr" everywhere ("Paste the code from Flickr", "Enter the code from Flickr") | Fewer words to learn |

## E. The empty lines: say what to do next

| # | Where | Current | Proposed |
|---|---|---|---|
| E1 | Audit, Albums, Health (Open list) | "Nothing left to review here." / "Nothing left to fix here." | "Nothing left to review." / "Nothing left to fix." |
| E2 | Audit, Albums, Health, Duplicates (Marked fine list) | "Nothing here." | "Nothing marked fine yet." |
| E3 | Backup list | "Nothing here." | "Nothing in this list." |
| E4 | Audit plan | "Nothing added yet." | "Your plan is empty. Press Add to plan on a row to start it." |
| E5 | Albums, Collections lists | "No albums found for your Flickr account." / "No collections found for your Flickr account." | "You have no albums on Flickr yet." / "You have no collections on Flickr yet." ("found" reads like a failed search) |
| E6 | Settings > Album Checks | "No albums yet. A Rebuild reads them." | "No albums yet. Rebuild your library list to read them." |
| E7 | Album Checks search | "No album matches." | "No album matches your search." |
| E8 | Tags | "No tags match." | "No tags match. Try fewer letters, or clear the search." |
| E9 | Organizer button | "Nothing to open here." | "There are no photos to open." |
| E10 | Discover, an empty collection | "This collection is empty" (no second line) | "This collection is empty" / "Albums added to it on Flickr will show up here." |

The others (for example "Your photostream is empty", "No public albums", "No groups yet", "You're not following anyone yet") already say what is wrong and what happens next, so I left them.

## F. README

| # | Where | Current | Proposed | Why |
|---|---|---|---|---|
| F1 | "What you get" and "Honest limits" | "Smart Sync" (twice) | "Smart Download" | The app calls it Smart Download |
| F2 | Honest limits, free accounts | "...so on a free account you may get smaller sizes than you asked for, without a warning." | "...so on a free account you may get smaller sizes than you asked for. FlickrFetch tells you when that happens: a note in the download box, a count after each download, and a list under Health Check > Backup." | It no longer comes "without a warning" (3.11 and 3.13) |

The README also does not mention On This Day, the Timeline, the collage maker or accounts. That belongs with the README refresh (#131), after 3.14, so I have not written it here.

## G. The 3.13 changelog

| # | Where | Current | Proposed |
|---|---|---|---|
| G1 | 3.13, last bullet "Fixes from a full review" | One bullet of about 2,700 characters, 40 fixes joined by semicolons, some with a second "and" in the middle (a result of adding to it pass by pass) | Split into six short bullets that match the release notes: your files and downloads; accounts and Flickr; On This Day; steadier everywhere; and so on. Same facts, readable. The release notes draft already has the wording. |

## H. Headings with jargon (for your review)

Settings headings and labels that use our words or technical words. Reply with the numbers you want.

| # | Where | Now | Proposed |
|---|---|---|---|
| H1 | File naming | "Core" | "Main part of the name" |
| H2 | File naming | "Optional parts" | "Extra parts" |
| H3 | File naming | "Part separator" | "Separator" |
| H4 | File naming | Two headings for one thing: "Title transform" and "Case" | One: "Letter case" |
| H5 | File naming | "Size indicator" | "Size code" |
| H6 | File naming | "Character substitutions" (it only removes brackets) | "Remove brackets from titles" |
| H7 | Metadata | "Core metadata" | "Details saved in the file" |
| H8 | Metadata | "Keep Flickr's HTML" | "Keep description formatting" |
| H9 | Metadata | "GPS coordinates" | "Location (GPS)" |
| H10 | Metadata | "Rights and provenance" | "Rights and source" |
| H11 | Metadata | "Output files" / "Sidecar JSON" | "Extra files" / "Details file (.json)" |
| H12 | Confirm download box | "Metadata embedding" / "Individual files" | "Details saved in the file" / "Separate files" |
| H13 | Smart Download menu | "Download updated" / "Download never downloaded" | "Download changed photos" / "Download new photos only" |
| H14 | Tune checks, album fit | "cluster", "outliers", "spread" (C13 and C14 above) | the plain versions in C13 and C14 |
| H15 | Tune checks | "Tune checks" | keep? (it is the name you chose; say if you want "Adjust checks") |

## Not proposed

Settings and hover texts that are already short, plain and accurate (most of them), the "The problem FlickrFetch solves" essay (it is yours and reads well), and everything in Health Check's own voice.

## Applied on 26 Nov (evening): the owner's choices on C and H

- **H:** H3 (Separator), H5 (Size code), H9 (Location (GPS)) changed. H4: the section is now "Clean-up", hover text "Changes how the file name is written." (owner's choice; it holds Case, Replace spaces and Character substitutions). H6: heading kept as "Character substitutions"; hover text now "Special characters are kept in file names by default. Turn these on to remove them.". H14: done through C13 and C14. H1, H2, H7, H8, H10, H11, H12, H13, H15 left as they were.
- **C:** C1, C2, C3, C6, C8, C10 as proposed. C5 shortened by the owner. C9 uses "core". C11 describes all three things the section does. C12 without the last line. C13 without "Higher judges fewer albums" (label now "How tidy an album must be to be checked (%)"). C14 shortened (label "Out of place: how far from the rest"). C15 as proposed (also on the meters field). C4 and C7 left as they were.
- Not in the installed 3.13.0 build: these edits are in the code after the build was made.
