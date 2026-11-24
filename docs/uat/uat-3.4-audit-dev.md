# Tag audit screen: first look (dev mode)

Quit the installed FlickrFetch first (Cmd+Q): the dev app and the installed app share one data folder, so run only one. Then, from the project folder:

```bash
npm run dev
```

1. Open **My Flickr → Tags**. A **Browse | Audit** switch is at the top left. Press **Audit**. After a second or two you see a list of problem types on the left, each with a count.
2. **Names stuck together** opens first. Each card shows the tag, a red mark where the names join, a confidence pill, and how many photos. The box under it is the fix, and you can edit it.
3. Edit one box, then press **Add to plan**. The button row changes to **Remove from plan**, and **Plan (1)** at the top right counts it. Press **Plan**: your line reads `Replace "…" with …`.
4. In the plan, press **Copy as checklist** and paste into TextEdit. Press **Save as spreadsheet** and open the file.
5. Press **This one is fine** on another card. It disappears from **Open**. Click **Marked fine**: it is there with an **Undo** button. Press Undo and it returns to Open.
6. Click **Possible typos**, **Accented tags with no plain twin** (Kantō should be near the top), **Plain tags that may need accents**, **Odd characters** and **Run-ons**. Check that the edit box label makes sense for each ("Rename to", "Keep both", "Split into", "Retype as").
7. Click **Typed more than one way** (under "Cosmetic"). Type `york` in **Filter this list**.
8. Press **View photos** on any card. You land on the Photostream with that tag. Press **← Back to Tags** and you should return to the Audit view where you left it.
9. **Export this list** (next to the filter box): press it on **Accented tags with no plain twin**, save, and open the spreadsheet. It should have 1,265 rows with columns Confidence, Tag, Photos, Replace with, Why flagged, Flickr page. Type a word in the filter box first and the export holds only the matching rows.
10. On any card press **Open on Flickr ↗**. Your browser opens that tag's page on your Flickr account. The same link is in the plan box and in the plan spreadsheet and checklist.
11. Press **Browse** and then **Audit** again: your marks are still there. Quit and reopen the app: they are still there too.

Not built yet in this slice: the metadata health report (#119) and the free-account size warning (#126). Applying fixes to Flickr is the later Tag Editor sprint.


## Metadata health (Tags tab, third switch)

H1. Press **Health**. If your tag list is older than this feature you see "One more scan needed". Press **Full rescan** and confirm; it takes about 3 to 5 minutes.
H2. Afterwards the left list shows: No title or camera-file title (about 207), No description (about 12,100), No tags (about 200), No location (about 2,000).
H3. Each photo row has its thumbnail, title (or "(no title)"), a "No title" or "Camera-file title" tag, the date taken, **Open on Flickr ↗** and **This one is fine**.
H4. Press **Open on Flickr ↗** on one: its Flickr page opens. Fix something there (a title, say), then press **Refresh** in the Tags tab. That photo should leave the list.
H5. Press **This one is fine** on a photo, open **Marked fine**, press **Undo**.
H6. **Export this list** saves a spreadsheet in Downloads (Title, Date taken, Kind, Flickr page). Try the filter box first.


## Dashboards (Overview | Lists in both Audit and Health)

D1. Press **Audit**. You land on **Overview**: four number tiles, bars for each problem type (open, in plan, marked fine, fixed), a ring showing how clean your tag list is, the biggest single issues, and photos affected by type.
D2. Click a bar or one of the biggest issues: you jump to **Lists** at that problem type. Press **Overview** to come back. Add something to your plan, mark one fine, and check the tiles and bars change when you return to Overview.
D3. Press **Health**. Overview shows: photos, complete (about 81%), with a gap (about 19%), two or more gaps; bars by type; a completeness ring; a by-year chart; and "Where the gaps cluster".
D4. In the by-year chart, switch between **Any gap**, **No description**, **No location**, **No title**, **No tags**. Hover a bar for its year, share and count.
D5. Click a cluster, such as "2021: no location". You land on the list, filtered, with a chip "Taken in 2021 ✕". Press the chip to see every year again.
