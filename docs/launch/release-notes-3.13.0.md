# v3.13: DRAFT release notes (not published)

Title for the GitHub release: **v3.13 — Shared building blocks, a full review of the app, and one account at a time**

Paste the body below once your testing is done and you have decided to publish. Edit anything you do not want to say. Before publishing, run `gh release create v3.13.0 --target main` with the .dmg, the .blockmap and `latest-mac.yml` from `dist/` (see docs/uat/build-steps-3.13.md).

---

FlickrFetch 3.13 finishes the work of making the app's parts consistent, and adds the results of a review of the whole app, which fixed a long list of smaller problems.

**One set of building blocks**
- One white hover card for every tip: pointing at a button, an (i) mark or a greyed-out button shows the same card straight away, drawn above everything so it is never cut off. It also appears when you move with the keyboard.
- Every dialog behaves the same: Esc closes it, clicking outside closes it, and focus stays inside. "Change settings" in the download confirm box opens Settings in front of it.
- A clear blue ring when you move with the keyboard, buttons darken a little under the pointer, ticked boxes are pink, and there are no filled blue buttons.
- Plainer words: errors read "Couldn't …", loading reads "Loading …", labels are in sentence case, and Flickr's editor is always called "Open in Flickr's organizer".
- If a screen hits an error you now see a message with a Reload button instead of a blank window, and only that tab is affected.

**Your files and your downloads**
- The date stamp in file names is now a pattern you build: type something like `yyyy.MM.dd 'at' HH-mm` and see the result as you type, or pick a quick pattern.
- A photostream download keeps the sort order you chose. Very long titles (including Japanese, Chinese or emoji) no longer stop a photo saving, and characters you type into the file-name text can no longer break a save.
- Two photos with the same title in one download no longer overwrite each other.
- Downloads of chosen photos (shown, by day, or "Try again") save into the right folder, not one named with a count.
- Downloading a collection asks first, never queues an album twice, and keeps sub-collections in their own folders. Downloading an album with a privacy filter now matches what the grid shows (Friends & Family used to download nothing).
- A download that cannot start now says why and has a Dismiss button. Download history keeps the photos that failed, and "Clear batch download history" no longer erases the record of which photos you downloaded.

**Accounts and Flickr**
- Your library list and download records now belong to the account you signed in with. Sign out and in as someone else and you start clean; sign back in and your own records are there. If Flickr takes back FlickrFetch's access, the app notices and asks you to sign in again.
- A mistyped sign-in code can be corrected without starting the sign-in over.
- When Flickr asks the app to slow down, it now waits and tries again instead of showing an error. Settings > General shows how many requests this computer has sent to Flickr.
- Free accounts get a calm, dismissible note about Flickr's 1024 px limit on My Flickr and Discover.
- Discover finds a person from a link to one of their photos or albums, or from their Flickr id, and its Groups tag filter finds "New York" as "newyork" like the other tag boxes. A person's albums list in Discover is no longer cut off at 50.

**On This Day**
- A Share… button opens the Mac share sheet with your collage, a Shuffle button picks a fresh set of photos, the Polaroid frame is redrawn so captions never overlap, and the header has more room.

**Steadier everywhere**
- Opening a photo in Discover > Explore no longer crashes the screen, and an album that fails to load a page no longer tries again and again.
- Lists that cannot be read say "Couldn't load this" with Try again instead of staying on "Loading", and Reset download records tells you if it could not read the album.
- Several screens could show a slow answer for something you had already left (an album in Discover, the Map photo tray, On This Day's "Show all", a download finishing on the wrong photo). They no longer do.
- A very wide panorama alone on the last row of a photo grid no longer runs past the window, and "Open in Flickr's organizer" says so when it cannot open.

**Honest limits**
- The app is not yet signed with an Apple Developer ID, so macOS may ask you to open it once from System Settings, Privacy & Security.
- macOS asks for your Mac password about the keychain the first time you open an updated copy. Choose Always Allow.
- Downloaded files that already carry location details keep them: "Strip GPS from private" only stops new location details being added.

**Installing**
Open the .dmg and drag FlickrFetch onto Applications, replacing the old copy. Your sign-in and settings carry over.
