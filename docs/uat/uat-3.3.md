# FlickrFetch 3.3 testing checklist

Install the new DMG (`dist/`) and open it. The installed app and the dev app share the same data folder, so your settings, history and sign-in carry over. The tag list was cleared for this test, so the Tags tab should ask you to build it.

Collect everything you notice first, then send it in one go. Don't stop to fix anything while testing.

## A. Tags tab

1. Open **My Flickr → Tags**. You should see "Build your tag list". Press **Scan my photos**. A progress bar counts photos. It takes about 1–2 minutes.
2. When it finishes, the top line says about 88,800 tags on about 71,100 photos, "updated just now".
3. Press **S**. A second row of letter pairs (sa, sb, st…) appears. Press **st**. Press **st** again to step back up. Press **All**.
4. Type `new york` in the find box. About 342 tags, with "New York" near the top and a "5 spellings" badge. Try the dropdown (Starts with, Ends with, Exact). Press Escape to clear.
5. Press **Cmd+F** from anywhere on the tab. The cursor should jump into the find box.
6. Tick the **Machine tags** box, then untick it. Change the sort to **Most photos first**.
7. Tick `athens` and `acropolis`. The tray shows a photo count. Flip **any / all** and watch the count change. Press **View photos**: you land on the Photostream with a "Tags (any/all): …" chip.
8. In that view, the green **Download N shown** button should show the same number of photos as the chip.
   Then click the **Tags** tab again: your letter, search text and ticked tags should still be there. (There is no dedicated Back button yet; tell me if you want one.)
9. Back on Tags, find `québec`, tick **Citadelle of Québec**, press **View photos**. It should show 66 photos (not zero).
10. Hover **Refresh** and **Full rescan**. A tooltip should open below each button, fully on screen, with separate lines. Press **Refresh** (a few seconds). Press **Full rescan**: a confirm box with two short paragraphs. Press Cancel.

## B. Photo details

11. Open a photo whose description has a link (search the Photostream for `Kynbernis`). The description shows a blue link, not raw code. Click it: it opens in your browser.
12. Open `NYC - Metropolitan Museum of Art: Frederic Edwin Church's The Parthenon` (search `Parthenon Church`). The first line should be in italics.
13. In the detail panel, press **Open on Flickr**. The photo's page opens in your browser.
14. On a Creative Commons photo, press **Copy attribution**, then paste into TextEdit. It reads like: "Title" by Name, license (link). Source: link. On an All Rights Reserved photo, the button should not appear.
15. Press **Copy all metadata** and paste into TextEdit. Title, description, tags, dates, location, camera, license, links.
16. From the Photostream, open any photo and click one of its **tags**. You land on the Photostream with that tag.
17. Open an album, open a photo, click a tag. The album filters to that tag with a chip like "Tags (any): Wine tasting · in this album (27+)". Press **Search whole photostream** in the chip row.
18. Right-click a photo in the grid (try grid, list, and justified views). A menu offers **Open on Flickr** and **Copy Flickr link**.

## C. Files and Settings

19. Download one photo that has a link in its description (the Kynbernis one). Tell me which file, and I'll read its description to confirm it is plain text with the link written as "text (address)".
20. In **Settings → Metadata**, turn **Keep Flickr's HTML** on, download the same photo again, and tell me. I'll confirm it kept the original markup. Turn it back off after.
21. Hover the small **i** icons in Settings (Downloads, File Naming, Metadata). Each tip should have blank lines between separate ideas and not run off the window.

## D. General

22. **About** shows version 3.3. **What's new** shows the 3.3 entry.
23. Discover still works: look up a person, open a photo. Tags in Discover are plain text (not clickable), as intended.

## Already known, no need to report

- Opening a different album keeps the previous album's filters on (#134). After clicking a tag in one album, the next album may say "0 matching". Use Clear all.
- Dialogs not yet reworded for readability (#135).
- The Tags audit screen is designed but not built yet.
