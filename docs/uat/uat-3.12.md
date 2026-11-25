# UAT 3.12: Colour and Type (in progress)

This list grows as the sprint's items are built. Run `npm run dev`, work down the list, tick a box when it behaves and write what you saw otherwise. Collect everything first; fixes happen in one pass.

## Map colours named (#242)

- [ ] A1 **The Map looks the same as before.** Open the Map tab: the water, land and country edges are the same blues and creams as in 3.11. Single photos are dark navy dots, groups are blue circles (slightly see-through) with white counts, a picked circle has a pink outline. Zoom in with the street map on: nothing changed.
- [ ] A2 **Show on the map ring.** From Health Check, Show on the map: the ring is pink with a white edge, as before.
- [ ] A3 **Map controls and side panel.** The white panels (side panel with a circle's photos, the "How it works" box, the zoom buttons, the credit line at the bottom right, the note at the bottom left) look the same. The credit and note are slightly see-through over the map, as before.
- [ ] A4 **Album list and cache box.** The album suggestions list under the Album box (Map, On This Day, Timeline) has the same soft shadow. In Settings > General > Street map, the size box and the Clear button look the same.

## Colour guard (#234, step 1)

Nothing to try in the app. `npm test` now counts the hand-typed colours in each file (950 today, 180 different ones) and fails if any file has more, or has fewer than its saved ceiling, so the sweep can only go one way.

## Colour sweep, pass 1: colours that already equal a brand colour (#234)

268 typed colours were swapped for the brand colour they already were (white to the white and surface tokens, the pale greys and creams, navy, blue, pink, the amber and red pale fills). **Nothing should look different.** The collage maker (Share dialog) is left alone on purpose: it draws a picture, not the interface.

- [ ] B1 **Walk every screen and look for any change.** Photostream, Albums, Collections, Tags, Timeline, On This Day, Map, Health Check (Overview, Photos, Albums, Tags, Backup), Settings (all six tabs), History, the download box and the bar at the bottom, a photo's detail view. Backgrounds, panels, borders and text should be the same as in 3.11. Write down anything that looks even slightly off (a panel that went greyer or whiter, a missing line).

## On This Day button row (#251)

- [ ] C1 **One balanced row.** On This Day: "Make a shareable collage", "Batch editor" and "Download all N" sit in one row at the same height. The collage button keeps its pink fill but has a small polaroid stack as its icon (about half the old size) and no drop shadow. Check at the narrowest window: the row wraps cleanly if it must.
- [ ] C2 **It still works.** Clicking the collage button opens the Share dialog as before; it is greyed out on a day with only videos, with the same hover note.

## Photos open in the app, not on Flickr (#259)

- [ ] D1 **Map.** Click a circle, then a photo in the side panel: the photo opens in the app's own photo view over the window (the same view as the Photostream). Left and right arrows (or the arrow buttons) go through the circle's photos; at the end of the loaded ones it loads more. "Open on Flickr ↗" is a button inside the view. Esc closes it and you are back on the map with the same circle picked.
- [ ] D2 **Album fit and Tags suggestions.** Health Check > Albums > May be missing from an album > Show the photos (and Tags > Photos missing a tag): clicking a thumbnail opens the same photo view, with arrows through that strip. The tick boxes still tick without opening anything.

## Colour sweep, pass 2, batch 1: the shared styles and the dialogs (#234)

138 colours in the shared Photostream styles (filter bars, chips, drawers), Settings, the download box, About, What's new and the sign-in page now use the guide's greys. **These are visible, small changes**:
- Grey text that was `#888`, `#999`, `#aaa`, `#bbb` or `#555` and `#666` is now the guide's secondary grey (a little darker, easier to read). Near-black text (`#111` to `#444`) is the guide's text colour.
- Hairlines and dividers (the warm beige `#f0ede8`, `#e8e4de` and similar, and `#eee`) are now the one cool light grey; box and button edges (`#ccc`, `#ddd`) are the guide's slightly darker edge grey.

- [ ] E1 **Settings (all six tabs), the download box, About, What's new, the sign-in page.** Walk them and look at the grey text and the lines. Anything that is now too faint, too dark or too cold? Hints and descriptions should be a little darker than before; nothing should disappear.
- [ ] E2 **Photostream bars and drawers.** The filter row, chips, the Filters drawer and the sort and search boxes: same layout, lines a touch cooler.

## Colour sweep, pass 2: every other screen, plus shadows and overlays (#234, #233)

950 typed colours are down to 66 (45 of them the collage picture's own artwork). All the hand-typed greys, warm lines, status colours, shadows, dimmed backdrops and white panels over photos now use the guide's tokens. **Most things look the same; these are the visible shifts:** grey text is a little darker, beige hairlines are cool grey, old oranges and reds are the guide's amber and red, the pale blues are one pale blue, shadows come in three strengths and backdrops in two.

- [ ] F1 **Photostream, Albums, Collections** (grid, list, a collection's detail, the photo view with its arrows and the dark stage behind the photo).
- [ ] F2 **Discover** (People, Groups, Explore) and **History** (Photos and Batches tabs).
- [ ] F3 **Download bar at the bottom**: a finished batch with skips or failures reads amber or red like a warning or issue, not a stray orange; the progress and "See the list" button look right.
- [ ] F4 **Timeline, On This Day, Camera roll, the Tags tab, the Health Check Overview.**
- [ ] F5 **Shadows and backdrops.** Open Settings, the download box, About, the Share dialog, a menu or the album suggestions list, the Map side panel: the backdrop behind a dialog is the same dimmed black as before; shadows look the same or a hair lighter.
- [ ] F6 **Labels on photos.** Small badges on thumbnails (video badge, privacy lock, counts) and the white chips over photos or the map are still readable.
Write down anything that looks off, with the screen. (The three privacy badge colours in the photo view, the collage picture and the brand wave are untouched on purpose.)

## Type and corner scales (#231)

Weights are only regular and bold (what the screen already showed, so no change). Text smaller than 11 px is now 11 (the tiniest labels and badges grew by a pixel or two); 15 px text is 14; odd sizes moved to the nearest. Corners are on one scale (the 10 px cards are now 8; the small 2 and 3 px corners are 4).

- [ ] G1 **Walk the busy screens and look for a squeezed label.** Photostream tiles and badges, the History panel, Health Check lists and the Overview, the download bar, Settings. Anything that now wraps, is cut off, or looks too big (a tiny badge that grew, a heading that shrank from 15 to 14)?
- [ ] G2 **Corners.** Cards and panels are a touch squarer than the 10 px ones were; chips and pills are fully round. Anything that looks odd?

## Buttons: one language (#230)

The duplicated "Do this", Main, Secondary, put-aside and danger button styles now come from one place (`ui/kit.ts`). Visible shifts: the black "Apply" and "Keep searching" buttons are now the grey Secondary look; the black active "Filters" and "Download" filter buttons use the soft pink selected look like other chips; the History panel's clear and remove buttons use the Secondary and red looks; the download box's Cancel and Download buttons and the Tag and Cleanup panels' main buttons use the shared sizes.

- [ ] H1 **Photostream filter row.** Filters and the download filter, when switched on, show the soft pink selected look (not black). The "Keep searching" and History "Apply" buttons are plain grey Secondary buttons.
- [ ] H2 **History panel.** Clear history, its confirm step, the remove record question: grey Secondary buttons, red only for the destructive step.
- [ ] H3 **Download box and dialogs.** Cancel (grey) and the pink Download button look right and are the same height.
