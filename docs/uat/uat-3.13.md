# UAT 3.13 (Components)

Built so far (more steps are added as each item is built).

## Shared states and field looks (#232, #237)

One focus ring, one hover and pressed look, one disabled look and one look for text boxes and selects, written once. Visible shifts to look for are listed below.

- [x] A1 **Keyboard focus.** Click into the app, press Tab repeatedly across a screen (Photostream, Health Check, Settings): every control you land on shows a blue ring, two pixels off its edge, including text boxes and the tab buttons that had no ring before. Clicking with the mouse does not show a ring on buttons.
- [x] A2 **Hover and pressed.** Point at a grey Secondary button, then at a pink Main button: each gets a little darker under the pointer, a bit more while the mouse is held down, and a pink button stays pink. A select (a drop-down box) also darkens a little. Text-only links and photo tiles are unchanged.
- [x] A3 **Disabled.** Find a disabled control (for example the Download button with nothing chosen, or Reset when nothing changed): it is half strength and the pointer shows a not-allowed sign. A disabled text box or select is filled light grey.
- [x] A4 **Checkboxes.** Every tick box and radio button in the app is pink when ticked (Settings, filters, the album box), not blue.
- [x] A5 **Text boxes and selects match.** In Settings (Health Check numbers, the Tune checks number boxes, the text box for words), Album Checks, Tags, Map and the Audit lists: the boxes share one edge colour (a light grey, a little darker than before on those that used the lighter one), the same corner and the same height inside a row. The box for the Tune checks word list is a standard box too. Anything that looks misaligned?
- [x] A6 **Reduce motion.** In macOS System Settings > Accessibility > Display, switch on Reduce motion, then open a photo grid while it loads and tick a photo: the shimmer and the pop do not animate. The small spinner in the photo view while a photo is working still turns.

## Button sweep and Flickr wording (#262, #261)

About 85 hand-built buttons now use the shared looks. Visible shifts: boxed grey buttons that had grey text now have dark text like every Secondary button; small buttons in the download bar, History and Settings share one small size; links and "put aside" buttons share one look.

- [x] B1 **Download bar.** Start a download. Pause, Skip, Dismiss all and the expand arrow match; "Open in Finder" style links are outlined blue; nothing looks lopsided.
- [x] B2 **Photostream, Albums, Discover.** The "Clear filters", "Select", "Clear" and "Download" buttons and the back links match their neighbours. Pink Main buttons are the same pink everywhere (Download in the photo view, the Settings Save button, Retry, Update in Health Check).
- [x] B2b **No more filled blue buttons.** "Download all albums" (a collection's page) and Search on Discover > People are pink Main buttons; the update button in Settings (when a new version exists) is a small grey Secondary button.
- [x] B3 **Settings and the photo view.** Change, Cancel, Restore defaults, the small "Reset" and "Cancel" lines, Copy, Download and "Show in Finder" look consistent. Anything that looks squeezed or too wide?
- [x] B4 **One name for Flickr's tool.** Every button that opens Flickr's editor for many photos says "Open in Flickr's organizer" (with a count or "selected" where it had one): On This Day, Timeline, Camera roll, Duplicates, the Photostream and Albums selection bars, Albums, Health Check lists. Right-click a photo: the menu says the same. No button says "Batch editor" or "Fix in Flickr's batch editor".
- [x] B5 **Your plan.** On the Tags tab open Your plan: each open item has "Open on Flickr", "View photos" and "Open in Flickr's organizer", in that order; the last opens Flickr's editor with the photos that carry that tag.

## Wording (#243), part 1

- [x] C1 **Try again.** In the download bar after a download had failed photos, the button says "Try 3 failed again" (not "Retry 3 failed"). In History, any "couldn't load" line has a Try again link.
- [x] C2 **Clear records.** History > Clear: the confirm button says "Clear records" for a preset, a date before and a date after, and "Clear all records" for clear all (not "Confirm").
- [x] C3 **Loading lines.** While tabs load you see "Loading your photos…" (Camera roll, On This Day, Timeline), "Loading photos…", "Loading the group's photos…", "Checking for duplicates…". None says "Looking through", "Reading" or "Getting".
- [x] C4 **Error lines.** With Wi-Fi off, open a tab that needs Flickr (Albums, Collections, Discover): the message says "Couldn't load albums." and the like, not "Failed to load ...". On the sign-in page, a wrong code says "That code is not right. Check it and try again." and an empty box says "Enter the code Flickr gave you." No message says "please".

## Dialogs (#236)

Eight dialogs now share one shell: same backdrop, card, shadow, close mark, Esc, backdrop click and focus.

- [x] D1 **Esc.** Open each and press Esc: Settings, About (the Mac menu bar: FlickrFetch > About FlickrFetch), What's New and The Problem (both from About), the Download confirm box, the collage window (On This Day), Reset records and Sign out (avatar menu, album menu). Each closes. Open What's New from About and press Esc once: only What's New closes and About stays; press Esc again: About closes. In History (the clock) Esc closes the panel too.
- [x] D2 **Backdrop click.** Click the dimmed area outside each dialog: it closes. Drag to select text inside Settings and let go outside the card: it does not close.
- [x] D3 **One look.** All the dialogs have the same rounded corners and shadow; the close mark is the same drawn cross in the top right everywhere (including the collage window, which used a text cross); the What's New backdrop is the same shade as the others.
- [x] D4 **Sizes.** The Download confirm box is a little wider than before (480). Settings and The Problem are 640 wide; About 720; the Reset and Sign out questions are 360. Nothing is cut off in a narrow window.
- [x] D5 **Focus.** Open Settings with the keyboard (Tab to the cog, Enter): focus is inside; Tab never leaves it; close it with Esc and focus is back on the cog. With the mouse, no blue ring appears around the whole dialog.

## Error screen (#254)

A screen that hits an error now shows a message and a Reload button instead of a blank white window.

- [x] E1 **See it.** In the dev app: Settings > General, scroll to "Development only" and press "Show the error screen". The window shows "Something went wrong on this screen", a pink Reload button, and a folded "What happened". Open it: the message and the screens involved are there, and "Copy details" copies them. Press Reload: the app comes back and you are still signed in.
- [ ] E2 **One tab only.** (Developer check, or when a real tab error happens.) An error inside a tab shows the same card inside the tab area with Reload and "Try again"; switching to another tab clears it and the other tabs work.
- [ ] E3 **A dead page.** (Developer check.) If the window's page itself stops (for example after a crash), a box says "FlickrFetch stopped working" with Reload and Quit, instead of leaving a blank window.

## Date stamp pattern (#266)

The Date stamp in File Naming is now a pattern you build, with the four old formats kept as quick picks.

- [x] F1 **Old settings carry over.** Settings > File Naming > Date stamp (set it to Prefix or Suffix): the Pattern box shows your old choice written the new way (for example `yyyy-MM-dd HH-mm-ss`), with the same example as before, and the "File name example" at the bottom matches.
- [x] F2 **Type and click.** Type `yyyy.MM.dd 'at' HH-mm`: the example shows `2024.03.15 at 14-22`. Press "Build from parts" and click the part buttons (Year, Month, Day, Weekday, Time): each adds its letters where the cursor is. Click a Quick pick: the box changes to it and the pick is highlighted.
- [x] F3 **Problems are explained.** Type `yyyy at HH`: the box turns red and says to put the word in quotes. Type `yyyy/MM`: it says a file name cannot contain / or :. While it is red, the file name example keeps the last good pattern.
- [x] F4 **Weekday, month name, 12-hour.** `EEEE, MMMM d` gives `Friday, March 15`; `hh-mm a` gives `02-22 PM`. With Prefix chosen, a 12-hour pattern shows the note that it does not sort in time order.
- [x] F5 **A real download.** Download one photo with a date stamp (for example `yyyy-MM-dd EEE`): the file name has the stamp, and nothing in it is `/` or `:`. A photo downloaded before keeps its name.

## Share button (#265)

Owner walked it 26 Nov: the Share button looks fine (G1). G2–G5 not separately reported; E2 and E3 are developer checks.

The collage window has a Share… button that opens the Mac share sheet (Mail, Messages, AirDrop, Notes) with the picture.

- [x] G1 **Open the sheet.** On This Day > the collage or card button. Next to Save image… and Copy image there is Share…. Click it: the Mac share sheet opens under the button, and the picture is already attached (try Messages or Notes, but do not send to anyone unless you mean to).
- [ ] G2 **Same picture as Save.** Change the shape or Large size, then Share… to Notes: the picture is the one in the preview, at the size you chose, and named like `on-this-day-Mar-15.png`.
- [ ] G3 **Not-public photos.** With some not-public photos in the collage, Share… asks the same "are you sure" question as Save and Copy before the sheet opens; Cancel stops it.
- [ ] G4 **AirDrop to your own device.** Share… > AirDrop to an iPad or iPhone of yours: it arrives as a picture.
- [ ] G5 **Built app only.** The unsigned build may not show every sharing service (Messages and Mail can be missing until the app is signed). If the sheet is empty or does not open in the dev app, tell me; that is expected to be an unsigned-app limit, not a bug in the button.

## The hover card (#228)

Every tip in the app is now one white card with a soft shadow: the old browser tips (grey, slow), the (i) notes, the Map and photo-filter "?" tips, and the On This Day "Details" panel. It is drawn above everything, so nothing can cut it off.

- [x] H1 **Short tips.** Point at an icon button or any button with a hint (for example the clock in the top bar, or Settings > the arrows beside a field). After a short pause a white card with one line appears under it. Move to the next button: its card appears straight away. Move away, click, scroll or press a key: it goes.
- [x] H2 **Explanations.** In Settings, point at an (i): the white card has headings and bullets, sits under the (i), and is not bold; the pointer stays the plain arrow (no question mark). The (i) looks the same everywhere (including the Map filters, Photostream and Album photo filters, which used a grey ?).
- [x] H3 **The Map Tags tip.** Map > filters > Tags (i): the card is fully visible, not cut off behind the tab bar.
- [x] H4 **Edges.** Scroll Settings so an (i) is at the very top, then at the very bottom of the window, then make the window narrow and point at one near the right edge: the card always stays fully inside the window (it flips above or below, and slides sideways).
- [x] H5 **Above dialogs.** Open Settings and point at an (i) or a button: the card is above the dialog, never behind it.
- [x] H6 **Disabled buttons.** Point at a greyed-out button that has a reason (for example a Download button with nothing selected): the card appears, and the pointer shows the not-allowed sign.
- [x] H7 **Keyboard.** Press Tab to move through Settings: an (i) or an icon button shows its card while it has focus, and Esc or Tab hides it. Clicking a button with the mouse does not leave a card behind.
- [x] H8 **Health Check "How it works".** Still opens on a click, stays open, closes on a click elsewhere, Esc (focus returns to the button) or Tab. Select some of its text with the mouse: it stays open.
- [x] H9 **On This Day Details.** On the On This Day card, point at the little bars icon: the Details panel opens as before (years, tags, pictures), now as the same white card. Move the pointer onto the panel: it stays. Click the icon: it stays open until you click elsewhere or press Esc.

## Polaroid frame (#269)

The Polaroid cards were rebuilt: the caption is sized to the card so nothing overlaps, and the cards grow to fill the picture.

- [x] I1 **Square.** On This Day > collage or card > Frame Polaroid > Shape Square 1:1 with about 6 photos: the year, "N years ago" and the link sit side by side under each photo, nothing overlapping; the cards fill the width of the picture, with a modest gap, not small cards floating in a big grey field.
- [x] I2 **Every shape.** Switch through Auto, Portrait, Story and Wide, and Standard / Large: no text ever overlaps; the white strip under the caption is only as tall as the caption.
- [x] I3 **Few and many.** Try one photo (one big card) and a day with 12 or more photos (small cards, text still readable and not touching).
- [x] I4 **Links off.** Untick "Short Flickr link under each photo": the caption is the year and "N years ago", nicely centred in the strip.
- [x] I5 **Saved file.** Save a Square image and open it: it looks the same as the preview.

## Fix pass (after your first walk-through)

- [x] J1 **Confirm download.** Select one photo in On This Day and press Download: the heading says "Confirm download"; under it the batch is named plainly ("On This Day, November 26 (selected)"), with "1 photo" once, not "Download 1 photos" and not repeated; the buttons say "Change settings", "Cancel", "Start download". The "Export as" switch looks like the other switches in the app (Health Check's Summary/Lists, Tags' Any/All).
- [x] J2 **Change settings opens on top.** In that box click "Change settings": Settings opens in front of the confirm box, not behind it. Esc closes Settings only; the confirm box is still there and shows any changed size or folder. Esc again closes it.
- [x] J3 **Sentence case.** Look across the app for labels in Title Case ("Clear Selection", "Download All", "File Naming", "Photo Resolution", "Download History"): they now read "Clear selection", "Download all", "File naming", "Photo resolution", "Download history". Names stay as they are (On This Day, Health Check, Album Checks, My Flickr, Smart Download). Tell me any you still see.
- [x] J4 **Switches.** The Tags "Any / All" switch and Health Check's Summary/Lists switch match the others in height, corner and pink selected look.
- [x] J5 **Date stamp is calmer.** Settings > File naming > Date stamp (Prefix or Suffix): you see only the Pattern box with its (i) and example, the four Quick picks, and a "Build from parts" link. The long help sentence is in the (i) hover card; the "Shown for 2024-03-15 at 14:22:05" line is on the example when you point at it. "Build from parts" opens the everyday parts (yyyy yy, MMMM MMM MM, dd, EEEE, HH mm ss); "More parts" adds the single-digit ones, the short weekday and 12-hour time. A problem message (or the 12-hour sort note with Prefix) still appears under the box when needed.
- [x] J6 **Shuffle.** On This Day > collage or card > Photos: a Shuffle button. With "One photo from each year", press it a few times: each year shows a different photo when that year has more than one; the years stay. With photos you ticked (more ticked than shown): a different few each press; with all of them shown: the same photos in a new order. Each press gives a different set from the one on screen. It is greyed out, with "There is nothing else to pick from", on a day with one photo per year. Changing "Public photos only" or the source goes back to the first set. Save and Copy use what you see.
- [x] J7 **Header room.** In the collage window, the line "170 photos and 7 videos from 7 years" and the row of tags under it sit clearly lower than the "Created with FlickrFetch" block at the top right, with a visible gap, in every shape; the rule line and photos start a little lower to match, and nothing is squeezed.

## Fixes from the full review

These come from a review of the whole app, not only the new 3.13 work. The first one matters most: try it before anything else.

- [ ] K1 **Everything is where it was.** Install this build and open it. You are still signed in, your Settings (folder, file naming, date stamp) are as you left them, and History / On This Day / Tags show what they showed before. Nothing asks you to sign in again.
- [ ] K2 **Photostream order.** In Settings > File naming turn on Sequence (Prefix). In the Photostream choose the sort "Oldest posted", then Download all (or use a small test folder in Settings and stop after a few). The first file is the oldest photo and is numbered 001.
- [ ] K3 **Custom text.** In Settings > File naming set Custom text to `Trip/2024` (Prefix). The example under it shows `Trip_2024`. Download one photo: it saves, with `Trip_2024` in the name, and no new folder appears. Clear the custom text afterwards.
- [ ] K4 **Long titles.** If you have a photo with a very long title (or edit one on Flickr to about 100 Japanese or Chinese characters), download it: it saves, with the title shortened and the date, number and other parts kept. (The tests cover this too.)
- [ ] K5 **Same title, overwrite.** Settings > File naming > "If file already exists" = Overwrite. Download two photos that have the same title in one batch (select both, Download): you get two files (the second ends `_2`) and "2 downloaded". Set the option back afterwards if you changed it.
- [ ] K6 **Cancel in Discover.** Discover > open someone's photo > Download, and press Cancel while it runs (a video or an Original size gives you time): it stops, no file is left behind. A download that finishes is named by your File naming settings, as for your own photos.
- [ ] K7 **Clear history.** History > Clear history: the list is empty, including any "Failed" photos shown under an earlier batch.
- [ ] K8 **Taken-back sign-in (optional).** On flickr.com, remove FlickrFetch under your account's connected apps, then open the app: it shows the sign-in screen. You will need to sign in again afterwards.
- [ ] K9 **Privacy filter on an album download.** Open an album that has photos shared with friends and family. Set the Privacy filter to "Friends & Family" and press Download album (you can cancel after the first few files): it downloads the photos the screen shows under that filter, not zero. "Friends" and "Family" now show and download only their own photos.
- [ ] K10 **Clear batch download history.** History > Batches > Clear batch download history: the batch list empties. Then open History > Photos (or a photo grid with "Downloaded" badges): your downloaded photos are still recorded and still show as downloaded.
- [ ] K11 **History album filter.** History > Photos > Album > Load albums: every album is listed (not only the first 500). Choose an album: the records narrow to its photos; choosing another album quickly does not mix the two.
- [ ] K12 **A download that cannot start.** Turn Wi-Fi off, then start an album download: the bar says "Couldn't start this download" with the reason and a Dismiss button (and a × in the expanded list). Dismiss clears it. Turn Wi-Fi back on.
- [ ] K13 **Folders.** In an album, filter (for example "Video"), press "Download N shown": the photos go into the album's own folder, not one named "Album (N shown)". On This Day > Download on a day: a folder named for the day, without the count. In the Photostream, "Download N shown" and a selection go into the download folder itself.
- [ ] K14 **Try again.** After a download with a failed photo (or by pausing the network mid-download), press "Try 1 failed again": the photo lands in the same folder as the others, not in a folder starting "Try again".
- [ ] K15 **Discover albums.** Discover > find a person who has more than 50 albums, open Albums: all of them are listed. Open one album, then go back and open another quickly: the second shows its own photos only.
- [ ] K16 **Album with a failing page.** In a large album (more than 500 photos), switch on a filter, then turn Wi-Fi off before it loads the next page: the grid stops, shows "Couldn't load the next page" and a "Try again" button, and does not keep retrying. Turn Wi-Fi on and press it: loading carries on.
- [ ] K17 **Collection download.** Collections > open one that has sub-collections > Download all albums: a box asks, with the album count (sub-collections included). Download: albums from a sub-collection land in a folder for the collection and then one for the sub-collection. Click it again while the first is running: the bar's note says the albums are already queued, and nothing is added twice.
- [ ] K18 **Discover Groups tags.** Discover > Groups > open a group > Filters > Tags: type `New York` (or `paris, travel`, separated by commas): photos tagged "newyork" (or either tag, or both with All) show.
- [ ] K19 **Explore photo.** Discover > Explore > click any photo: its detail view opens (it used to be able to crash the screen). Use the Next arrow to the last loaded photo: it loads the next page and moves on. Close it: the grid is back where it was, and resizing the window still reflows it.
- [ ] K20 **On This Day, Show all.** On This Day > on a day with more than 8 photos in a year press "Show all", then immediately step to the next day: the next day shows only its own photos.
- [ ] K21 **Mistyped sign-in code.** Sign out, press Connect Flickr account, approve on Flickr, then type the code with one digit wrong: "That code is not right. Check it and try again." Type the right code: you are signed in, without pressing Reopen Flickr. (If Flickr refuses the same request twice, the message says to press Reopen Flickr.)
- [ ] K22 **Same account, same records.** Install this build over the old one and open it: History, Tags and Health Check show what they showed before (the first account to sign in keeps the existing records).
- [ ] K23 **A different account starts clean (needs a second Flickr account).** Sign out, sign in as the other account: Tags, Health Check and History are empty until you scan; nothing from the first account is there. Sign out and back in as the first account: all its records are back. Sign out while a download or a scan is running: it stops, with no error screen.
- [ ] K24 **Flickr requests.** Settings > General > Flickr requests: a count for the last hour and since FlickrFetch opened, and the three things asked for most. Press Update in Tags and watch the count go up (it refreshes every few seconds).
- [ ] K25 **Free-account note (use the Free account switch in Settings in a development build, or a real free account).** My Flickr shows a blue note about the 1024 px limit with a Dismiss button; Discover has its own. Dismiss closes it and it stays closed after restarting. A Pro account sees neither.
- [ ] K26 **Discover: find a person from a link.** Discover > People: paste a link to one of someone's photos (flickr.com/photos/name/1234567/) or albums: their page opens. Typing a Flickr id like 12345678@N00 also works.
- [ ] K27 **Reset download records offline.** Open an album, turn Wi-Fi off, choose Reset download records and press Reset records: the box stays open and says "Couldn't reset the records. Check your connection and try again." Turn Wi-Fi on and press again: it closes and the records are gone. (The "Couldn't load this" lines on On This Day, Timeline, camera roll, Audit, Health and Albums lists only appear if the local library cannot be read; the tests cover them.)
