# FlickrFetch 3.5 testing checklist: Timeline & On This Day

Dev mode (run from the project folder; quit any installed copy first, since both share one library):

```
cd "/Users/wallygobetz/Documents/Flickr Fetch App Build/flickr-fetch" && npm run dev
```

Or install the 3.5 build from `dist/`. Sign in to Flickr in whichever copy you test (a sign-in made in one copy may not work in the other).

**Before you start:** Health Check or Tags tab → **Full rescan** (a few minutes). It saves each photo's privacy and location. Until it has run, On This Day and the Timeline work, but the public / not public switch is greyed out with a note.

Collect everything you notice, then send it in one go.

## Text fixes (#129, #130)

1. Open **About** from the menu bar at the top of the screen (**FlickrFetch → About FlickrFetch**; it is not in the avatar menu). The Privacy line says there are no FlickrFetch servers, that the app talks to Flickr and to GitHub to check for a new version, and that there is no analytics or tracking.
2. In About, click **The Problem FlickrFetch Solves ›** (the same link is on the sign-in screen). On that screen, the list of embedded fields has no "album". It mentions the creator and a link back to the photo on Flickr.

## On This Day card and notification (#114)

3. A card at the top of My Flickr says how many photos were taken on today's date, the years, the busiest year and the most-used tags. It shows on Photostream, Albums, Collections, Tags and Timeline, but not on the On This Day tab itself.
4. **See them** opens On This Day. **Hide for today ✕** hides the card; it comes back tomorrow (or after you restart the app on another day).
5. **Notify me daily** on the card turns the notification on. In **Settings → General → On This Day**, check both switches: "Show the On This Day card" and "Daily On This Day notification". Turn the card off and confirm it disappears (focus another window and back, or switch tabs).
6. With the notification switch on, quit and reopen the app. Within about 10 seconds a macOS notification says "On this day: N photos". Click it: the app comes forward on the On This Day tab. It should not repeat the same day. (The notification needs macOS permission for the app; the first time you may have to allow it in System Settings → Notifications.)

## On This Day view (#113)

7. The **On This Day** tab opens on today. Check the four insight boxes (most-used tags, time of day, places, across the years) read sensibly.
8. Photos are grouped by year, newest first, with "N years ago". **Show all N** loads every photo of that year. Right-click a photo for the usual Open on Flickr menu. A click selects a photo (pink outline and tick).
9. **‹ Yesterday**, **Tomorrow ›**, **Today** and **Jump to…** (a date picker) change the date. The counts in the arrows follow. On a day with no photos you see a friendly message.
10. The **All / Public / Not public** switch: counts add up, 🔒 marks photos that are not public, and the year groups and counts change.
11. **Open in Photostream** (per year) shows that exact date in the Photostream with a date chip and a **← Back to On This Day** link. **Download these N** (per year) and **Download all N** open the usual download confirmation with the right count.
12. Tick two or more photos: **Collage from selected** and **Download selected** appear.

## Timeline (#112)

13. The **Timeline** tab shows a heatmap, newest year first, darker = more photos. Hover a square for the count.
14. Single-click a month: the bar above the heatmap shows its name and count, with **Open in Photostream**, **Download these N**, **Day by day** and **Camera roll**.
15. **Day by day** (or double-click the month) shows a calendar for that month with counts per day. The breadcrumb ("All years › 2018 › November 2018") and **Esc** go back.
16. In the calendar, single-click a day selects it (the bar then also offers **See in On This Day**, the same date across the years). Double-click a day opens it as a **Camera roll**.
16a. **Camera roll** (from a selected month or day): the breadcrumb ends in "Camera roll", Esc goes back. Photos are grouped by day with headings like "Thursday, November 22, 2018 · 32 photos". **Oldest first / Newest first** reverses it. **Show more days** loads further days of a long month. Each day has **Open in Photostream** and **Download this day**; the top has **Download all N** and, for a day, **See in On This Day**. Click selects photos, right-click gives the usual menu. The All / Public / Not public switch changes what is shown.
17. The **All / Public / Not public** switch works here too.

## Collage and cards (#115)

18. On This Day → **Make a collage…**. With nothing ticked it uses one photo from each of up to six years. The preview appears after a few seconds.
19a. Tick **Use public photos only**: any not-public photo is replaced by a public one from another year (or the count drops if there are not enough); a message appears if none of the day's photos are public.
19b. **Save as**: pick a shape (Auto, Square 1:1, Portrait 4:5, Story 9:16, Wide 16:9) and a size (Standard, or Large with twice the pixels). The text under the buttons says the pixel size it will save. In each shape the **photos resize and rearrange to fill the whole picture** (no padding): a Row turns into a stack in a tall shape, a Column into a row in a wide one, and a Feature puts its big photo on top in a tall shape. The preview always shows standard size; the saved PNG has the chosen shape and size (check the pixel size in Preview or Finder's Get Info).
19c. The header: a calendar page with the date, "On This Day" in large type, a line like "52 photos from 7 years" (the whole day; public photos only when that is ticked), and a line of the most common tags. A single photo says "N years ago today" instead. Every photo carries its year (a coloured tab on the corner; in Polaroid, the year in handwriting with "N years ago" and the short link). The footer is just the FlickrFetch mark.
19. Try the **− / +** photo count (1 to 6; 1 makes a single card), every **Layout** (greyed out for Polaroid, which arranges its own), every **Frame**, and the three **Add to the image** boxes (mark, short Flickr links, FlickrFetch address).
20. **Save image…** (the save window starts in Downloads) and open the PNG: it looks like the preview. **Copy image** then paste it somewhere. **Copy links** gives one line per photo with a `https://flic.kr/p/…` link; open one and it should be the right photo.
21. If any chosen photo is not public, you are asked to confirm before saving or copying.

## New tab bar and the Health Check tab

22. The tab bar reads Photostream, Albums, Collections, a small gap, On This Day, Timeline, a small gap, Tags, Health Check.
22a. The On This Day card shows on Photostream, Albums and Collections only; it is hidden on Health Check, Tags, Timeline and On This Day.
23. **Health Check** opens on **Tag audit** with the dashboard you know from 3.4 (your plan and "this one is fine" marks are still there). The **Tag audit | Photo health** switch at the top changes between the two reports. Both still have Overview | Lists, exports, Open on Flickr, and so on.
24a. Everything sits in one compact row: **Tag audit | Photo health**, **Overview | Lists**, a short line ("88,843 tags · 71,108 photos · updated 1 hour ago", with an (i) that explains the report), **Refresh**, **Full rescan** and **Plan (n)**. In **Lists**, the explanation of each problem type is one sentence with a **More** link.
24. (Older wording) Under the switch there is a line "N tags on N photos · updated … · Refresh · Full rescan". **Refresh** and **Full rescan** work from here (a progress card replaces the screen while a scan runs).
24a. The tab bar shows thin divider lines between its three groups.
25. The **Tags** tab is browsing only: the same data line, a blue hint "Looking for typos… Open Health Check ›" that takes you to Health Check, and the usual letters, find box and list. **View photos** still opens the Photostream.
26. From Health Check, **View photos** (on an audit finding) opens the Photostream with a **← Back to Health Check** link; from Tags it says **← Back to Tags**.

## Tags browsing

25a. In **Tags**, click **#**: a row of digits 0 to 9 appears with counts. Click a digit and the list narrows to tags starting with it (a big digit offers a further row).
25b. Click **Other**: a row of writing systems appears (Chinese & Japanese, Accented Latin, Greek, Indian scripts, Cyrillic, Hebrew, Arabic, Korean, Thai/Lao/Khmer, Symbols & others). The counts add up to the Other total. Click one to narrow the list. A large Accented Latin group offers a further row by plain letter (é under e).

## Audit lists: sort

25d. In **Health Check → Tag audit → Lists**, the **sort** menu beside the filter box offers Suggested order, Most photos, Fewest photos and A to Z. The list reorders in every status (Open, In plan, Marked fine, Fixed), and **Export this list** saves it in the same order.

## Audit plan box

25c. In **Health Check → Tag audit**, open **Plan (n)**. Each line shows its problem type and has a ✕ that removes it from the plan right there. The count on the Plan button and the dashboard update.

## Photostream handoff and the rest

27. After **Open in Photostream**, clear the date chip: the Photostream returns to normal. Switching tabs and coming back to On This Day keeps your place.
28. After the Full rescan, the Tags tab, Audit and Health still work as in 3.4 (now in Health Check).
29. **What's new** shows the 3.5 entry.

## Not in this release

Views and favorite counts on the grid (#97, deferred), the photo map (v3.6), the tag editor (v3.7), and a reminder that works when the app is closed (#139).

## Round 4 changes (23 Nov 2026) — retest these

R1. **On This Day page.** A big calendar page at the top (month and day) with **Yesterday** and **Tomorrow** on either side and "On This Day / N photos taken on <date>" beside it (no years line). **Make a shareable collage** is the pink button with a little stack of polaroids; **Download all N** is quiet. **Jump to date…** (calendar button, right side of the All / Public / Not public row) opens the date picker; **Today** appears next to it whenever you are not on today. Click a bar in **Across the years** to scroll to that year.
R2. **Insight boxes**, in order: Across the years (a bar per year, busiest in bright pink with "most"), Most-used tags (chips with counts), Time of day (24 small bars, the busiest dark; "Busiest around … (N photos)"), Places ("N of M have a map location").
R3. **The card** at the top of My Flickr: line 1 "On this day: N photos", line 2 "Across N years, YYYY to YYYY · Most active: YYYY (n)", line 3 a tag icon and the two most common tags with counts. **See them** is pink. (The macOS notification is unchanged.)
R4. **Collage dialog.** Left panel in four numbered steps: **1 Photos** (count, "The N photos I ticked" or "One photo from each year" when you ticked some, Public photos only), **2 Look** (frame; the Arrangement row appears for every frame except Polaroid), **3 Shape and size**, **4 Extras** (short Flickr links only). **Save image…, Copy image, Copy links** stay pinned at the bottom.
R5. **Collage picture.** A small "Created with FlickrFetch" mark sits top right (always, no checkbox, no web address). The tags sit on one row under the headline: up to five ordinary-length tags with space between them, never wrapped. Wider gaps between polaroids and below the header. On each polaroid, the year is on the left and "N years ago" with the short link on the right.
R6. **Health Check lists.** In both Tag audit and Photo health the left column has a second box: **Show** (Open / In plan / Marked fine / Fixed in Tag audit; Open / Marked fine in Photo health, with counts), **Sort** (Tag audit only) and **Export this list**. The text filter is gone from both. The cards start at the top of the main area.
R7. **Colours everywhere on the new pages.** Main action = pink; a chosen switch, chip or list row = soft pink with a pink edge (no navy fills); other buttons = white with a grey edge. Check On This Day, Timeline, Camera roll, Health Check (both reports, Overview and Lists), Tags and the collage dialog.

## Round 5 changes (23 Nov 2026) — retest these

S1. **On This Day banner.** Under "On This Day": a bold photo count ("52 photos", plus "(public only)" or "(tagged Parade)" when that applies), then **Jump to date…** and, when you are not on today, **Today**. No date text repeated. **Download all N** stays white (the collage button is the one pink button).
S2. **Clickable tags.** Click a tag in "Most-used tags": the page narrows to photos with that tag (counts, years, the other boxes, All / Public / Not public, Download all, the collage). A "Only photos tagged …" chip with ✕ shows what is on; click the tag again or ✕ to clear. Changing the day clears it.
S3. **Card tags.** The card at the top of My Flickr shows up to six tags with counts on one line (cut with … if the window is narrow; hover for the full list).
S4. **Collage type sizes.** Header is larger (calendar page, "On This Day", the "Created with FlickrFetch" mark and logo). Polaroid year, "N years ago" and the short link are bigger (they scale down a little when there are 5 or 6 photos). Tags sit closer together, still on one row. Links under non-Polaroid frames are bigger too.
S5. **Collage loading.** Message counts "Getting bigger pictures from Flickr… 2 of 4"; if a picture cannot be fetched you get a **Try again** button. Redrawing the page behind the dialog no longer restarts the downloads.
S6. **Switches and the Health Check bar.** Selected switch buttons (Tag audit | Photo health, Overview | Lists, All | Public | Not public, Oldest | Newest first, Any | All on Tags) are a rounded soft-pink pill sitting inside the grey rounded outline. On Health Check the left side reads "88,843 tags · 71,108 photos (i)" and the right side reads "updated 7 hours ago [Refresh] Full rescan [Plan]", so the time sits next to the button that changes it.
S7. **Refresh icon.** On Health Check, Refresh is now a circular-arrow button right after "updated 7 hours ago" (hover for what it does), followed by Full rescan. (The Tags tab keeps the word "Refresh".)
S8. **Photo health: "How complete is your library?"** The ring is split by kind of gap, with a legend: Only no description / Only no location / Only no title or camera-file title / Only no tags / Two or more gaps. Each photo is counted once, so the legend adds up to "with a gap" (13,346 in the test library: 11,008 + 1,060 + 116 + 30 + 1,132).
S9. **Completeness ring hover.** On Health Check → Photo health → Overview, hover a coloured part of the ring or a legend row: the part stands out, the others fade, and the middle shows that part's number and name; a tooltip gives the share of the library. "complete" and "with a gap" sit side by side above the legend.

## Round 6 changes (23 Nov 2026) — retest these

T1. **Library data chip.** On Health Check the right side of the bar is one chip: a dot (green; amber if the list is more than a week old), a circular arrow and "Updated 8 hours ago ▾". Click it: a panel shows "Your library list" with the counts and exact time, a pink **Update now** (quick, new and edited photos) and a quieter **Rebuild from scratch…** (a confirmation appears; takes a few minutes). Click elsewhere or press Esc to close. The wording everywhere is now **Update** and **Rebuild** (no "Refresh" / "Full rescan" on Health Check, Tags, On This Day, Timeline messages). The Tags tab uses the same chip (counts on the left, the chip on the right).
T2. **Rebuild button in the warning.** When Flickr's photo count differs from your list, the warning has a **Rebuild** button.
T3. **Plan.** In Tag audit, **Plan** has a pink count badge. Click it: a panel hangs from the button (the page does not move) with "Your plan · N to do on Flickr", each line with its problem type, Open on Flickr, View photos and ✕, then **Copy as checklist** and **Save as spreadsheet**. Click elsewhere or Esc closes it. Photo health has no Plan button.
T4. **Photo health dashboard** is now: "How complete is your library?" (ring plus three numbers), "What's missing" (one chart; dark = only that thing missing, light = that and something else; hover a bar), then "By year taken" and "Biggest Issues to address" (five entries, **Show more** for up to ten).
T5. **Tag audit dashboard** is now: "How clean is your tag list?" (ring plus four numbers), "Problems by type" with a **Tags | Photos affected** switch, then "Biggest Issues to address" (five, **Show more** for up to ten). The number tiles and the separate "Photos affected" card are gone.

## Round 7 changes (23 Nov 2026) — the library health map, first stage

U1. **Health Check is now Overview | Tags | Photos.** The old "Tag audit | Photo health" buttons are now **Tags** and **Photos**, with a new **Overview** in front (it opens first).
U2. **Overview.** A scorecard each for Tags and Photos (ring and how many need attention; click one to open its report), "Biggest Issues to address" across both (five, **Show more** up to twelve; click one to jump straight into that list), and "Optional" (the counts for the optional checks; click one to open it), with a **Tune checks…** button and how many checks are off.
U3. **Issues vs Warnings.** By default the Issues (problems that need attention) are: stuck-together names, odd characters, run-ons, photos with no title or a camera-file title, and photos with no tags. Warnings by default: possible typos, accent checks, spelling variants, no description, no location. "Biggest Issues to address" lists only Issues. The scores and rings count only the first group (so the Photos score is about 99.7% instead of 81%). In every Lists view the left column has **Issues** and **Warnings** headings.
U4. **Tune checks** (button on the Health Check bar). Each check has **Off / Warning / Issue**, with how many it finds today. Try: set one Off and see it vanish from the rail, the dashboards and the scores; set "No description" to Issue and see the Photos score drop. Changes apply at once and are remembered. (Settings → other settings are not affected.)
U5. **Not in this stage (backlog):** the new checks (dates, descriptions, locations, albums, duplicates, tag use, titles: #146 to #148, #151, #152, #155, #157, #158), suggestions (#150, #154), a minimum finding size and thresholds (#153), a front page "Albums / Duplicates" scorecard, and Backup status (#156).


## Round 8 changes (23 Nov 2026) — retest these

V1. **The tab is now Health Check** (was Cleanup). "Open Health Check ›" on the Tags tab, On This Day and Timeline, and "← Back to Health Check" follow.
V2. **Summary | Lists.** Inside Tags and Photos the two views are called **Summary** and **Lists**; "Overview" is only the front page.
V3. **Remembers your place.** Open Tags → Lists, pick another list, switch to Photos, and back to Tags: you are still on that list (same for Photos). Leaving the tab and coming back also keeps it.
V4. **Tune checks lives in Settings.** The **Tune checks** button on the Health Check bar (and on the Overview) opens **Settings → Health Check**, which can also be reached from Settings directly. Each check has a description and a grey "e.g." line.
V5. **Automatic Update.** Settings → Health Check → "Update automatically" now has three choices: **Every time I open it**, **Once a day** (default) and **Off**. Every update is quiet (no progress screen) and is the same as the Update button; it never rebuilds the list. Once a day: if the list is more than a day old it updates about 30 seconds after you open the app (it also checks hourly while the app stays open). Every time I open it: it updates about 30 seconds after every open, even if the last update was minutes ago. To test: pick Every time I open it, quit and reopen, and watch "Updated … ago" on the data chip change a minute after launch. Off: nothing happens until you press Update.

## Round 9 changes (23 Nov 2026) — code review fixes, retest these

W1. **Typed more than one way** now appears under Warnings on the Tags summary and the Overview (8,509), and follows Issue / Warning / Off in Tune checks.
W2. **Open in Photostream from On This Day with a tag chosen** opens the Photostream with that tag applied (chips "Tags (all): …" and the date). With the **Not public** switch the buttons read **Open all in Photostream** (the Photostream cannot show only not-public photos).
W3. **Copy links** in the collage dialog asks the same "not public" question as Save and Copy image.
W4. **Plan panel** closes when you click View photos or Open on Flickr, and when you leave the report.
W5. **Quiet daily Update:** if you press Update (or Rebuild) while it is running, you now see the normal progress screen. A quiet Update on its own never shows a progress screen.
W6. **On This Day:** pressing Tomorrow with a tag chosen clears the tag and loads once.
W7. Under the hood: the collage image fetch refuses redirects and anything over 25 MB, the tag filter is a bound database value, the On This Day card keeps its figures between window focuses, and dead code was removed.
W8. **Large (2×) collages are sharper.** Save or copy a collage with **Large (2×)** chosen: the message "Getting sharper pictures from Flickr…" shows for a few seconds, and the saved 2,160-pixel-wide picture is built from the 2048-pixel version of each photo (1600 if that is the largest Flickr has, never the original). Compare it with Standard: Large should look noticeably crisper when opened at full size. The preview is always the standard size.

## Round 10 changes (23 Nov 2026) — the slim On This Day notice (built after the current installer)

X1. **The card is now a one-line notice** at the top of My Flickr: a small calendar tile, "On this day: 52 photos", a blue-outlined **See them ›**, a grey-outlined **Hide for today ✕**, a white background with a blue edge on the left. A small 🔔 shows beside the buttons only while the daily notification is off.
X2. **Point at the text** ("On this day: 52 photos" and the small bar-chart icon after it): after a quarter of a second a card opens under it with the date, the years line (and "Most active"), a small bar per year (the busiest in pink), the top tags as chips with counts, and three photos. It closes when you move away, and also opens when you Tab to the text.
X3. **Hide for today** hides it until tomorrow; **See them** opens On This Day; the 🔔 turns the daily notification on ("Daily notification on" appears in green).


## Round 11 changes (23 Nov 2026) — Timeline and On This Day page (built after the current installer)

Y1. **Timeline: one click goes in.** Click any shaded month: it opens that month day by day as a calendar (no selecting first, no double-click). Click a day with photos: it opens that day's photos as a camera roll.
Y2. **Month header.** Back button "‹ Timeline", arrows to the previous and next month that has photos (greyed at the ends), the month title, the photo count, and three buttons: Open in Photostream, Camera roll (the whole month, grouped by day), Download these N.
Y3. **Day header.** In a day's camera roll the back button reads "‹ November 2018" and goes to that month's calendar; the arrows step to the previous and next day with photos and carry on into the next or earlier month when the month runs out. Esc still goes back one step.
Y4. **Coming back.** Go back to the months grid: the month you came from is outlined in pink.
Y5. **Grid key and readout.** Pointing at a square shows "November 2018: 2,340 photos" on the line above the grid straight away. Above the grid, on the right, a small "Fewer ▢▢▢▢▢ More. Grey means none." key. No year totals, no "busiest month" line. Each square also shows its photo count in small faint type at its right edge (none on grey squares, and hidden when the window is too narrow for a square to hold it).
Y6. **Back to top.** Scroll down On This Day, the Timeline calendar or a camera roll: a small round up-arrow appears at the bottom right; click it and the page scrolls smoothly to the top. It disappears again near the top.
Y7. **On This Day page.** A thin line separates each year from the one above. Each year's two actions are small buttons with icons (Open in Photostream, Download these N). Tag counts show in brackets: "Balloon (17)", in grey, and a long tag wraps neatly.
Y8. **The notice.** The dotted underline is gone; a small bar-chart icon follows "On this day: N photos" and turns blue while the hover card is open.
Y10. **On This Day header.** Smaller date tile on the left (click it to pick a date); on the right of it "On This Day" with the photo count, and under that one grouped control: ‹ Yesterday (n) | 📅 Jump to date… | Tomorrow (n) ›. A Today button appears beside it only on other days. The collage button and Download all sit at the right. A darker line separates the header from the rest.
Y11. **Hover card.** Only the small bar-chart icon after "On this day: N photos" opens it: point at the icon, wait under half a second, move onto the card and it stays; move away and it closes after a moment. Click the icon to pin it open (click elsewhere or Esc closes it). The three photos are large enough to recognise.
Y12. **Photo size.** On This Day has a Photo size slider at the right of the Public / Not public row; it changes every year's squares and is remembered.
Y13. **Back to top on more pages.** Scroll far down Photostream, Albums, Collections, an album, a collection, the Tags list and the Health Check lists: the round up-arrow appears at the bottom right and takes you to the top.
Y14. **Cmd+F on Albums** puts the cursor in "Search albums…" (and selects what is there). Other screens are in the polish list (#166).
Y15. **Settings.** Health Check tab: text has the same side margins as the other tabs and the Settings window is one size for every tab. Metadata tab: "Keep Flickr's HTML" sits directly under Description and "Strip GPS from private" directly under GPS coordinates, each indented with a small ↳ and normal dark text. Point at the (i) of "Strip GPS from private" (near the bottom): the explanation opens above the icon and is fully readable.
Y20. **Tab row.** One divider only, before Health Check: Photostream · Albums · Collections · On This Day · Timeline · Tags | Health Check (views on the left, the checkup on the right). The two older dividers are gone.
Y19. **Stacked year bars.** Health Check → Photos → Summary → "Gaps by year taken": the first button is now **All gaps**. Each bar has three parts, darkest at the bottom: **Issue only**, **Issue and warnings** (the same photo has both), and **Only warnings** (light, on top), with a key under the chart. The other buttons (No description, No location, …) stay one colour. Hover a bar for the numbers. A photo with an Issue always counts as an Issue (the score is unchanged); the middle part just shows which of those photos also have warnings, so one visit could fix both.
Y18. **Dashboard headings.** Overview, Tags and Photos now share one pattern: **Issues by type**, **Biggest Issues to address**, **Warnings to review** (Photos also has **Gaps by year taken**).
Y17. **New names.** In Tune checks the three pills are **Off / Warning / Issue** (was Off / Optional / On). The dashboards and Lists headings say **Issues** (problems that need attention, counted in the score) and **Warnings** (could be better, never lowers the score). Your earlier choices carry over: what was On is now Issue, what was Optional is now Warning.
Y16. **Health Check settings are lighter.** The long "Update automatically" explanation and the "Tune checks" paragraph are now behind small (i) icons next to their headings (point at one to read it); under each heading is one short line instead. The three update choices stay visible, with a one-line summary of the chosen one. Each check's own description and example stay as they were.
Y9. **Not in this round (backlog):** Collage from one year's photos (#164), a whole-library camera roll (#142), a library insights dashboard in Health Check (#165), and "Fix on Flickr" buttons on each year (the batch editor, #162, in the Health Checks sprint).


## Round 12 — code review fixes (23 Nov 2026), retest after the next build

Z1. **Photostream back to top.** Scroll well down the Photostream: the round up-arrow now appears at the bottom right and returns you to the top.
Z2. **Esc and dialogs.** On the Timeline, open a month's calendar, open Settings, press Esc: Settings closes and you stay on the calendar (Esc with no dialog still steps back one level).
Z3. **Rebuild while an automatic update runs.** If Rebuild is pressed during the quiet daily update, you now see "An automatic update is running in the background. Try again in a minute." instead of a rebuild that never happens.
Z4. **Privacy.** A photo whose privacy is unknown is treated as not public (it can never slip into a public-only collage).
Z5. **Timeline, today's date.** On the Timeline, a day that is today in this year no longer offers "See in On This Day" (that page leaves out this year's photos).
Z6. **Camera roll on a very busy day** loads faster (at most 600 photos per day are read).
Z7. **Collage.** If the Large size cannot be prepared, the "Getting sharper pictures" note clears.
Z8. **Filter boxes are back.** Health Check → Tags → Lists and Photos → Lists have a **Filter** box in the left column ("Filter this list…" / "Filter by title…"): type and the list narrows after a moment; Export this list follows the filter.
Z9. **Place is kept during an Update.** In Health Check → Photos → Lists pick a different list, press Update (data button), and when it finishes you are on the same list, not back on Summary.
Z10. **Restore defaults** (Settings): the Health Check tab shows the default choices straight away (Issue / Warning / Off pills, once a day).
Z11. **Keyboard.** On the Health Check Overview, Tab reaches the cards and the rows under Biggest Issues and Warnings; Enter or Space opens them. The same works for the left-column lists, the On This Day year bars, photo tiles, and the Timeline's month squares and calendar days (grey squares are skipped).
Z12. **Notice wording.** If Flickr's photo count differs from the list, the notice talks about Update and Rebuild (not Refresh and Full rescan).
Z13. **Overview is quicker to come back to.** Switching Overview, Tags, Photos, Overview shows the Overview numbers at once after the first time.
Z14. **Timeline numbers.** Each month square shows its photo count faintly at its right edge (hidden on a narrow window).
Z15. **Overview after marking.** In Health Check → Tags → Lists mark a tag "This one is fine", go back to Overview: the tag count and score have already changed (no waiting for an Update).
