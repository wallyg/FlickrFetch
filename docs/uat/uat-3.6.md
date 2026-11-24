# UAT 3.6 — Health Checks (passed by the owner, Nov 22; section H not testable on the owner's library)

Needs one Rebuild first (Health Check, data button, Rebuild; about 4 to 5 minutes). Until then the new data is empty and everything works as in 3.5.

## Videos (#163)
A1. After the Rebuild, On This Day, the Timeline and the camera roll word counts as "50 photos and 2 videos" (or "3 videos" when only videos). Grids and calendars still show one number per square or day.
A2. Videos show a small "▶ Video" badge on their tile.
A3. The collage maker leaves videos out: the one-per-year pick skips them, "Collage from selected" ignores ticked videos (its tip says so), and the collage button is greyed if a day has only videos.
A4. The collage header describes the whole day, so it can say "50 photos and 2 videos from 7 years" (the picture itself only has photos). A long line shrinks a little to fit.
A5. Downloads include videos. Confirmed by the owner (video downloads were tested long ago and work).
A6. Before the Rebuild, Health Check shows a one-time notice with a Rebuild button.

A7. Tested by me on real data: counts read "48 photos and 4 videos" on On This Day, year headings "7 photos and 3 videos", badges show, collage header says "48 photos and 4 videos from 7 years" with four photos in the picture. Still to test by hand: a video download, the Timeline and camera roll wording.

## Tag use checks (#155), Health Check, Tags
B1. Tags has four new lists: Generic tags, Numbers only and File-name tags (each a Warning by default), and Tags used only once (Off by default; Settings, Tune checks).
B2. Numbers only lists tags made of digits but never a year from 1900 to 2099 (a tag like 1987 is left alone).
B3. File-name tags lists things like IMG_1234, DSC01234 and 20240315_101500. A tag like "IMG_1234 sunset" is not listed.
B4. Tune checks, Generic tags: a box holds the words, one per line. Add a word, click away, then open Health Check, Tags: the list and its count follow. A word ending in * (iphone*) also flags iphone12. "Reset to the standard list" puts the original words back.
B5. Each of these rows has an empty "Replace with" box that says "Leave empty to delete this tag". Add to plan puts "Replace "photo" with nothing (delete it)" in the plan.
B6. Clicking a row in the Overview (such as Generic tags) opens that list straight away, including the first time you open the Tags lists.

## Fix in Flickr's batch editor (#162)
C1. Photos lists: the left column has "Fix in Flickr's batch editor" under "This list". It opens Flickr's batch editor in your browser with every photo in the list (not just the ones on screen). You must be signed in to Flickr in that browser.
C2. Tags lists: each row has a "Batch editor" button that opens every photo carrying that tag.
C3. More than 500 photos: the note under the button says "Opened part 1 of 3" and offers "Open part 2" (it stays until the last part is opened, then fades). Flickr's editor takes 500 at a time.
C4. On This Day, Timeline (a month) and camera roll have a Batch editor button for the whole day or month; with photos selected, one more appears in the selection bar.
C5. Photostream and album select mode: "Batch editor" appears once something is selected.
C6. Right-click a photo: "Fix in Flickr's batch editor" opens just that photo.
C7. After opening, a short note ("Opened 17 photos in Flickr's batch editor.") appears with comfortable padding and fades after a few seconds. There is no "update your library list" prompt and no "Copy photo ids" any more; use the Update button on the toolbar after fixing things on Flickr.
C8. The left column of the Tags and Photos lists scrolls when there are more checks than fit.
C9. Press Batch editor a second time in the same session (while Flickr's editor tab from the first press is still open). The note adds "If it did not load, close the earlier editor tab, wait a few seconds and press again" and stays about 14 seconds. Found in UAT: a second list did not load until the first editor tab was closed.
C10. Tags lists: "Open on Flickr" stays on every row. For tags with accents Flickr's tag page works only some of the time (it showed "no matches" once); the batch editor is the reliable way to reach those photos.

## First launch (#141)
D1. Download the 3.6 DMG through Chrome (from the release page), open it, drag the app to Applications and open it. Before 3.6, macOS said "damaged". Now it should say it cannot verify the developer, with Open Anyway under System Settings, Privacy & Security. If it still says "damaged", the Terminal line in the README is still needed, and we keep trying.

## Backup report (#156), Health Check, Backup
E1. A new Backup tab next to Photos. Summary shows how many photos and videos are downloaded, a bar, and the date of your last download. Four tiles open their lists.
E2. Lists: Not downloaded (everything never downloaded), New since last download (uploaded after your last download and not downloaded; the text says the date), Changed since download (edited on Flickr after you downloaded them), and Saved smaller than the original (see section J).
E3. "Download these N" opens the usual download confirmation for the whole list (with the title filter applied). "Download this one" does the same for one photo. Try a small one, such as New since last download, and confirm it downloads and then drops off the Not downloaded list.
E4. "Changed since download" only counts downloads that recorded Flickr's update time; the text says how many older downloads cannot be checked. To test it, edit a downloaded photo's title on Flickr, press Update, and it should appear.
E5. Numbers come only from FlickrFetch's own records and the library list; nothing is asked of Flickr. Download your photos, then Update, and the counts follow.

## Sidebar titles
F1. In the Tags, Photos and Backup lists, the left column's section titles (Issues, Warnings, Backup, Show, Filter, This list) are now bold capitals with a line above each.

## Sort on the Health Check lists
G1. Every Health Check list (Tags, Photos, Backup) has a Sort box at the right end of the line that describes the list. Tags: Suggested order, Most photos, Fewest photos, A to Z, Z to A. Photos: Newest taken first, Oldest taken first, Title A to Z, Title Z to A. Backup: Newest uploaded first, Oldest uploaded first, Newest taken first, Title A to Z, Title Z to A. Titles starting with punctuation come first when sorting by title, and photos with no title come last. Export and the batch editor follow the chosen order.

## Upgrade notice
H1. After updating from an earlier version, Health Check shows a notice: "FlickrFetch has been updated since you last rebuilt your local library list..." with a Rebuild button and a "Not now" link. Not now hides it until you next open FlickrFetch; only a full Rebuild (not Update) removes it for good.
H2. Until the Rebuild, the checks that need it show a dash instead of a count in the Photos list (with a line saying a dash means that check needs a Rebuild first). Opening one says it needs a Rebuild before it can find anything. After the Rebuild the counts appear.


## Only one tag (#152)
I1. Photos lists have a new Warning, "Only one tag", listing photos with exactly one tag. It follows the usual Issue / Warning / Off switch in Tune checks.

## Saved size and "Saved smaller than the original" (#156, #126 groundwork)
J1. Download two or three photos (one with a size where Original is offered). Open Backup: the fourth tile, "Saved smaller than the original", counts photos where the original was asked for and Flickr gave a smaller size. On a Pro account it should stay at 0 for normal photos.
J2. That list has no Download buttons (downloading again would give the same size). The line under the title says how many earlier downloads did not record a size.
J3. Choosing a smaller size on purpose (for example Large) does not put photos in this list.

## Smaller changes
K1. Tags tab (the main one): the sort menu has A → Z, Z → A and Most photos first.
K2. Photostream: the sort menu has "Most interesting (Flickr's ranking)". Check that your private photos still appear, and that Download All follows the same order.
K3. The Tune checks button no longer shows "(N off)".
K4. The phrase "nothing on Flickr is changed" is gone from the Health Check, Tags and Rebuild texts.


## Result
Owner ran the checklist on the installed 3.6.0 build and reported all good. Section H (upgrade notice, "Not now", dashes) could not be seen on the owner's library, which was already rebuilt in dev; confirm the first time someone upgrades from 3.5. Finding: the installed build asks for keychain access on first launch (ad-hoc signature changes per build); "Always Allow" settles it. A stable fix needs an Apple Developer ID.

## Code review fixes (Nov 22)
L1. Photostream, Most interesting: the line under the toolbar adds "Flickr ranks about 4,000 photos at most". Download All in that order downloads the whole photostream (it uses posting order).
L2. Not now on the upgrade notice hides it on both Health Check and Tags.
L3. Tag limit box (Settings, Tune checks): clear it and type a new number freely; it is checked and saved when you click away or press Enter.
L4. Tags lists: tags like p900, image2013 and mov1080 are no longer listed as file-name tags; img1234, img_1234 and dsc01234 still are.
L5. Photos overview: every check has its own colour.
