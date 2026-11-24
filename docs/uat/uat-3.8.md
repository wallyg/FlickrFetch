# UAT 3.8 — Album Fit & Suggestions: run sheet

**Clickable version:** https://claude.ai/artifact/DjzhxooCmcndwr4grUWzTC (ticks, problem flags and notes are saved there and Claude can read them; this file is the plain-text copy).

**How to use this.** Work top to bottom. Each step says where to go, what to do, and what you should see. Tick the box when it behaves, or write what you saw on the Note line. Send me all the notes in one batch at the end; I fix everything in one pass and build once. The old step numbers (A1 to A15) are in square brackets so earlier messages still make sense.

**Background.** There is no new scan or Rebuild. Everything is worked out on this computer from the library list, the album list, dates, places and tags. All the new checks are Warnings (Off / Warning / Issue in Tune checks). The numbers quoted are what this library showed when I tested the data, so yours should be close.

---

## 0. Start
- [ ] 0.1 Quit any open FlickrFetch window. In Terminal, in the project folder, run `npm run dev`. The app opens and you are still signed in.
  Note:

---

## F. New in the fix pass (try these first)
Built after your first round of feedback; the clickable version has the same steps (F1 to F10).
- [ ] F1 Tab order Overview, Photos, Albums, Tags, Backup; no pop-up on the tab bar; the Updated menu (click the chip) ends with a note on how Health Check works.
- [ ] F2 Albums > Summary: two groups with rings, short legends, one row per check with its unit (May not fit and May be missing in photos, in N albums); Biggest warnings to heed.
- [ ] F3 Albums > Lists left rail in the same two groups with dots.
- [ ] F4 May not fit: Reason menu with counts; "Judged by ... Change" line; Open photo, Open in Flickr's organizer, Open album, This one is fine.
- [ ] F5 May be missing: collapsed rows; Show the N photos opens description, thumbnails with ticks (click opens on Flickr), full reason; the organizer button opens only the ticked photos.
- [ ] F6 Tune checks: jump chips, one-line checks that open, coloured Off / Warning / Issue, "changed" mark, rules as bullets, no example lines.
- [ ] F7 Tune checks > Albums: tidy counts table, tick boxes, no backslash; How each album is judged (search, change, Reset, only changed).
- [ ] F8 Pink toggles on Photostream, album grid, Discover and the download box.
- [ ] F9 Cmd+F inside an album goes to its title search.
- [ ] F11 Tags rows (and the left column grouped: Typos and joined-up words, Accents, Tags that say nothing, Gaps, with Issues first and a dot): no repeated second line, Very likely / Possible / Unlikely marks only where it varies, "on 91 photos" beside Singular and plural, Why these photos? and Show the N photos on Photos missing a tag.
- [ ] F12 Reason menu on Odd characters and on No title or camera-file title; the export follows it.
- [ ] F13 Tags and Photos summaries: new ring and short legend, no footnote, Biggest warnings to heed on Tags, shorter hints.
- [ ] F14 Photos left column grouped (Titles and descriptions, Tags, Dates, Locations, Duplicates).
- [ ] F15 Every screen remembers where you left off: scroll a list, click to another tab and back (also the Health Check tabs and Settings > Tune checks); same place, same filters.
- [ ] F10 Spot-check the new one-line descriptions and (i) rules (all 39 in docs/copy/check-copy.md).

---

## 1. Albums: Health Check > Albums
- [ ] 1.1 **[A1] The new checks.** Open Health Check > Albums > Summary, then Lists.
  Expect: two new rows under Warnings, "May not fit its album" (photos) and "May be missing from an album" (albums), and Summary tiles for both.
  Note:
- [ ] 1.2 **[A2] May not fit rows.** Open "May not fit its album".
  Expect: each row is a photo in an album with a reason, such as "Taken Mar 2019. This album is mostly Jun 2015 to Sep 2015" or "1,900 km from the middle of this album's 87 other photos". Buttons: Open photo, Open album, This one is fine. About 429 rows in all (about 313 from dates, places and tags, plus the wrong-place reasons in step 1.3).
  Note:
- [ ] 1.3 **[A8c] Wrong-place reasons.** In the same list, look for "Filed in another place's album" (title starts "NYC - Chelsea" but the photo is in an album for another place) and "In two albums for different places". About 90 and 29.
  Expect: both make sense. (They need titles that start with a place, and can be switched off in Tune checks: 1 yes, 0 no.)
  Note:
- [ ] 1.4 **[A6b] A whole outing in the wrong album still shows.** Look for the National Zoo photos in Bronx: Bronx Zoo (or any whole outing filed in the wrong album).
  Expect: it is still listed, even though most of its neighbours are in the same album.
  Note:
- [ ] 1.5 **[A7] A later visit away from home.** Find an album with two visits to a place that is not home (Budapest 2022 and 2026).
  Expect: a photo with a geotag inside the album's area is not flagged as out of date. A photo with no geotag is still flagged, and its reason says to add a location; once you add one and press Update, it drops off the list.
  Note:
- [ ] 1.6 **[A3] May be missing rows.** Open "May be missing from an album".
  Expect: each row is an album with how many photos may belong and why (dates, area, tags). Buttons: Fix in Flickr's batch editor (opens exactly those photos in Flickr's editor), Open album, This one is fine. About 950 photos in 146 albums.
  Note:
- [ ] 1.7 **[A8] The word hint.** Read the end of a May be missing reason.
  Expect: a hint such as "399 of 399 also mention london or wimbledon" (how many suggested photos mention a distinctive word from the album's name). It is a clue only; nothing is hidden when the number is low.
  Note:
- [ ] 1.8 **[A4] Organised by.** On any row, change "Organised by" (Automatic with the guess, Date, Place, Tag, or Anything to leave it alone).
  Expect: the list recalculates at once; Automatic goes back to the guess; the choice is still there after you leave and return. Albums under 30 photos are not judged unless you choose a kind.
  Note:
- [ ] 1.9 **[A5b, A6d, A8g] Tune checks for these checks.** Open Tune checks and find "May not fit its album" and "May be missing". Change one number at a time and watch the counts under it.
  Expect: live counts (albums by date / place / tag / left alone, photos that may not fit by reason, photos that may belong and how many are backed by both signals). Under May be missing there is "Use titles that start with a place" (1 or 0) and a share needed (30%); with 0 it runs on nearby photos alone. After you have marked some fine, a line says "You have marked N photos fine: X still flagged at these numbers, Y no longer". A reset button restores the standard numbers.
  Note:

---

## 2. Tags: Health Check > Tags
- [ ] 2.1 **[A6c] Glued names and run-ons.** Tags > Lists.
  Expect: "Names stuck together" about 50 (was 269) and "Run-ons" about 59 (was 74). Your earlier "This one is fine" glued decisions are mostly gone from the open list.
  Note:
- [ ] 2.2 **[A8h] Singular and plural.** New Warning.
  Expect: each row is the rare form of a pair (alleys on 1 photo, alley on 147) with "Use this tag" and Add to plan. About 44 tags, 108 photos. Known mistakes to mark fine with a reason: Frances beside France, Romans beside Roman, Cloister beside Cloisters. Possessives (Wally's) are skipped.
  Note:
- [ ] 2.3 **[A8i] Possessive on its own.** New Warning.
  Expect: a one-word possessive (Cliff's) with the plain name in the box to edit. Not flagged: two-word ones (Del Frisco's) and one-word ones whose photos mostly carry a restaurant, bar or shop tag (McDonald's, Joe's). About 69 tags, 443 photos. Tell me which flagged ones are really venue names.
  Note:
- [ ] 2.4 **[A8j] Overview row.** Tags > Overview.
  Expect: "Photos missing a tag" has its own row, counting the photos that may need a tag (not the ones that carry it). About 697 tags / 1,167 photos.
  Note:
- [ ] 2.5 **[A9] Photos missing a tag, the list.** Tags > Lists, new Warning.
  Expect: each row is one tag with how many photos may need it and why ("14 carry a tag that nearly always comes with it, most often Britain; 15 are in an album where nearly every photo has it..."). "Add <tag> in the batch editor" opens exactly the photos missing it. This one is fine hides the row. There is no Add to plan or View photos here. First rows are where three or more clues agree.
  Note:
- [ ] 2.6 **[A9b] Its settings.** Tune checks, "Photos missing a tag": clues that must agree (2, goes up to 5), tag habit 98%, album share 95%, title place share 95%.
  Expect: live counts; try 3 clues to see only the surest. Accent and spelling twins of one tag (Kanto, Kantō, 関東地方) each get their own row: useful or noisy?
  Note:

---

## 3. Photos: Health Check > Photos
- [ ] 3.1 **[A8d] Location hints.** Photos > Lists > No location.
  Expect: rows like "2 photos taken within 10 minutes of it were taken here, within 300 m of each other", with "Show on a map". About 409 of 1,907 get a suggestion. You still add the location in Flickr (the batch editor can). Tune checks, under No location, has minutes (10) and metres (300) with live counts.
  Note:
- [ ] 3.2 **[A8d] Title hints.** In the lists with no title or a camera-file title.
  Expect: about 8 rows suggest how the title could start.
  Note:
- [ ] 3.3 **[A8d] Far from the place its title names.** New Warning.
  Expect: about 15 photos, such as a Kauai luau geotagged 8,065 km away and "NYC - Corning" titles; the row says how far and has "Show on a map".
  Note:
- [ ] 3.4 **[A8n] Possible duplicates.** Photos > Lists > Warnings > Possible duplicates.
  Expect: about 152 groups, 324 photos. One card per group, photos side by side (thumbnail, title, upload time, tags, albums, privacy). The earliest upload says First upload; a different title says Different title. Check: do real re-uploads show up, and does a burst you shot not? Tell me about any group that is clearly not a duplicate.
  Note:
- [ ] 3.5 **[A8n] Duplicate buttons.** On a card: Open on Flickr (per photo); tick photos then "Fix selected in the batch editor"; "Batch editor (N)" for the group; "Not duplicates" hides the group and asks a reason; Marked fine > Undo brings it back; Sort (biggest gap between uploads, newest, oldest). Tune checks has minimum minutes apart (10) with live counts.
  Note:
- [ ] 3.6 **[A8b] Edit buttons on photo lists.** In the Photos lists and in the Albums photo lists (photos in no album, May not fit): tick several rows.
  Expect: each photo row has a tick box and a "Batch editor" button. A bar appears: "N selected", "Fix selected in Flickr's batch editor", "Select all N showing", Clear. May not fit rows say "Open album to edit" and open the album's page on Flickr (tell me if there is a better link).
  Note:
- [ ] 3.7 **[A8e] Reasons for fine.** Mark anything fine in any list.
  Expect: a bar at the bottom, "Marked fine (<check>). Why?", with quick reasons, "Other..." (type a few words, Enter) and Skip. It goes away by itself after about 12 seconds, or when you pick one ("Noted. Thank you."). Skipping costs nothing; the mark is already saved. Undo on a fine item removes its reason. Tune checks shows "Your reasons for marking fine: ..." under each check with some, and "Save them as a spreadsheet" at the bottom (check, item, reason, note, date).
  Note:

---

## 4. Other screens
- [ ] 4.1 **[A11] Cmd+F.** Press Cmd+F on Photostream, Collections, the History window (Photos tab), Discover > People and Discover > Groups (the list, and the title search inside a group). Also recheck Albums and the Health Check lists (unchanged).
  Expect: the cursor jumps to the search box and selects what is in it. Check that only the tab you are on answers: switch to Discover, press Cmd+F, and the hidden Albums search must not take it.
  Note:
- [ ] 4.2 **[A12] Wording.** Open each: Reset download records (album menu), Sign out, Clear photo download records in History (try 7 days, a date, and Clear all), and the Problem FlickrFetch Solves screen.
  Expect: each box says what happens on one line and what is not affected on the next (your files are not deleted; photos and history stay on this computer). Also share a collage that includes a non-public photo: two-line warning.
  Note:
- [ ] 4.3 **[A10] Hover notes on checks.** In Tune checks hover the small (i) after a check's name; in any list hover the grey description at the top (small (i) at its end; Tab reaches it).
  Expect: plain words with the real numbers.
  Note:
- [ ] 4.4 **[A8f] Dark tooltips.** Hover the batch editor buttons, the tab group at the top of Health Check, and "Download shown" in Discover groups.
  Expect: a dark pop-up straight away. (You have asked for the one on the Health Check tab group to go: see the Findings list at the bottom.)
  Note:
- [ ] 4.5 **[A8l] Settings and loading.** Change a toggle in Settings and close Settings straight away, then reopen it: the change is there. In Discover, open a photo at the end of a loaded page and press Next twice quickly: it moves one photo. Note any screen that shows Loading for a long time. (The "could not be loaded, Try again" messages are hard to trigger on purpose.)
  Note:
- [ ] 4.6 **[A8m] Overviews and Discover.** The Tags and Photos overviews, the front page and the Backup overview should offer Try again if they cannot load (hard to trigger; just note any problem). Discover: Following lists everyone you follow; a starts-with title search looks through up to 1,000 results (slower than before).
  Note:
- [ ] 4.7 **[A8k] Safety fixes (if you can).** Download a photo with the overwrite setting and cancel it part way: the old file is still there. Sign in again and confirm it works.
  Note:
- [ ] 4.8 **[A8o] Smart downloads.** Select a few photos in an album and download them, then use Download updated photos on that album.
  Expect: those photos are not fetched again unless they changed on Flickr. A cut-off download leaves nothing behind for a day-old .part file in a folder you download into again.
  Note:

---

## 5. Checks with no screen
- [ ] 5.1 **[A13]** In Terminal run `npm test`: it should show 73 passing tests. The typecheck is already clean.
  Note:

---

## 6. Build, signing and #141 (do this last, with Claude)
Do these after the fixes from sections 1 to 5, with one build.
- [ ] 6.1 **[A14] Signing walkthrough (#176).** Make the certificate "FlickrFetch Local Signing" in Keychain Access (Certificate Assistant > Create a Certificate > Code Signing, validity 3650 days), export a .p12 backup, confirm `security find-identity -p codesigning` lists it, then build. The build log should say "signing with your certificate". Install it over the old version and choose Always Allow on the keychain prompt once, then install a second build over it: the prompt should not come back. This is the only way to prove the certificate path, which has not run yet.
  Note:
- [ ] 6.2 **[A15] Close out #141 ("damaged" on first launch).** Download the build through Chrome (publish it, or send the .dmg to yourself) and open it.
  Expect: "cannot verify the developer" with Open Anyway under Privacy & Security, not "damaged". Check README install steps 3 and 4 match what you saw, then close #141 (the README rewrite goes with #131).
  Note:

---

## Findings so far (running list)
1. Remove the hover tooltip on the Health Check tab group (Overview / Tags / Photos / Albums / Backup).
2. Tags > Overview, "How clean is your tag list?": "photos carry one" is unclear; "32 worked on: 1 fixed, 2 in plan, 29 marked fine" is not intuitive; the footer text ("Counts only the checks set to Issue...") is clunky.
3. Idea: show all tags as parts of the whole (fine / warning / issue) in the ring.
4. Question: show the biggest Warnings as well as the biggest Issues? (Same layout may apply to the Photos and Albums overviews.)
5. Two looks for the pill toggles: Health Check and On This Day use the pink style; Photostream, Albums grid and Discover All / Photos / Videos use the older black style. Decide whether to make them match.
6. Question: order of a list (alphabetical or not): which list did you mean?
7. Albums > Summary, "Your albums (from the album list FlickrFetch keeps on this computer)": needed? Explain how Health Check works once, in an (i), and repeat that pattern; about ten other card titles carry grey hints too.
8. Albums > Summary tiles mix two kinds of check: album housekeeping (empty, no collection, one photo, no description, same title) and photo-in-album assignment (photos in no album, may not fit, may belong). Split into two groups, as bars, with Issues and Warnings apart. Note: May be missing counts albums (146) while the others count photos.

---

## How it decides (reference, not steps)

**How the guess works [A5].**
- **Date album:** nearly all its photos sit in a few dense visits (runs of photos at most 45 days apart, up to four runs of 5 or more photos). Budapest 2022 and 2026 is two visits. A photo is a date outlier when it sits on its own, away from every visit.
- **Place album:** a long-running album whose photos mostly sit within 25 km of its middle. A photo is out of place when it is far beyond the album's own spread (2.5 times its 95th-percentile distance, and at least 0.5 km more), however tight the album is, so the wrong neighbourhood is caught.
- **Tag album:** a long-running album with a clear subject tag (on half the album and much rarer elsewhere). A photo is called out when it carries none of the album's distinctive tags (Streetart: streetart, graffiti, mural).
- Everything else is left alone. Albums with fewer than 30 photos are not judged unless you choose a kind.

**May not fit, the numbers [A5b, A6b].** Share of an album in its cluster 95%; days between photos of one visit 45; a run of this many photos or fewer is on its own 2; times the album's spread 2.5; extra km 0.5; share of nearby photos that clears a flag 50%. A flagged photo is cleared when at least half of its nearby photos (3 or more, within 30 minutes and 300 m) are in the same album, unless it is far outside the album's area (more than 10 times the usual far distance and 25 km). On this library the list went from 439 to 313.

**May be missing, the rules [A5b, A6, A6d].**
- A photo is suggested for an album it is not in when the place its title starts with ("Buenos Aires - La Boca: ...") is used on at least 5 photos and at least 75 percent of them are in that album, or when at least 80 percent of at least 3 photos taken within 30 minutes and 300 m of it are in that album.
- Three guards: it is not suggested for a place album when it already sits in a separate place album (a neighbouring district); a date album only gets photos taken during its visits (14 days either side); the photo must carry the tags nearly every photo in the album has (for a subject album such as Streetart, any one of its subject tags).
- The reason says how many came from the title, how many from nearby photos and how many from both. "Only when the title and the nearby photos agree" is a setting (1 or 0).
- Titles are optional: a place can end with a colon or a pipe, and a single place ("City: Subject") works as well as "City - Neighbourhood: Subject" (hyphen or dash). 69% of this library's photos have a title that starts with a place.
- On this library the list went from 7,502 photos in 55 albums to about 950 in 146 albums.

---

## Questions to answer by living with it
- Is the reasons bar helpful or in the way? Are the quick reasons the right ones for the checks you use, and which are missing?
- How many "May not fit" rows are right, wrong, or right-but-fine ("This one is fine")?
- How many "May be missing" albums are real gaps worth filling?
- Do the guessed kinds look right? Which albums did you override, and why?
- Is the "both agree" setting (1) the right strictness for May be missing, or is the default list better?
- Do the missing-tag suggestions look right?
- Does it feel worth keeping? If not, say so and I will unwind it (nothing is committed yet).

## Known imperfections
- A photo flagged for being far away could be a real exception (a trip photo in a local album): use This one is fine.
- Subject albums still get the most May be missing suggestions (Food Porn about 150, Streetart about 80): the photo carries one of the album's subject tags and was taken near photos already in it, which is weaker than for place and date albums. Try "only when both agree".
- The title and nearby-photos rules need time and place data: photos without a geotag have no nearby photos, so only the title can suggest an album for them.
