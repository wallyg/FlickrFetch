# UAT 3.7 — Album Checks (in progress; fix pass for the No tags false positives built)

Needs one Rebuild first (Health Check, data button, Rebuild; about 5 to 7 minutes). The Rebuild now also reads every album and which photo is in which album (about 350 Flickr calls for 200 albums). Until then the Albums tab asks for the Rebuild.

## Before the Rebuild
A1. Health Check shows the upgrade notice ("FlickrFetch has been updated since you last rebuilt your local library list... some checks stay empty until you rebuild") with Rebuild and Not now. Not now hides it on every tab until you reopen the app.
A2. The Albums tab says "Your albums have not been read yet" with a Rebuild button.

## The Rebuild
B1. The progress card reads "Reading photos…", then "Reading albums… 37 of 200". Cancel works at any point; a cancel during the album step keeps the photos and tags that were already saved.
B2. When it finishes, the notice goes away and the Albums tab fills in.

## Albums tab (Health Check: Overview, Tags, Photos, Albums, Backup)
C1. Summary: a card with how many albums and photos, and how many photos are in no album; a tile for each check that is not Off, each opening its list.
C2. Lists: the left column has Issues (Photos in no album, Empty albums) and Warnings (Albums in no collection, Albums with one photo, Albums with no description, Albums with the same title), each with a count; then Show (Open / Marked fine), Filter, and This list.
C3. Photos in no album shows photo cards (title, date taken, Open on Flickr, This one is fine). Albums lists show album cards (cover, title, "12 photos · created Mar 2019", plus the reason).
C4. Sort sits at the right end of the description line: Newest / Oldest (taken for photos, created for albums), Title A to Z, Title Z to A.
C5. Filter by title works; Cmd+F jumps to the Filter box while Albums lists are showing.
C6. "Export this list" saves a spreadsheet of the whole list. Photos in no album also has "Fix in Flickr's batch editor": press it and Flickr's editor opens with those photos (500 at a time); add them to an album there.
C7. "This one is fine" removes a row and counts it under Marked fine; Undo brings it back.
C8. Albums in no collection is skipped when you have no collections at all (otherwise it would flag every album).
C9. Tune checks has an Albums group with the six checks, each Off / Warning / Issue, with counts. Photos in no album and Empty albums start as Issues.

## Keeping it current
D1. Fix something on Flickr (for example put a photo in an album, or delete an empty album) and press Update on the toolbar: after it finishes, the counts follow. Update only re-reads albums whose photo count or last-update time changed.
D2. If a photo you added to an album does not leave the list after Update, tell me: it means Flickr did not change that album's update time and the check needs a different trigger.

## No tags false positives (found in UAT)
E1. Flickr's photo list sometimes returns no tags for a photo that has them. The next Update (and every Rebuild) now asks Flickr about each photo that looks untagged, one by one, before listing it under No tags. The first Update after installing 3.7 does this for all of them (about 200 calls, a minute or two).
E2. In testing, No tags went from 202 to 176 and Bansky's Basquiat Murals (9 tags) left the list. Photos that really have no tags (the Hawkins VHS images, screenshots) stay on it.
E3. Photos rescued this way also show up in the Tags tab with the right counts.
