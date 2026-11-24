# Health Check rules: a measured analysis (Nov 23, 2026)

Run on the owner's real library (71,108 photos, 508 albums, 88,800 tags), read-only. Every rule was tested against the owner's own work as the answer key:

- **May belong in an album**: hide 10% of album memberships (8,966), see which rules find them again, and how many false suggestions they make on the other photos.
- **May not fit its album**: move photos into the wrong album (960 random, 956 from a sibling album such as another Budapest district), see what is caught, and how many real members are flagged.
- **Missing tags**: hide one tag from 2,921 photos, see which rules predict it back.
- **Tag and photo checks**: the owner's past decisions ("This one is fine", plan, fixed) where they exist; otherwise counts plus real examples.

"Precision" below is a lower bound wherever extra suggestions might be real gaps the owner never filled.

## What the library offers that the rules did not use

| Signal | How much of the library | Why it matters |
|---|---|---|
| Titles in the form "City - Neighbourhood: Subject" | 48,955 photos with a place in the title; 1,733 distinct places | Of the 1,056 places used on 5+ photos, the typical one has **100%** of its photos in one album; 966 have 90%+ in one album. The titles encode the filing rule. |
| Time of day | 70,315 photos | Photos taken minutes apart ("bursts") are almost always the same place and album. |
| Photos in several albums | 16,142 in two albums, 1,197 in three | Mostly a trip album plus a place album (legitimate); occasionally two place albums that cannot both be right. |

## May belong in an album (missing from album)

| Rule | Found again | Right when it suggests | False-ish per 1,000 other photos |
|---|---|---|---|
| Current rule (date visits + 2 defining tags + area + not already placed) | 61% | 40% | 113 |
| Title place: 75%+ of photos with that "City - Neighbourhood" sit in one album | 48% | 98.8% | 6 |
| Burst neighbours: 80%+ of 3+ photos taken within 30 min and 300 m sit in one album | 67% | 98.7% | 12 |
| **Title place OR burst neighbours** | **74%** | **98.1%** | 16 |
| Title place AND burst neighbours | 40% | 99.8% | 1 |
| Current rule AND (title place OR bursts) | 51% | 99.0% | 1 |

- Burst window: 10, 30 or 120 minutes perform almost the same (precision about 98.5%); 10 minutes has slightly fewer false suggestions (9 vs 12 per 1,000). Distance 300 m vs 1 km makes no difference.
- **Recommendation** (revised after the real-library check below): replace the current rule with title place OR burst neighbours plus three guards; show "both agree" as a stronger tier.

## May not fit its album

Planted misfiles (moved into the wrong album):

| Rule | Catches random misfiles | Catches sibling misfiles (wrong district) | Real members flagged |
|---|---|---|---|
| Current rules (date visits, place spread, tag family) | 90% | 49% | 324 |
| Current rules + **neighbour veto** (keep a flag only if the photo's burst neighbours are not mostly in this album) | 90% | 49% | 199 |
| Burst neighbours mostly in another album | 80% | 82% | 635 |
| Title place filed in another album | 54% | 59% | 418 |
| Any of the three | 98% | 95% | 1,194 |
| Two of the three agree | 83% | 71% | 62 |

Real library, refined "wrong album" rule (the title wins: if it supports this album, nothing overrules it; only neighbourhood-level titles count; only between place albums; only when the two albums do not overlap or are siblings by name, never when one sits inside the other):

- **Wrong album**: about 90 photos, most of a random sample right, for example "Buenos Aires - San Nicolás" photos filed in Monserrat; the NYC FiDi mural filed in SF: Financial District; "National Zoo: African Lion" in Bronx Zoo; "Uxmal: Plataforma de Venus" in Chichén Itzá; a JFK photo in Queens: Astoria instead of Jamaica; "Atlanta - Midtown" in Downtown; "Philadelphia - Center City" in Old City.
- **In two albums that cannot both be right** (areas do not overlap): about 25 to 60, for example Gare du Nord in both Versailles and Paris 10th + 11th; Lyndhurst's Medieval Times in Essex and Bergen County; Nishi-Shinjuku in Shibuya and Shinjuku.
- **Probably also belongs in another album** (one album sits inside the other, or one is a theme): about 400 to 600, for example a Food Porn photo missing from its neighbourhood album. These belong in "May belong", not "May not fit".
- **Place album** (for these rules): at least half its photos have a "City - ..." title and those mostly name one city. Trip, family, person and theme albums (Spring Break 2025, Twins, Shea, Food Porn, Streetart) are not judged by place.
- **The dial**: the strict version flags fewer real members (98) but catches about 30% of planted misfiles; looser versions catch about 75% of sibling misfiles with more noise. This is the setting to calibrate.

## Missing tags (the inverse of album fit)

| Rule | Hidden tags recovered | Right when it suggests | Suggestions per 1,000 photos |
|---|---|---|---|
| Implication: photos with tag A carry tag B 98%+ of the time (brooklyn -> nyc) | 52% | 93% | 41 |
| Burst neighbours: all 3+ neighbours carry the tag | 45% | 89% | 78 |
| Album: tag on 98%+ of the album | 19% | 99% | 15 |
| Title place: tag on 95%+ of photos with the same "City - Neighbourhood" | 29% | 93% | 36 |
| **Two or more agree** | **47%** | **95%** | 38 |
| Three or more agree | 31% | 97.5% | 10 |

- **Recommendation**: a new Tags check, "Photos missing a tag", using two-or-more agreement (about 2,700 suggestions on this library), with the threshold as a setting.

## Tag audit

| Check | Now | Tweak | After | Evidence |
|---|---|---|---|---|
| Names stuck together | 269 | Flag only when every piece is also a tag used on its own on 20+ photos; a tag also typed with the gap is a spelling variant of one tag, not two | 50 | Removes 26 of the owner's 27 "This one is fine" decisions. Kept examples look like real lost commas: HonshūJapan, manhattanNew York, NakagyoKyoto, CaliforniaEmbarcadero. |
| Run-ons | 74 | Skip real dictionary words | 59 | Removes cheesecake and storehouse (both marked fine), coffeehouse, horseshoes. |
| New: same tag in singular and plural | 730 raw pairs | Needs a context filter (the minority form under 5% of the majority, and similar companion tags) | not measured | sculpture 9,263 / sculptures 9; mural 3,956 / murals 25; but queen / queens is the borough. |
| Possible typos | | Idea: confirm with shared companion tags or location | not measured | No owner decisions yet. |

## Photo audit

| New check | Count | Accuracy |
|---|---|---|
| **Location from photos taken minutes apart** (neighbours within 10 min agree within 300 m) | 415 of 2,039 "No location" photos | Hidden-geotag test: within 100 m 89%, within 300 m 99% |
| **Geotag far from the place its title names** (100 km+ and 5x that place's spread) | 15 | Nearly all real: a Kauaʻi luau geotagged 8,383 km away; 7 "NYC - Corning" titles (Corning is upstate) |
| Title prefix from photos taken minutes apart | 8 | 98% right, but few candidates |
| Dropped: place tag far from the geotag | 203 | Mostly subject references, not errors (Legoland replicas, homonyms such as SF "fidi") |

No "This one is fine" decisions exist yet for the photo checks, so their precision is not measured.

## Checked on the real library (second pass)

The tests above measure how well a rule finds what was hidden. On the real library almost nothing is actually missing, so most of what a rule suggests there is the doubtful kind. Precision on the real library is therefore lower than the test precision, and had to be checked by sampling.

**What the app shows today** (the app's own 3.8 code, run against the library, default settings):

- May not fit: 439 photo-album pairs (434 photos, 103 albums); by reason place 259, tag 146, date 45. The 209 noted earlier is out of date.
- May belong: 7,502 photos in 55 albums. 6,897 of them come from 7 subject albums, where the rule suggests every photo carrying the album's main tag: Childhood 2,699; Other Baseball Stadiums 2,000; Weddings 1,065; Streetart 659; Football Stadiums 243; Arenas 124; Food Porn 107.

**May belong, title place OR bursts, on the real library**: 1,744 suggestions in 244 albums. A sample showed three wrong patterns: a burst into a subject or family album (a waterfall shot suggested for "Twins: 6-7 years old"; a restaurant bathroom for Food Porn); a title match into a trip album from another visit (Harrods for Spring Break 2025); and a photo at a neighbourhood boundary that is already in the neighbouring place album (a SoHo photo suggested for Little Italy).

Three guards fix most of it:

1. Never suggest a place album when the photo already sits in a separate place album (areas apart, or siblings by name).
2. A trip or event album only if the photo was taken during one of its visits (14 days either side).
3. The photo must carry the tags nearly every photo in that album has. For a subject album, one of its subject tags.

| Version | Test: found | Test: right | Extra per 1,000 | Real library |
|---|---|---|---|---|
| Title place OR bursts | 74.7% | 98.0% | 14.9 | 1,744 in 244 albums |
| Plus guards 1 and 2, and at least one near-universal tag | 73.9% | 98.3% | 11.1 | 1,217 in 200 albums |
| **Plus guards 1, 2 and 3 (all near-universal tags)** | **72.1%** | **98.5%** | **9.3** | **958 in 149 albums** |

- A sample of 14 from the last version: about 9 right, 1 wrong (a Governors Island road photo suggested for Food Festivals), 4 unclear.
- The best pattern is a photo in a trip, theme or family album that never made it into its place album. Examples: Universal Studios photos in Fall Break 2025 go to Los Angeles: Universal City; Vieux-Montréal photos in Summer Vacation 2026 go to Montréal: Vieux Montréal; a Streetart photo goes to Queens: Astoria.
- Photos in no album: only 6, and the rule finds a home for none of them.

**May not fit, neighbour veto, on the real library**: 439 becomes 283. The veto alone also clears a whole outing filed in the wrong album, because the photos vouch for each other: the National Zoo photos filed in Bronx: Bronx Zoo. So the veto should not apply to a photo far outside the album's area, more than the larger of 10 times its "far" distance and 25 km. With that exception the list is **309**, and the National Zoo flags stay.

- Cleared: LaGuardia's "The Hug" in Spring Break 2025, and Food Porn shots without the usual food tags.

**Missing tags, two or more rules agree, on the real library**:

- 2,861 suggestions on 1,003 photos, covering 610 tags. Mostly the owner's place tags: newyorkcity 107, nyc 107, newyork 89, ny 69, honshu 43, nippon 38, nihon 38, newjersey 36, california 35, manhattan 34.
- A sample of 16 was 16 right, for example a Flushing expressway photo missing nyc, a Nara shrine missing honshu, the Boston Tea Party missing massachusetts.
- It gives nothing to the 176 untagged photos (no tag to go on) and helps only 10 of the 451 one-tag photos.

## Change list

**Albums**

1. May belong: title place OR bursts plus the three guards; "both agree" as a stronger tier. Today 7,502 photos; after, about 960.
2. May not fit: neighbour veto, except for photos far outside the album's area. 439 becomes about 309.
3. May not fit, new reason "wrong neighbourhood album": about 90.
4. May not fit, new reason "in two albums that cannot both be right": about 25 to 60.

**Tags**

5. Names stuck together: every piece must be a tag you use on its own. 269 becomes 50.
6. Run-ons: skip real words, using the word list the app already ships. 74 becomes 59.
7. New check, photos missing a tag (two or more agree). 2,861 suggestions; one row per tag, with the batch editor.
8. New check, singular and plural (needs a context filter; not measured).

**Photos**

9. No location: a suggested spot from photos taken within 10 minutes. 415 of 2,039.
10. No title or a camera-file title: a suggested title start from photos taken minutes apart. 8 photos.
11. New check, far from the place its title names. 15 photos.

Each rule's numbers become settings with live counts, like the Album fit numbers, so they can be calibrated.

Lab scripts (not part of the app): ff_lab.py, exp_belong.py, exp_misfit*.py, exp_burst.py, exp_missing_tags.py, exp_tag_audit.py, exp_photo_audit.py in the session scratchpad.
