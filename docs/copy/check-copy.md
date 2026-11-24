# Health Check copy: all 39 checks (draft for review, issue #221)

Nothing here is in the app yet. Read it whenever you like; say "approved" or mark what you want changed.

## The format

- **Description** (always visible above the list): one line, about 90 characters at most. It says what the list shows, not how it decides.
- **(i) note** (on hover): short rules, one per line. A summary line, then "Flagged when", then "Left alone / cleared when" where it applies, then a pointer to Tune checks if it has numbers there. Real numbers stay in.
- Units always named (photos, albums, tags). Same headings in the same order on every tab.

Decided (owner, 23 Nov 2026):
1. **Example lines are dropped** from the lists. They stay in Tune checks only.
2. **"May belong in an album" is renamed "May be missing from an album"**, everywhere it appears (list rail, summary, Tune checks, tooltips, export, UAT).

---

## Tags (14)

### Names stuck together (`tags:glued`)
- **Description:** A lowercase letter runs into a capital, like NewYork: probably two tags stuck together.
- **(i)**
  - Looks at tags used on 25 photos or fewer.
  - **Flagged when**
    - a word of 8 or more letters has a lowercase letter running straight into a capital, and that exact word is in at most 2 of your tags
    - every piece is at least 3 letters and is not a name prefix such as Mc or Van
    - every piece is also a tag you use on its own on at least 20 photos
  - **Left alone when**
    - the tag is also typed with the gap (that is a spelling variant, not two tags run together)
  - The rarest come first.

### Possible typos (`tags:typo`)
- **Description:** Rare tags that look like a misspelling of a common one, like Pairis for Paris.
- **(i)**
  - Looks at tags used on 2 photos or fewer, with 6 or more letters.
  - **Flagged when**
    - a popular tag (10 or more photos, and at least 8 times as many as this one) is one edit away: a letter added, dropped, changed or swapped
    - only one word differs; the odd word is not a dictionary word and is in at most 2 of your tags; the right word is in at least 5
  - **Left alone when**
    - the difference is only a plural or an accent

### Odd characters (`tags:junk`)
- **Description:** Tags with stray punctuation, symbols or invisible characters.
- **(i)**
  - **Flagged when a spelling of the tag has**
    - garbled characters
    - web code such as &amp;
    - a stray quotation mark
    - a # sign at either end
    - punctuation at the start
    - punctuation at the end (: ; , - / \)
    - no letters or digits at all

### Run-ons (`tags:runon`)
- **Description:** Very long tags that are probably several tags run together.
- **(i)**
  - Looks at tags of 10 or more characters, made only of letters and digits and used on 12 photos or fewer.
  - **Flagged when**
    - the tag can be cut into two or more of your popular tags (each used on 30 or more photos, at least 2 characters long)
  - **Left alone when**
    - the tag is a real dictionary word, such as cheesecake

### Accented tags with no plain twin (`tags:notwin`)
- **Description:** Accented tags with no plain spelling beside them, which Flickr search cannot find.
- **(i)**
  - **Flagged when**
    - a tag has accents (Kantō) and you have no tag for the plain spelling (Kanto)
  - High confidence when the tag is on 20 or more photos.
  - Why: Flickr search cannot find accented tags, so a plain twin helps people find the photos.

### Plain tags that may need accents (`tags:noaccent`)
- **Description:** Plain tags whose accented spelling you use elsewhere, like cafe and café.
- **(i)**
  - **Flagged when**
    - another spelling of the same word with accents is used by at least 2 of your tags, and by at least as many as the plain spelling
  - Strong when the accented spelling is in 5 or more tags and at least 3 times as many as the plain one.

### Typed more than one way (`tags:spelling`)
- **Description:** The same tag typed in different spellings, like Québec and Quebec.
- **(i)**
  - **Flagged when**
    - the same tag differs in capitals, spacing or punctuation
  - Flickr treats them as one tag, but each photo keeps the spelling it was typed with.
  - Low confidence when only capital letters differ.

### Possessive on its own (`tags:possessive`)
- **Description:** One-word possessive tags like Cliff's, which usually need the plain name or a second word.
- **(i)**
  - Looks at tags written as one word ending in 's.
  - **Flagged when**
    - it is a one-word possessive and fewer than 30% of its photos carry a venue tag (restaurant, bar, pub, cafe, store, shop, hotel, food, pizza and similar)
  - The plain name is offered as the starting point to edit; 1980's is offered as 1980s.
  - **Left alone when**
    - the tag has two or more words (Del Frisco's, St. John's)
    - at least 30% of its photos carry a venue tag, because it is a place name (McDonald's, Joe's)

### Singular and plural (`tags:plural`)
- **Description:** The rare form of a singular and plural pair, like alleys beside alley.
- **(i)**
  - **Flagged when**
    - the rarer tag is on at most 5% as many photos as the other
    - the two are never on the same photo
    - at least half of the rarer tag's 8 most common companion tags also go with the other one
  - The rarer tag is the row; the other one is the suggested replacement.
  - **Left alone when**
    - you typed both on one photo (you meant both)
    - the company differs, which means a different word (queen and queens)

### Photos missing a tag (`tags:missing`)
- **Description:** A tag that similar photos carry but some photos lack. Suggestions only.
- **(i)**
  - A tag is suggested for a photo when at least 2 of 5 clues agree (the number is in Tune checks):
    - 1: a tag the photo carries nearly always comes with it (98% or more; both tags on 20 or more photos)
    - 2: an album of 30 or more photos it is in, where 95% or more of the photos have the tag
    - 3: the place its title starts with (used on 10 or more photos), where 95% or more have the tag
    - 4: every one of at least 3 photos taken within 30 minutes and 300 m of it has the tag
    - 5: its title contains the name of the tag, for tags of two or more words used on 20 or more photos
  - Machine tags are never suggested.
  - A row is one tag; it is High when half or more of its photos have three or more clues.

### Tags used only once (`tags:usedonce`)
- **Description:** Tags that sit on a single photo. Often a typo; sometimes a real name.
- **(i)**
  - **Flagged when**
    - a tag is on exactly one photo
  - **Left alone when**
    - it is a machine tag (with a colon)

### Generic tags (`tags:generic`)
- **Description:** Words that say nothing about the photo, like photo, camera or iphone. The list is yours.
- **(i)**
  - **Flagged when**
    - a tag matches a word on your list in Tune checks
  - A word ending in * matches anything that starts that way (iphone* also flags iphone12).

### Numbers only (`tags:numbers`)
- **Description:** Tags made only of digits that are not a year.
- **(i)**
  - **Flagged when**
    - a tag is only digits
  - **Left alone when**
    - it is a year from 1900 to 2099

### File-name tags (`tags:filename`)
- **Description:** Tags that are camera file names or date-and-time stamps, like IMG_1234.
- **(i)**
  - **Flagged when**
    - a tag looks like a camera or phone file name (IMG_1234, DSC01234, 20240315_101500) or a date-and-time stamp
  - **Left alone when**
    - it could be a real word followed by digits (image2013, p900, mov1080)

---

## Photos (17)

### No title, or a camera-file title (`photos:title`)
- **Description:** Photos with no title, or a camera-file title like IMG_1234.
- **(i)**
  - **Flagged when**
    - the title is empty, or looks like a camera file name: IMG_1234, DSC01234, GOPR3893, a date-and-time stamp, "Photo on ..." or "Screenshot ..."
  - Each row also suggests how the title could start, when at least 2 photos taken within 10 minutes of it start with a place and at least 80% of them agree.

### No description (`photos:description`)
- **Description:** Photos with an empty description.
- **(i)**
  - **Flagged when**
    - the description box is empty

### No tags (`photos:tags`)
- **Description:** Photos that carry no tags.
- **(i)**
  - **Flagged when**
    - the photo has no tags
  - Flickr's photo list sometimes leaves tags out, so every photo that looks untagged is double-checked with Flickr before it is listed.

### Only one tag (`photos:tagsOne`)
- **Description:** Photos with a single tag, which usually means they are under-described.
- **(i)**
  - **Flagged when**
    - the photo has exactly one tag

### No location (`photos:location`)
- **Description:** Photos with no place on the map.
- **(i)**
  - **Flagged when**
    - Flickr has no location for the photo
  - Each row also suggests a spot when at least 2 geotagged photos taken within 10 minutes of it (with a real time, not exactly midnight) are within 300 m of each other. The numbers are in Tune checks.
  - You still add the location in Flickr.

### Taken in the future (`photos:dateFuture`)
- **Description:** Photos dated later than today, usually a camera clock set wrong.
- **(i)**
  - **Flagged when**
    - the day the photo was taken is later than today

### Taken after it was uploaded (`photos:dateAfterUpload`)
- **Description:** Photos taken on a later day than they were uploaded, which cannot be right.
- **(i)**
  - **Flagged when**
    - the day taken is later than the day uploaded
  - Compared by day, so time zones cannot cause a false alarm.
  - Needs a Rebuild to know its answer.

### Placeholder date (`photos:datePlaceholder`)
- **Description:** Photos with an unknown or fallback date, like 1 January 1970.
- **(i)**
  - **Flagged when**
    - Flickr marks the date as unknown
    - the day is 1 January 1970, 1904, 1980, 2000 or 1900
    - the year is before 1900
  - Needs a Rebuild to know its answer.

### Description is only a link (`photos:descLink`)
- **Description:** Descriptions that are only a web address.
- **(i)**
  - **Flagged when**
    - once any code is removed, the description is only a web address (starting http, https or www)

### Description copies the title (`photos:descCopy`)
- **Description:** Descriptions that repeat the title word for word.
- **(i)**
  - **Flagged when**
    - the description is the same as the title, ignoring capitals, spacing and punctuation at the end (after web code such as &amp; is decoded)

### Description is only code (`photos:descMarkup`)
- **Description:** Descriptions that hold only code, like empty line breaks.
- **(i)**
  - **Flagged when**
    - the description contains HTML but nothing readable, such as empty line breaks or paragraphs
  - **Left alone when**
    - it has a picture on its own (that counts as content)

### Description is a list of tags (`photos:descTags`)
- **Description:** Descriptions that are just a list of the photo's own tags.
- **(i)**
  - **Flagged when**
    - the description has at least 3 short words and no sentences
    - at least 70% of the words are tags the photo already has

### Located at 0, 0 (`photos:locNull`)
- **Description:** Locations set to exactly 0, 0, usually a failed lookup.
- **(i)**
  - **Flagged when**
    - Flickr reports no usable location, yet recorded an accuracy, which is what a failed lookup that put the photo at exactly 0, 0 looks like

### Far from nearby photos (`photos:locFar`)
- **Description:** A photo far from the photos taken just before and after it.
- **(i)**
  - **Flagged when**
    - the photos just before and just after it (each within an hour) are within 5 km of each other
    - this photo is more than 50 km from both
  - **Left alone when**
    - the photo is timed exactly at midnight, because scans of old prints carry a made-up time

### Far from the place its title names (`photos:locTitle`)
- **Description:** Photos geotagged far from the place their title names.
- **(i)**
  - Needs titles that start with a place. Used only when enough of yours do (see Tune checks).
  - **Flagged when**
    - for each city named in titles with at least 10 geotagged photos, the middle of those photos is found, along with how far 90% of them lie from it
    - the photo is more than 5 times that distance, and at least 100 km, from the middle

### Possible duplicates (`photos:duplicates`)
- **Description:** Photos with the same time taken, to the second, uploaded at different times.
- **(i)**
  - **Flagged when**
    - photos share the same date taken, down to the second
    - their upload times are at least 10 minutes apart (a number in Tune checks)
  - **Left alone when**
    - a burst was uploaded together
    - the time is exactly midnight (scans carry a made-up time)
  - Titles play no part in deciding.
  - Not duplicates marks every photo in the group as fine. FlickrFetch deletes nothing.

### Too many tags (`photos:tagsMany`)
- **Description:** Photos with more tags than your limit (65 unless you change it).
- **(i)**
  - **Flagged when**
    - the photo has at least as many tags as your limit
  - Flickr stops at 75, so a photo near the limit has no room left.

---

## Albums (8)

### Photos in no album (`albums:noAlbum`)
- **Description:** Photos that are in no album. Every photo should have a home.
- **(i)**
  - **Flagged when**
    - the photo is in none of your albums

### Empty albums (`albums:empty`)
- **Description:** Albums with no photos in them.
- **(i)**
  - **Flagged when**
    - the album holds no photos

### Albums in no collection (`albums:noCollection`)
- **Description:** Albums that sit outside every collection.
- **(i)**
  - **Flagged when**
    - the album is not inside any collection
  - Only checked when you use collections at all.

### Albums with one photo (`albums:oneItem`)
- **Description:** Albums that hold a single photo.
- **(i)**
  - **Flagged when**
    - the album holds exactly one photo

### Albums with no description (`albums:noDesc`)
- **Description:** Albums whose description box is empty.
- **(i)**
  - **Flagged when**
    - the album's description is blank

### Albums with the same title (`albums:dupTitle`)
- **Description:** Albums that share a title, so they are hard to tell apart.
- **(i)**
  - **Flagged when**
    - two or more albums have the same title, ignoring capitals and spaces at the ends

### May not fit its album (`albums:misfit`)
- **Description:** Photos that look out of place in their album: wrong time, wrong place, or filed under another place.
- **(i)** (the approved model)
  - Each album with 30 or more photos (10 if you chose its kind) is judged by what it is organised by.
  - **How an album is sorted**
    - Date: 95% of its photos sit in up to 4 visits (runs of 5 or more photos, less than 45 days apart)
    - Place: otherwise, most photos are within 25 km of its middle
    - Tag: otherwise, one tag is on half the album and much rarer elsewhere
    - Anything else is left alone
  - **A photo is flagged when**
    - Date: it sits on its own (a run of 2 or fewer), away from every visit, unless it is a return visit inside an away-from-home album's area
    - Place: it is further from the middle than 2.5 times the album's own spread, and at least 0.5 km more
    - Tag: it has none of the album's distinctive tags, while 95% of the photos do
    - Wrong place: it is filed in a different place's album, going by its "City - Neighbourhood" title or the photos beside it
    - Two places: it is in two place albums for different places
  - **A flag is cleared when**
    - at least half of 3 or more photos taken within 30 minutes and 300 m are in the same album, unless the photo is very far away
  - **The two place reasons only apply when**
    - both albums are place albums (at least half the photos have a title place, and 80% of those name one city)
    - their areas do not overlap, or they are sibling districts by name, never when one lies inside the other
    - the title wins when it supports the album the photo is in
  - The numbers are in Tune checks.

### May be missing from an album (`albums:missing`, was "May belong in an album")
- **Description:** Photos that may be missing from an album. Suggestions only; nothing is added for you.
- **(i)**
  - **A photo is suggested for an album it is not in when**
    - the place its title starts with is used on 5 or more photos, and 75% or more of them are in that album, or
    - 80% or more of at least 3 photos taken within 30 minutes and 300 m of it are in that album
  - **Guards**
    - not when the photo already sits in a separate neighbourhood album
    - a trip or event album only gets photos taken during one of its visits (14 days either side)
    - the photo must carry the tags nearly every photo in the album has (for a subject album, one of its subject tags)
  - Only albums that are judged (30 or more photos, not left alone). Titles are used only when enough of yours start with a place.
  - The numbers are in Tune checks.

---

## Still open (from the session)

- Button labels (Open photo, Batch editor, Open album to edit, This one is fine): wording to settle with the design pass (#219).
- "Organised by" label: proposed "Judge this album by", plus a one-line explanation (finding 25).

## Added after testing
- Each Tags check's (i) note now ends with a "Confidence" section saying exactly when a row is High, Medium or Low (the same marks you see on the rows). The Tags lists now use these same descriptions (they had a second copy of the text that the first pass missed).
- The grey second line under each Tags row is now shown only where it differs per row: Odd characters, Typed more than one way, Singular and plural, Photos missing a tag.
