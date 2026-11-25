# UAT 3.11: Scope and Filters

The sprint is built. Sections 1 and 2 were tested in earlier rounds (the filters and the first batch); section 3 is the last batch and is new. Run `npm run dev`, work down the list, tick a box when it behaves and write what you saw otherwise. Collect everything first; fixes happen in one pass.

## Filters on On This Day and the Timeline (#247, #248), same pattern as the Map and Photostream

- [ ] F1 **The new layout.** On This Day and Timeline each show, in one row, an All / Photos / Videos switch and a **Filters** button. The old All / Public / Not public buttons and the album box in the row are gone.
- [ ] F2 **Photos and Videos.** Pick Videos: the count at the top says "(videos only)", only years (or months) that have videos show, and "Download all N" matches. A chip "Videos only" appears in its own row below, with **Clear all**. Pick Photos, then All again.
- [ ] F3 **Privacy, six levels.** Click Filters: a drawer opens with **Privacy**: All, Public, Friends, Family, Friends & Family, Private, each with a count. They are the same words and order as in the Photostream and the Map. Pick Private: the counts and years narrow to private photos, and a chip "Privacy: Private" appears. The count on each button stays as it was (they show how many photos each level has under your other choices).
- [ ] F4 **Album, with an answer on the spot.** In the drawer, click the Album box, type part of an album's name: a list opens. Click an album: **it gets a tick in the list right away** and the list stays open, so you can pick another; a chip "Album: …" appears in the chip row below. Click a ticked album again: the tick goes and so does the chip. Photos in any picked album show.
- [ ] F5 **Many albums.** Pick eight or more albums: the chips wrap inside their own row (with Clear all at the end) and do not push the privacy buttons, the hint line or the Photo size slider around.
- [ ] F6 **Clear all.** With a few filters on (Videos, a privacy level, two albums), click **Clear all**: every chip goes and the counts go back to everything. On On This Day it also clears a tag chip you picked.
- [ ] F7 **The filters together.** Videos plus an album plus Public: the count matches what you expect. An album with no videos plus Videos shows "No photos were taken on …".
- [ ] F8 **Downloads and the batch editor follow the filters.** With filters on, "Download all N": the note names them, for example "(videos only) (friends only)" or "(in Album name)", and the list has that many. "Batch editor" opens only the filtered photos. "Show all" for one year shows only the filtered photos.
- [ ] F9 **Timeline.** Pick Videos or a privacy level or an album: the month squares shade only by those photos, the total says so, the day calendar and camera roll follow, and moving to the next or previous day or month keeps the filters.
- [ ] F10 **Each tab keeps its own choice.** Switching tabs and back keeps On This Day's and the Timeline's filters as you left them.
- [ ] F11 **The Map's album box.** On the Map, Filters, Album: the list now also shows a tick on picked albums, and clicking a ticked one takes it off. Chips and dots follow.
- [ ] F12 **Open in Photostream.** From On This Day (a year's "Open in Photostream") and from the Timeline (a month or day), with Videos or Photos picked and/or a privacy level picked, the Photostream opens on that date range with the same Photos/Videos and privacy filters set. With an album picked, the button's hover text says the Photostream cannot filter by album, and it opens every photo from that date.
- [ ] F13 **Before a Rebuild.** If privacy has not been saved yet (a library list never rebuilt since 3.5), the privacy buttons other than All are greyed with "Needs one Rebuild of your library list. Open Health Check".

## Map and Health Check (#252, #227), and two small ones (#191, #132)

**Restart the dev app first** (Ctrl+C in the terminal, then `npm run dev`): these changes are in the app's background code.

- [ ] G1 **Circles across the date line (#252).** On the Map, zoom out to the whole world and look at the Pacific, around Fiji and the Aleutian Islands (if you have photos there). A group of photos on both sides of the date line is **one circle** with the full count, not two circles touching. Pan across the edge: it is still one circle on each copy of the world. Zoom in: it splits into dots at the right places. Click it: the side panel lists the photos from both sides.
- [ ] G2 **Every other circle still works.** Zoom in and out in a busy place such as New York: circles split and merge as before, counts add up, clicking one shows its photos, "Download these N" still matches.
- [ ] G3 **Show on the map (#227).** In Health Check > Photos, open the check "No location" and find a row with a suggested place (it says "N photos taken within 10 minutes of it were taken here"). The button now says **Show on the map** (no arrow). Click it: the Map tab opens zoomed in on that place with a **pink ring** and a note at the top right "The place from Health Check is marked", with **Remove mark**.
- [ ] G4 **Far from the title place.** Do the same from "Far from the place its title names": the ring shows where the photo is geotagged. Remove mark makes it go away; going back to Health Check and clicking another row's button moves the ring.
- [ ] G4b **The other location checks (finding 5).** Open Health Check > Photos > Locations and look at "Vague location", "Far from its neighbours" (if you have any) and "Location at 0, 0" (if you have any): each row now has **Show on the map**, and it marks that photo's own geotag with the pink ring. "No location" still shows the button only on rows where a place is suggested.
- [ ] G5 **First visit.** Quit and reopen the app, go straight to Health Check and click Show on the map before ever opening the Map tab: it still opens on the right place with the ring.
- [ ] G6 **Album edit wording (#191).** In Health Check > Albums > May not fit, hover the "Open album" button on a row: it says "Opens the album's page on Flickr. Click Edit there to change the album or take the photo out."
- [ ] G7 **License (#132).** The repository now has a `LICENSE` file (all rights reserved, in your name) and the README's Privacy section says so in one sentence. Check the wording and the name are what you want.

Questions to answer by looking at it:
- Are the switch, the Filters button and the chip row in the right places on each screen?
- Does it read well at a narrow window (drag the window to its narrowest)?

## Last batch: Health Check scope, size notes for free accounts, Cmd+F, typing waits (#246, #126, #166, #92)

**Restart the dev app first** (Ctrl+C in the terminal, then `npm run dev`): these changes are in the app's background code.

- [ ] H1 **Include videos switch (#246).** Settings > Health Check > Tune checks: at the top there is a tick box "Include videos in the checks", ticked. Untick it and close Settings: the Photos checks (Overview and Photos lists) no longer list videos, and the total photo count on the Overview drops by the number of videos. Tick it again: they come back. (If a note says a Rebuild is needed, run Health Check > Update > Rebuild once; before it the switch can do nothing.)
- [ ] H2 **No location has its own choice (#246).** In Tune checks open "No location": below its description are two rows, **Videos** (Same as the switch / Include videos / Leave videos out) and **Privacy** (All / Public only / Not public only), and a line saying they are for No location only. With the main switch off, choose **Include videos**: No location lists videos again while the other checks still leave them out. Choose **Public only**: only public photos are listed. Put everything back to the standard choices when done.
- [ ] H3 **Counts follow.** After changing either, close Settings: the No location count on the Overview, in the list header and in Tune checks matches the list you see.
- [ ] I1 **Dialog note for a free account (#126).** In Settings > Downloads there is a section "Development only" (visible in `npm run dev` only) with a tick box "Act as a free account in the download box". Tick it. Start any download (for example "Download all" on an album). The Confirm Download box shows Quality as **Original (up to 1024 px on your account)** and under the box a short note about the 1024 px limit that says titles, tags and other details are still saved in every file. The note never blocks the download.
- [ ] I2 **Not for Pro, not for other sizes.** Untick the switch: the box shows plain "Original" and no note, as for your Pro account. With the switch ticked, set Photo Resolution to Large in Settings: the box shows plain "Large" and no note. Set it back to Original and untick the switch.
- [ ] I3 **Download History tags.** Open History > Photos: photos downloaded since 3.6 at full size carry a small **Original** tag beside the date; ones downloaded before sizes were recorded carry none. (A **Smaller size** tag in amber appears on a photo that came down smaller. You may have none; the tests cover it.)
- [ ] I4 **After a download.** Run a small download. The bar at the bottom reads "N saved" as before, with no mention of smaller (your account is Pro). If a download ever does come down smaller, the same line adds "N saved smaller than the original" and a **See the list** button that opens Health Check > Backup > Saved smaller than the original.
- [ ] J1 **Cmd+F in a person's album (#166).** Discover > People, open a person, open one of their albums: Cmd+F puts the cursor in the title search above the album's photos. On the People list it still goes to the contacts box. On Timeline and On This Day it still does nothing, as decided.
- [ ] J2 **Typing waits (#92).** In Health Check lists (Photos, Albums, Tags, Backup, Possible duplicates), the Photostream search, Discover > People and Groups and inside an album, type a few letters quickly: the list updates once you pause, not on every key; clearing the box brings the full list back at once. Nothing should feel slower than before.

