# UAT 3.15 (Collage and Sharing)

How to run it: `npm run dev` from the project folder. Restart it once (stop it, run it again) because Share now sends text, which is a main-process change. Open On This Day for a day with photos in several years (November 27 has 26 photos over 7 years). Tick each line as you go and send everything in one batch.

This is the second round: the first round's feedback and the design changes since (one door into the maker, Open menus, three steps) are all in below. Lines A to E still cover the original sprint items; G to J are new.

## The page (#306)

- [ ] G1 **One door.** At the top of On This Day: "Make a collage", "Download all 26" and "Open ▾". The button always makes the default collage, whatever is ticked. There are no "Collage from these N" or "Collage from selected" buttons any more.
- [ ] G2 **Year rows.** Each year row has Collage (hidden for a year with fewer than two photos), Download and Open ▾. Collage opens the maker already set to that year.
- [ ] G3 **Open ▾.** On a year: In FlickrFetch (opens that date in the Photostream), On Flickr (that day on your Flickr page; grayed with a reason while a tag is showing), In Flickr's organizer (that year's photos). On the day: In FlickrFetch and On Flickr are grayed with "pick a year"; In Flickr's organizer works.
- [ ] G4 **Ticked photos.** Tick photos by clicking them: a bar shows "N selected", Collage (needs two or more), Download, Open ▾, Clear. In Open ▾ only In Flickr's organizer works; the other two say "not for ticked photos". Collage opens the maker set to "My N ticked photos".
- [ ] G5 **Insights fold.** The four insight boxes are folded into one line ("7 years · most 2025 (7) · JAsper, Liberty, Thanksgiving · busiest around 10 am · 23 of 26 on the map"). Show insights opens them; Hide insights folds them again. The page remembers which you left it on next time.

## The window: where the photos come from (#306, #307)

- [ ] H1 **Pinned source and count.** At the top of the window, always visible: "Photos from" (one photo from each year, each year with its count, My N ticked photos when you ticked two or more) and "How many" (− and +). Changing "Photos from" resets the count to a sensible one.
- [ ] H2 **Opening count.** Opened from the big button: the number of years, but never more than 6 (November 27 has 7 years: 6). Opened from a year: that year's photos, at most 6. Opened from ticked photos: all of them, up to the limit for the look.
- [ ] H3 **Evenly across the years.** One photo from each year, with fewer photos than years: the years are spread evenly, the oldest and newest always in ("Years: 2014 · 2017 · 2021 · 2025"). Press − and + and watch the years change; they are never just the newest ones.
- [ ] H4 **Oldest first.** Every picture, in every look and arrangement, goes oldest to newest, and photos from the same year sit next to each other.
- [ ] H5 **More than the years.** Press + past the number of years: the extra photos come from the busiest years, next to that year's other photo.
- [ ] H6 **Any number.** "How many" is free for every source: pick 3 or 5 or 8, as long as the look and shape allow it ("up to N").
- [ ] H7 **Shuffle.** On the Photos step, Shuffle keeps the spread across the years and picks other photos (and, with more years than photos, other years in the middle). In One year only or Ticked photos it picks a different few. It is grayed when there is nothing else to pick.

## The window: three steps (#307)

- [ ] I1 **Steps.** Style, Layout, Photos, as numbers you can click in any order, with Back and Next. A one-line summary under them says the look, arrangement and shape you have.
- [ ] I2 **Style.** Look: five small previews made from your own photos (Polaroid, Tinted, Paper, Gallery, Film). Shape: five small drawings (Auto, 1:1, 4:5, 9:16, 16:9) and Standard or Large. It should fit without scrolling in a normal window; if it does not, "More below" shows.
- [ ] I3 **Layout.** Arrangement cards with a drawing and a few words: Grid, Mosaic, Feature, Banner, Row, Column, By year. Polaroid says it arranges itself. One photo says it makes a single card.
- [ ] I4 **Grayed cards.** Feature and Banner below 3 photos; By year with one year; in Square and Wide, Column (same as Row) and Banner (same as Feature); in Story, Row (same as Column). Each says why in a few words.
- [ ] I5 **Photos.** Thumbnails (point at one to see it larger), click to replace, drag to swap, Shuffle, Public photos only.
- [ ] I6 **Save, Copy, Share** stay at the bottom at every step, with the not-public line above them.

## How many photos (#294)

- [ ] A1 **More than six.** The "up to" number says 8 for Tinted, Paper, Gallery and Film, and 6 for Polaroid. Press + up to the limit: eight photos show, none tiny.
- [ ] A2 **Fewer for some looks.** Choose Row: the limit drops (six). Choose Grid, Feature, Banner or Mosaic: eight. The text says "for this look" when the number is lower than it could be. If you asked for more than fits, a line says what it shows and that another look or shape can bring them back.
- [ ] A4 **Shapes.** Try Square, Story and Wide at 8 photos: the limit changes if a photo would get too small, and nothing overlaps.

## New arrangements (#144)

- [ ] B1 **Mosaic.** Tiles of different sizes that fill the picture with no gaps, for 2 to 8 photos. The big tile moves around (it is not always on the left), so it no longer looks like Feature.
- [ ] B2 **By year.** Photos grouped under a heading for each year, oldest first, with no year tabs on the photos.

## Swap, replace, crop (#143, #270)

- [ ] C1 **Replace.** Click a small photo on the Photos step: a box opens with other photos from that day (none already in the picture). Pick one, "Use this one": it takes the place. Cancel closes it.
- [ ] C2 **Swap.** Drag one small photo onto another: they trade places in the picture (your swap stays, even though the default order is oldest first).
- [ ] C3 **Move and zoom.** Click a photo in the picture: a pink outline and a small bar appear. Drag the photo to move it; the Zoom slider zooms (100 to 400%); Reset puts it back; Done closes the bar. Try it in a Polaroid too.
- [ ] C4 **Saved.** Save image…, Copy image: the crop and the swaps are in the saved picture, and the pink outline is not.

## One year (#164)

- [ ] D1 **From a year row.** Collage on a year row opens the window with that year chosen: "2021 only · 6 photos". The title names the date and how long ago, the photos are from that year only, and By year is grayed.
- [ ] D2 **Switching.** From the "Photos from" list, change to another year or back to one photo from each year without closing the window.
- [ ] D3 **The picture.** The header says "N photos · X years ago".

## Share with links (#267)

- [ ] E1 **The Share menu.** Share ▾ offers "Picture with links" and "Picture only". With a tag filter showing on On This Day, "Picture with links" is grayed, with a reason.
- [ ] E2 **Picture with links.** Share to Notes or Messages (to yourself): the picture and the text arrive together. The text has one line per year with its count and a link.
- [ ] E3 **The links open.** Click the 2025 link: Flickr's search page shows your photos taken that day. Click a year with a single photo: it opens the photo itself. Open one in a private window (signed out): it shows only the public photos, and does not ask to sign in. (A photo is matched on the date written in its own taken time, so a photo from Japan taken at 2 am local is on the Japan date, the same as On This Day shows.)
- [ ] E4 **Copy ▾ Copy links.** The clipboard has the photo links, a blank line, then the year lines.
- [ ] E5 **Picture only.** Share ▾ Picture only sends just the picture.

## The picture itself

- [ ] F4 **No links on the picture.** No short Flickr links under the photos in any look.
- [ ] F5 **Footer.** The bottom of every picture reads "flickr.com/photos/<your name>" on the left and "Made with FlickrFetch" (Flickr in blue, Fetch in pink; Flickr is white on Gallery and Film) on the right, with room between it and the photos. Check the address opens your Flickr page. Try Story 9:16 and Large (2×).
- [ ] F6 **Not-public line.** One short line above Save, Copy and Share; you are still asked before saving, copying or sharing.

## Not in 3.15

Circle and heart cut-outs, scatter and overlap arrangements (kept for later), a PDF or web page with the pictures inside the share (#267 options), the collage maker for the Timeline or other pages, an "Any photos from the day" source (#308), and a map in the Places box (#305).
