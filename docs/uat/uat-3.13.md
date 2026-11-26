# UAT 3.13 (Components)

Built so far (more steps are added as each item is built).

## Shared states and field looks (#232, #237)

One focus ring, one hover and pressed look, one disabled look and one look for text boxes and selects, written once. Visible shifts to look for are listed below.

- [ ] A1 **Keyboard focus.** Click into the app, press Tab repeatedly across a screen (Photostream, Health Check, Settings): every control you land on shows a blue ring, two pixels off its edge, including text boxes and the tab buttons that had no ring before. Clicking with the mouse does not show a ring on buttons.
- [ ] A2 **Hover and pressed.** Point at a grey Secondary button, then at a pink Main button: each gets a little darker under the pointer, a bit more while the mouse is held down, and a pink button stays pink. A select (a drop-down box) also darkens a little. Text-only links and photo tiles are unchanged.
- [ ] A3 **Disabled.** Find a disabled control (for example the Download button with nothing chosen, or Reset when nothing changed): it is half strength and the pointer shows a not-allowed sign. A disabled text box or select is filled light grey.
- [ ] A4 **Checkboxes.** Every tick box and radio button in the app is pink when ticked (Settings, filters, the album box), not blue.
- [ ] A5 **Text boxes and selects match.** In Settings (Health Check numbers, the Tune checks number boxes, the text box for words), Album Checks, Tags, Map and the Audit lists: the boxes share one edge colour (a light grey, a little darker than before on those that used the lighter one), the same corner and the same height inside a row. The box for the Tune checks word list is a standard box too. Anything that looks misaligned?
- [ ] A6 **Reduce motion.** In macOS System Settings > Accessibility > Display, switch on Reduce motion, then open a photo grid while it loads and tick a photo: the shimmer and the pop do not animate. The small spinner in the photo view while a photo is working still turns.

## Button sweep and Flickr wording (#262, #261)

About 85 hand-built buttons now use the shared looks. Visible shifts: boxed grey buttons that had grey text now have dark text like every Secondary button; small buttons in the download bar, History and Settings share one small size; links and "put aside" buttons share one look.

- [ ] B1 **Download bar.** Start a download. Pause, Skip, Dismiss all and the expand arrow match; "Open in Finder" style links are outlined blue; nothing looks lopsided.
- [ ] B2 **Photostream, Albums, Discover.** The "Clear filters", "Select", "Clear" and "Download" buttons and the back links match their neighbours. Pink Main buttons are the same pink everywhere (Download in the photo view, the Settings Save button, Retry, Update in Health Check).
- [ ] B2b **No more filled blue buttons.** "Download All Albums" (a collection's page) and Search on Discover > People are pink Main buttons; the update button in Settings (when a new version exists) is a small grey Secondary button.
- [ ] B3 **Settings and the photo view.** Change, Cancel, Restore defaults, the small "Reset" and "Cancel" lines, Copy, Download and "Show in Finder" look consistent. Anything that looks squeezed or too wide?
- [ ] B4 **One name for Flickr's tool.** Every button that opens Flickr's editor for many photos says "Open in Flickr's organizer" (with a count or "selected" where it had one): On This Day, Timeline, Camera roll, Duplicates, the Photostream and Albums selection bars, Albums, Health Check lists. Right-click a photo: the menu says the same. No button says "Batch editor" or "Fix in Flickr's batch editor".
- [ ] B5 **Your plan.** On the Tags tab open Your plan: each open item has "Open on Flickr", "View photos" and "Open in Flickr's organizer", in that order; the last opens Flickr's editor with the photos that carry that tag.

## Wording (#243), part 1

- [ ] C1 **Try again.** In the download bar after a download had failed photos, the button says "Try 3 failed again" (not "Retry 3 failed"). In History, any "couldn't load" line has a Try again link.
- [ ] C2 **Clear records.** History > Clear: the confirm button says "Clear records" for a preset, a date before and a date after, and "Clear all records" for clear all (not "Confirm").
- [ ] C3 **Loading lines.** While tabs load you see "Loading your photos…" (Camera roll, On This Day, Timeline), "Loading photos…", "Loading the group's photos…", "Checking for duplicates…". None says "Looking through", "Reading" or "Getting".
- [ ] C4 **Error lines.** With Wi-Fi off, open a tab that needs Flickr (Albums, Collections, Discover): the message says "Couldn't load albums." and the like, not "Failed to load ...". On the sign-in page, a wrong code says "That code is not right. Check it and try again." and an empty box says "Enter the code Flickr gave you." No message says "please".

## Dialogs (#236)

Eight dialogs now share one shell: same backdrop, card, shadow, close mark, Esc, backdrop click and focus.

- [ ] D1 **Esc.** Open each and press Esc: Settings, About (the avatar menu), What's New and The Problem (both from About), the Download confirm box, the collage window (On This Day), Reset records and Sign out (avatar menu, album menu). Each closes. Open What's New from About and press Esc once: only What's New closes and About stays; press Esc again: About closes. In History (the clock) Esc closes the panel too.
- [ ] D2 **Backdrop click.** Click the dimmed area outside each dialog: it closes. Drag to select text inside Settings and let go outside the card: it does not close.
- [ ] D3 **One look.** All the dialogs have the same rounded corners and shadow; the close mark is the same drawn cross in the top right everywhere (including the collage window, which used a text cross); the What's New backdrop is the same shade as the others.
- [ ] D4 **Sizes.** The Download confirm box is a little wider than before (480). Settings and The Problem are 640 wide; About 720; the Reset and Sign out questions are 360. Nothing is cut off in a narrow window.
- [ ] D5 **Focus.** Open Settings with the keyboard (Tab to the cog, Enter): focus is inside; Tab never leaves it; close it with Esc and focus is back on the cog. With the mouse, no blue ring appears around the whole dialog.

## Error screen (#254)

A screen that hits an error now shows a message and a Reload button instead of a blank white window.

- [ ] E1 **See it.** In the dev app: Settings > General, scroll to "Development only" and press "Show the error screen". The window shows "Something went wrong on this screen", a pink Reload button, and a folded "What happened". Open it: the message and the screens involved are there, and "Copy details" copies them. Press Reload: the app comes back and you are still signed in.
- [ ] E2 **One tab only.** (Developer check, or when a real tab error happens.) An error inside a tab shows the same card inside the tab area with Reload and "Try again"; switching to another tab clears it and the other tabs work.
- [ ] E3 **A dead page.** (Developer check.) If the window's page itself stops (for example after a crash), a box says "FlickrFetch stopped working" with Reload and Quit, instead of leaving a blank window.

## Date stamp pattern (#266)

The Date stamp in File Naming is now a pattern you build, with the four old formats kept as quick picks.

- [ ] F1 **Old settings carry over.** Settings > File Naming > Date stamp (set it to Prefix or Suffix): the Pattern box shows your old choice written the new way (for example `yyyy-MM-dd HH-mm-ss`), with the same example as before, and the "File name example" at the bottom matches.
- [ ] F2 **Type and click.** Type `yyyy.MM.dd 'at' HH-mm`: the example shows `2024.03.15 at 14-22`. Click the part buttons (Year, Month, Day, Weekday, Time): each adds its letters where the cursor is. Click a Quick pick: the box changes to it and the pick is highlighted.
- [ ] F3 **Problems are explained.** Type `yyyy at HH`: the box turns red and says to put the word in quotes. Type `yyyy/MM`: it says a file name cannot contain / or :. While it is red, the file name example keeps the last good pattern.
- [ ] F4 **Weekday, month name, 12-hour.** `EEEE, MMMM d` gives `Friday, March 15`; `hh-mm a` gives `02-22 PM`. With Prefix chosen, a 12-hour pattern shows the note that it does not sort in time order.
- [ ] F5 **A real download.** Download one photo with a date stamp (for example `yyyy-MM-dd EEE`): the file name has the stamp, and nothing in it is `/` or `:`. A photo downloaded before keeps its name.
