# UAT 3.15 (Collage and Sharing)

How to run it: `npm run dev` from the project folder. Restart it once (stop it, run it again) because Share now sends text, which is a main-process change. Open On This Day for a day with photos in several years (November 27 has 26 photos over 7 years). Tick each line as you go and send everything in one batch.

## How many photos (#294)

- [ ] A1 **More than six.** Open the collage maker (Collage… on On This Day). The "up to" number says 8 for Matched, Paper, Gallery and Film, and 6 for Polaroid. Press + up to the limit: eight photos show, none tiny.
- [ ] A2 **Fewer for some looks.** Choose Row: the limit drops (six). Choose Grid, Feature, Banner or Mosaic: eight. The text says "for this look" when the number is lower than it could be.
- [ ] A3 **More photos than years.** On a day with 5 years, press + past 5: the extra photos come from the busiest years.
- [ ] A4 **Shapes.** Try Square, Story and Wide at 8 photos: the limit changes if a photo would get too small, and nothing overlaps.

## New arrangements (#144)

- [ ] B1 **Mosaic.** Tiles of different sizes that fill the picture with no gaps, for 2 to 8 photos. The big tile moves around (it is not always on the left), so it no longer looks like Feature.
- [ ] B2 **By year.** Photos grouped under a heading for each year, newest first, with no year tabs on the photos. With photos from one year only, the chip is grayed and says why.
- [ ] B3 **The list.** Grid, Mosaic, Feature, Banner, Row, Column, By year, in three rows, each chip with a small drawing of the arrangement for your photos and shape. (Filmstrip is gone.) Point at a chip for one line about it. With one photo the list is hidden.
- [ ] B4 **Grayed chips.** Feature and Banner are grayed below 3 photos. In Square and Wide, Column (same as Row) and Banner (same as Feature) are grayed; in Story, Row (same as Column). Each says why, under the chips and on hover. In Auto, none of those are grayed.

## Swap, replace, crop (#143, #270)

- [ ] C1 **Replace.** Click a small photo in the strip: a box opens with other photos from that day (none already in the picture). Pick one, "Use this one": it takes the place. Cancel closes it.
- [ ] C2 **Swap.** Drag one small photo onto another: they trade places in the picture.
- [ ] C3 **Move and zoom.** Click a photo in the picture: a pink outline and a small bar appear. Drag the photo to move it; the Zoom slider zooms (100 to 400%); Reset puts it back; Done closes the bar. Try it in a Polaroid too.
- [ ] C4 **Saved.** Save image…, Copy image: the crop and the swaps are in the saved picture, and the pink outline is not.
- [ ] C5 **Shuffle.** Shuffle starts a fresh set (your swaps are cleared); your crops stay with their photos.

## One year (#164)

- [ ] D1 **Button.** Each year row on On This Day has "Collage from these N" (not shown for a year with fewer than two photos).
- [ ] D2 **The window.** The title names the date and how long ago. Photos are from that year only; Shuffle picks a different few; Year ladder is grayed.
- [ ] D3 **The picture.** The header says "N photos · X years ago".

## Share with links (#267)

- [ ] E1 **The Share menu.** Share ▾ offers "Picture with links" and "Picture only". With a tag filter showing on On This Day, "Picture with links" is grayed, with a reason.
- [ ] E2 **Picture with links.** Share to Notes or Messages (to yourself): the picture and the text arrive together. The text has one line per year with its count and a link.
- [ ] E3 **The links open.** Click the 2025 link: Flickr's search page shows your photos taken that day. Click a year with a single photo: it opens the photo itself. Open one in a private window (signed out): it shows only the public photos, and does not ask to sign in. (Flickr's own archive day pages need a sign-in, and send you to the Camera Roll, so the links use Flickr's search page instead. I checked it signed out against a public account, with a date range, and it filtered correctly. A photo is matched on the date written in its own taken time, so a photo from Japan taken at 2 am local is on the Japan date, the same as On This Day shows. I tested this on a real photo: it was found only in the window that matches its written time, not in windows shifted by any timezone.)
- [ ] E4 **Copy ▾ Copy links.** The clipboard has the photo links, a blank line, then the year lines.
- [ ] E5 **Picture only.** Share ▾ Picture only sends just the picture.

## Changes after the first test (fix pass)

- [ ] F1 **Bigger thumbnails.** The small photos under Photos are about 60 px. Point at one: a larger picture with its year appears beside it. Dragging one onto another still swaps them.
- [ ] F2 **One row of buttons.** At the bottom of the left panel: Save, Copy ▾ and Share ▾ in one row, each with a small icon. Copy ▾ has Copy image and Copy links. Save, Copy image and Share all still work, and the privacy question still comes first when a photo is not public.
- [ ] F3 **Hint.** Under Shuffle: "Shuffle picks one photo from each year. To choose your own, tick photos on the page first." (shown when you have not ticked photos).
- [ ] F4 **No links on the picture.** No short Flickr links under the photos in any look (Polaroid, Matched, Paper, Gallery, Film), and no Extras section.
- [ ] F5 **Footer.** The bottom of every picture reads "flickr.com/photos/<your name>" on the left and "Made with FlickrFetch" (Flickr in blue, Fetch in pink; Flickr is white on Gallery and Film) on the right. The old "Created with" block at the top right is gone. Check the address opens your Flickr page. Try a tall shape (Story 9:16) and Large (2×).
- [ ] F6 **Scroll hint.** A soft fade and a "More below" button show at the bottom of the left panel while there is more to scroll to; the button scrolls down and both go away at the bottom. The not-public warning is one short line.
- [ ] F7 **Looks and shapes.** Matched is now called Tinted (point at it, and at each look, for a one-line note). The shape chips read Auto, 1:1, 4:5, 9:16, 16:9 on one row, and the notes under Look and Shape are shorter.
- [ ] F8 **Footer space.** There is more room between the photos and the footer line in every look.

## Not in 3.15

Circle and heart cut-outs, scatter and overlap arrangements (kept for later), a PDF or web page with the pictures inside the share (#267 options), the collage maker for the Timeline or other pages.
