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
