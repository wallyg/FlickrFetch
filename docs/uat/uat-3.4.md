# FlickrFetch 3.4 testing checklist (installed app)

Quit FlickrFetch (and the dev app if it is running). Install the new DMG from `dist/`. Your tag list, settings and marks carry over (the installed app and the dev app share one data folder), and the metadata scan was already done in dev mode, so Health should open straight away. If it says "One more scan needed", press **Full rescan** (a few minutes).

Collect everything you notice, then send it in one go.

## Audit

1. **Tags → Audit** opens on **Overview**: four tiles (about 88,800 tags, about 2,500 flagged, about 7,200 photos), bars by problem type, a ring (about 97% clean), biggest single issues, photos affected.
2. Click a bar: you land on **Lists** at that problem type. Press **Overview** to come back.
3. In Lists, check each type reads sensibly: Names stuck together, Possible typos, Accented tags with no plain twin (Kantō near the top), Plain tags that may need accents, Odd characters, Run-ons, Typed more than one way.
4. Edit a suggestion box, press **Add to plan**. Open **Plan (n)**: the line reads `Replace "…" with …`. Try **Copy as checklist**, **Save as spreadsheet** (the save window starts in Downloads), **Show in Finder**.
5. **This one is fine** hides a finding; **Marked fine** shows it with **Undo**.
6. **Export this list** saves every row of the current list. **Open on Flickr ↗** opens that tag's page on your account.
7. **View photos** goes to the Photostream with that tag; **← Back to Tags** returns you.

## Health

8. **Tags → Health → Overview**: about 71,100 photos, about 57,800 complete (81%), about 13,300 with a gap, about 1,100 with two or more; gaps by type; ring; by-year chart (try the buttons); clusters (2015 no description, 2021 no location…).
9. Click the "2021: no location" cluster: a filtered list with a "Taken in 2021 ✕" chip. Press the chip to clear it.
10. In **Lists**, check thumbnails load, **Open on Flickr ↗** opens the photo, **This one is fine** and **Undo** work, **Export this list** saves a spreadsheet.
11. Fix one title on Flickr, press **Refresh** in the Tags tab: that photo should leave the list.

## General

12. **About** shows 3.4 and **What's new** shows the 3.4 entry.
13. Quick checks that nothing broke: **Browse** in the Tags tab (letters, search, View photos), the Photostream, and downloading one photo.
14. **Full rescan** now asks with a button labelled "Rescan" (not "Queue Again").

## Not in this release

The free-account size warning moved to the Polish sprint (v4.0). Applying fixes on Flickr is the later Tag Editor sprint.
