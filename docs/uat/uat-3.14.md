# UAT 3.14 (Layout and Overview)

How to run it: `npm run dev` from the project folder (the app restarts for the main-process changes in the dashboard). Tick each line as you go and note anything that looks wrong, then send everything in one batch.

## Spacing, headings and chips (#241, #272)

- [ ] A1 **Spacing.** Walk Photostream, Albums, Health Check (every sub-tab), Settings and the Map. Gaps between rows, cards and sections look even; nothing touches a window edge or crowds its neighbour.
- [ ] A2 **Headings.** Screen titles (Photostream, Map, Timeline) match; dialog titles are a step smaller; card titles another step smaller; all navy.
- [ ] A3 **Chips.** Tag chips, count chips and removable filter chips look like one family. No italic text anywhere (try empty states in On This Day and the Timeline, and notes in Settings).

## Confirm download, About, avatar menu (#295, #297, #296)

- [ ] B1 **Confirm download.** Start a download: a subject line with the count, Quality and Save to rows with Change, "Saved in each file" and "Not saved" lines with Change, an Options group (Export as, Track this download), and only Cancel and Start download at the bottom.
- [ ] B2 **About box.** Open it: cream background, "Photos by Wally" and "On Flickr" links, link icons, the Flickr attribution sentence unchanged.
- [ ] B3 **About in the avatar menu.** Click your avatar: "About FlickrFetch" sits above Sign out and opens the same box as the Mac menu (FlickrFetch > About FlickrFetch).
- [ ] B4 **Explore header.** Discover > Explore has the same header look as the other Discover tabs.

## One top for every screen (#257)

- [ ] C1 **Same arrangement.** Photostream, Timeline (day and month views), On This Day and Map: title and count on the left, the main button and a More menu on the right, filters in a row below, info line after.
- [ ] C2 **More menus.** Photostream: More > Select photos, Refresh photostream. Check More on the Timeline, On This Day and the Map. Esc and a click outside close it.
- [ ] C3 **Narrow window.** Make the window narrow on On This Day: the Tomorrow button is not cut off.

## On This Day card (#300)

- [ ] D1 **Corner card.** On My Flickr screens (not On This Day itself) a card floats at the bottom right: "On this day: N photos". "See them" opens On This Day. "Hide for today" hides it until tomorrow.
- [ ] D2 **Hover.** Point at the small chart icon on the card: the years, tags and photos for the day appear.
- [ ] D3 **Across the years.** On This Day shows the top 5 years with "Show all N years" (and back). Changing the day resets it to 5.

## Colour and small things (#238, #256, #268)

- [ ] E1 **Issue red.** Issue marks in Health Check are a dark red, clearly different from the amber of Warnings; no green anywhere on the Health Check pages.
- [ ] E2 **Cmd+F on the Map.** Press Cmd+F on the Map: Filters open and the cursor is in the album box.
- [ ] E3 **Settings wording.** Read the Settings tabs again: file naming (Separator, Size code, Location (GPS), Clean-up), album checks. Anything unclear? (#268 stays open until you say the words are right.)

## Health Check screens (#220, part 1)

- [ ] F1 **Names and colours.** The Tags and Photos summaries use "No problems" (never "Fine" or "Dealt with"); the ring is red, amber and grey; the legend rows read label, tags, photos, share.
- [ ] F2 **Lists by type.** "Issues by type" and "Warnings by type" show a count on every row; bars use a squeezed scale and say so.
- [ ] F3 **Plan.** Add a tag to the plan, fix it on Flickr, press Update: it drops off the plan (there is no "Fixed" tab or tick).

## The dashboard (#220)

- [ ] G1 **Order.** Health Check > Overview: Health, Your library, When you take photos, Where you take photos, What's in it, Records, each under a small-capitals heading.
- [ ] G2 **Health cards.** Tags, Photos and Albums each show a ring and Issue, Warning and No problems with a count and a share. The ring says "no Issue" under its number. A card opens that report's summary. With "Include videos in the checks" on, the Photos card says "Photos and videos".
- [ ] G3 **Totals.** Photos opens the Photostream with "Photos only" and no date chip, showing about as many as the tile; Videos likewise; Albums and Tags open those tabs. "Back to Health Check" returns.
- [ ] G4 **Who can see them.** Four items. Click Public: the Photostream is filtered to public photos, with a way back. "Friends or family only" is not clickable (its hover says why).
- [ ] G5 **What is filled in.** Click Description: the Photos check list "No description" opens. The footer names the weakest field.
- [ ] G6 **Year chart.** By year / By decade and Taken / Uploaded all work. Hover a bar: the year, count, share and "Click to show them". Click a Taken bar: the Photostream shows that year, with a way back. Uploaded bars are not clickable.
- [ ] G7 **Month, day, time of day.** Hovers show the count and share; the captions name the peak.
- [ ] G8 **Guessed dates.** The note has an (i) on its left that explains a guessed date; the link opens the Placeholder date check and the numbers agree.
- [ ] G9 **Where.** Countries / US states and Top 5 / 10 / All switches in the section header. A row opens the Map near where most of those photos were taken, with "Back to Health Check". Percentages are shares of the located items. The "how exact" card's footer names any spot in no country.
- [ ] G10 **What's in it.** One Top 5 / 10 / 25 control for both cards. The tags footer says when top tags are on nearly the same photos. A tag opens its photos (way back to Health Check); an album opens with "Health Check" as its back button.
- [ ] G11 **Records.** The Busiest title follows the Days / Months pill. Rows open that day or month in the Photostream. The longest quiet spell is not clickable.
- [ ] G12 **Save as PDF.** A download icon with "PDF" sits in the Health Check toolbar on the Overview only. It opens a save dialog (Downloads to start). The PDF has no buttons or pills and holds every view: year and decade, taken and uploaded, busiest days and months, countries and states, top 25 tags and albums. "Saved …" shows by Tune checks.
- [ ] G13 **Window sizes.** Make the window narrow, then wide: cards stretch across the row, nothing is cut off, the toolbar button still fits.
- [ ] G14 **Count notice.** If it shows ("Flickr reports N photos but M are in your tag list"): it has an alert icon and a dismiss ✕; dismissed, it stays away until one of the numbers changes.

## Not in 3.14

Cameras and lenses (#301), a connections dashboard (#302), a country and state tag check (#303), a same-photos tag check (#304), the icon (#298), brand surfaces (#240), the collage photo count (#294), Electron and axios upkeep (#292), a Content-Security-Policy (#293).
