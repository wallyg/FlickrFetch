// The checks in the Cleanup tab, and how each one is treated.
//   on        Issue: shown as a problem that needs attention and counted in the score
//   optional  Warning: shown, but never lowers the score
//   off       not shown and not counted anywhere
// The user's choices are saved in the app settings (cleanupRules); anything not chosen uses the default here.

export type CleanupRuleState = 'off' | 'optional' | 'on'
export type CleanupReport = 'tags' | 'photos' | 'albums'

export interface CleanupRule {
  id: string                 // 'tags:<audit category>' or 'photos:<health condition>'
  report: CleanupReport
  name: string
  blurb: string
  phrase?: string            // the problem in a few words, for sentences like "2019: no tags"
  kind?: string              // the small label on a photo in the list
  list?: { key: 'auditGenericWords'; label: string; help: string }   // a list of words this check lets you change
  number?: { key: 'healthTagLimit'; label: string; min: number; max: number; def: number }   // a number this check lets you change
  needsRebuild?: boolean     // only knows its answer after the 3.6 Rebuild (it reads details older library lists did not keep)
  defaultState: CleanupRuleState
}

export const CLEANUP_RULES: CleanupRule[] = [
  { id: 'tags:glued', report: 'tags', name: 'Names stuck together', blurb: 'Capital letters run together with no gap, like NewYork: probably two tags stuck together.', defaultState: 'on' },
  { id: 'tags:typo', report: 'tags', name: 'Possible typos', blurb: 'Rare tags that look like a misspelling of a common one, like Pairis for Paris.', defaultState: 'optional' },
  { id: 'tags:junk', report: 'tags', name: 'Odd characters', blurb: 'Tags with stray punctuation, symbols or invisible characters.', defaultState: 'on' },
  { id: 'tags:runon', report: 'tags', name: 'Run-ons', blurb: 'All lowercase with no gaps, like newyorkskyline: probably several tags run together.', defaultState: 'on' },
  { id: 'tags:notwin', report: 'tags', name: 'Accented tags with no plain twin', blurb: 'Accented tags with no plain spelling beside them, which Flickr search cannot find.', defaultState: 'optional' },
  { id: 'tags:noaccent', report: 'tags', name: 'Plain tags that may need accents', blurb: 'Plain tags whose accented spelling you use elsewhere, like cafe and café.', defaultState: 'optional' },
  { id: 'tags:spelling', report: 'tags', name: 'Typed more than one way', blurb: 'The same tag typed in different spellings, like Québec and Quebec.', defaultState: 'optional' },
  { id: 'tags:possessive', report: 'tags', name: 'Possessive on its own', blurb: 'One-word possessive tags like Cliff\'s, which usually need the plain name or a second word.', defaultState: 'optional' },
  { id: 'tags:plural', report: 'tags', name: 'Singular and plural', blurb: 'The rare form of a singular and plural pair, like alleys beside alley.', defaultState: 'optional' },
  { id: 'tags:missing', report: 'tags', name: 'Photos missing a tag', blurb: 'A tag that similar photos carry but some photos lack. Suggestions only.', defaultState: 'optional' },
  { id: 'tags:usedonce', report: 'tags', name: 'Tags used only once', blurb: 'Tags that sit on a single photo. Often a typo; sometimes a real name.', defaultState: 'off' },
  { id: 'tags:generic', report: 'tags', name: 'Generic tags', blurb: 'Words that say nothing about the photo, like photo, camera or iphone. The list is yours.', list: { key: 'auditGenericWords', label: 'Words to flag', help: 'One per line. End a word with * to match anything that starts that way (iphone* also flags iphone12).' }, defaultState: 'optional' },
  { id: 'tags:numbers', report: 'tags', name: 'Numbers only', blurb: 'Tags made only of digits that are not a year.', defaultState: 'optional' },
  { id: 'tags:filename', report: 'tags', name: 'File-name tags', blurb: 'Tags that are camera file names or date-and-time stamps, like IMG_1234.', defaultState: 'optional' },
  { id: 'photos:title', report: 'photos', name: 'No title, or a camera-file title', blurb: 'Photos with no title, or a camera-file title like IMG_1234.', phrase: 'no title or a camera-file title', defaultState: 'on' },
  { id: 'photos:description', report: 'photos', name: 'No description', blurb: 'Photos with an empty description.', phrase: 'no description', defaultState: 'optional' },
  { id: 'photos:tags', report: 'photos', name: 'No tags', blurb: 'Photos that carry no tags.', phrase: 'no tags', defaultState: 'on' },
  { id: 'photos:tagsOne', report: 'photos', name: 'Only one tag', blurb: 'Photos with a single tag, which usually means they are under-described.', phrase: 'only one tag', kind: 'Only one tag', defaultState: 'optional' },
  { id: 'photos:location', report: 'photos', name: 'No location', blurb: 'Photos with no place on the map.', phrase: 'no location', defaultState: 'optional' },
  { id: 'photos:dateFuture', report: 'photos', name: 'Taken in the future', blurb: 'Photos dated later than today, usually a camera clock set wrong.', phrase: 'a date in the future', kind: 'Future date', defaultState: 'on' },
  { id: 'photos:dateAfterUpload', report: 'photos', needsRebuild: true, name: 'Taken after it was uploaded', blurb: 'Photos taken on a later day than they were uploaded, which cannot be right.', phrase: 'taken after it was uploaded', kind: 'Taken after upload', defaultState: 'on' },
  { id: 'photos:datePlaceholder', report: 'photos', needsRebuild: true, name: 'Placeholder date', blurb: 'Photos with an unknown or fallback date, like 1 January 1970.', phrase: 'a placeholder date', kind: 'Placeholder date', defaultState: 'optional' },
  { id: 'photos:descLink', report: 'photos', needsRebuild: true, name: 'Description is only a link', blurb: 'Descriptions that are only a web address.', phrase: 'a description that is only a link', kind: 'Only a link', defaultState: 'on' },
  { id: 'photos:descCopy', report: 'photos', needsRebuild: true, name: 'Description copies the title', blurb: 'Descriptions that repeat the title word for word.', phrase: 'a description that copies the title', kind: 'Copies the title', defaultState: 'on' },
  { id: 'photos:descMarkup', report: 'photos', needsRebuild: true, name: 'Description is only code', blurb: 'Descriptions that hold only code, like empty line breaks.', phrase: 'a description with only code', kind: 'Only code', defaultState: 'on' },
  { id: 'photos:descTags', report: 'photos', needsRebuild: true, name: 'Description is a list of tags', blurb: 'Descriptions that are just a list of the photo\'s own tags.', phrase: 'a description that is a list of tags', kind: 'List of tags', defaultState: 'optional' },
  { id: 'photos:locNull', report: 'photos', needsRebuild: true, name: 'Located at 0, 0', blurb: 'Locations set to exactly 0, 0, usually a failed lookup.', phrase: 'a location at 0, 0', kind: 'At 0, 0', defaultState: 'on' },
  { id: 'photos:locFar', report: 'photos', name: 'Far from nearby photos', blurb: 'A photo far from the photos taken just before and after it.', phrase: 'a location far from nearby photos', kind: 'Far from neighbours', defaultState: 'optional' },
  { id: 'albums:noAlbum', report: 'albums', name: 'Photos in no album', blurb: 'Photos that are in no album. Every photo should have a home.', phrase: 'in no album', kind: 'In no album', defaultState: 'on' },
  { id: 'albums:empty', report: 'albums', name: 'Empty albums', blurb: 'Albums with no photos in them.', phrase: 'an empty album', kind: 'Empty', defaultState: 'on' },
  { id: 'albums:noCollection', report: 'albums', name: 'Albums in no collection', blurb: 'Albums that sit outside every collection.', phrase: 'an album in no collection', kind: 'In no collection', defaultState: 'optional' },
  { id: 'albums:oneItem', report: 'albums', name: 'Albums with one photo', blurb: 'Albums that hold a single photo.', phrase: 'a one-photo album', kind: 'One photo', defaultState: 'optional' },
  { id: 'albums:noDesc', report: 'albums', name: 'Albums with no description', blurb: 'Albums whose description box is empty.', phrase: 'an album with no description', kind: 'No description', defaultState: 'optional' },
  { id: 'albums:dupTitle', report: 'albums', name: 'Albums with the same title', blurb: 'Albums that share a title, so they are hard to tell apart.', phrase: 'albums with the same title', kind: 'Same title', defaultState: 'optional' },
  { id: 'albums:misfit', report: 'albums', name: 'May not fit its album', blurb: 'Photos that look out of place in their album: wrong time, wrong place, or filed under another place.', phrase: 'a photo that may not fit its album', kind: 'May not fit', defaultState: 'optional' },
  { id: 'albums:missing', report: 'albums', name: 'May be missing from an album', blurb: 'Photos that may be missing from an album. Suggestions only; nothing is added for you.', phrase: 'an album that may be missing photos', kind: 'May be missing', defaultState: 'optional' },
  { id: 'photos:locTitle', report: 'photos', name: 'Far from the place its title names', blurb: 'Photos geotagged far from the place their title names.', phrase: 'a location far from the place its title names', kind: 'Far from title place', defaultState: 'optional' },
  { id: 'photos:duplicates', report: 'photos', name: 'Possible duplicates', blurb: 'Photos with the same time taken, to the second, uploaded at different times.', phrase: 'possible duplicates', kind: 'Possible duplicate', defaultState: 'optional' },
  { id: 'photos:tagsMany', report: 'photos', name: 'Too many tags', blurb: 'Photos with more tags than your limit (65 unless you change it).', phrase: 'too many tags', kind: 'Too many tags', number: { key: 'healthTagLimit', label: 'Flag photos with at least this many tags', min: 2, max: 75, def: 65 }, defaultState: 'optional' }
]

// The generic words flagged until you change the list (a trailing * matches anything that starts that way)
export const DEFAULT_GENERIC_WORDS = ['photo', 'photos', 'picture', 'pictures', 'image', 'images', 'pic', 'pics', 'snapshot', 'camera', 'phone', 'cellphone', 'iphone*', 'ipad*', 'android', 'dslr', 'canon', 'nikon', 'sony', 'gopro', 'digital', 'instagram', 'iphoneography', 'square', 'squareformat', 'flickr']

export type CleanupRuleSettings = Record<string, CleanupRuleState>

export const ruleById = (id: string): CleanupRule | undefined => CLEANUP_RULES.find(r => r.id === id)

export function ruleState(settings: CleanupRuleSettings | undefined, id: string): CleanupRuleState {
  const chosen = settings?.[id]
  if (chosen === 'off' || chosen === 'optional' || chosen === 'on') return chosen
  return CLEANUP_RULES.find(r => r.id === id)?.defaultState ?? 'on'
}

// How each check decides, as short rules (shown as a tooltip on the check's name in Tune checks and in the lists, and inline on a Tune checks card).
// "# " starts a heading and "- " a bullet (see ui/RichNote.tsx). The numbers are the standard ones; the ones marked "Tune checks" can be changed there.
const RULE_LOGIC: Record<string, string> = {
  'tags:glued': 'Looks at tags used on 25 photos or fewer.\n# Flagged when\n- a word of 8 or more letters has a lowercase letter running straight into a capital, and that exact word is in at most 2 of your tags\n- every piece is at least 3 letters and is not a name prefix such as Mc or Van\n- every piece is also a tag you use on its own on at least 20 photos\n# Left alone when\n- the tag is also typed with the gap (that is a spelling variant, not two tags run together)\nThe rarest come first.\n# How sure it is\n- Very likely when the tag is long (4 or more words, or 30 or more characters) and on 5 photos or fewer\n- Possible otherwise',
  'tags:typo': 'Looks at tags used on 2 photos or fewer, with 6 or more letters.\n# Flagged when\n- a popular tag (10 or more photos, and at least 8 times as many as this one) is one edit away: a letter added, dropped, changed or swapped\n- only one word differs; the odd word is not a dictionary word and is in at most 2 of your tags; the right word is in at least 5\n# Left alone when\n- the difference is only a plural or an accent\n# How sure it is\n- Very likely when the tag is on one photo and the popular tag is on 30 or more\n- Possible otherwise',
  'tags:junk': '# Flagged when a spelling of the tag has\n- garbled characters\n- web code such as &amp;\n- a stray quotation mark\n- a # sign at either end\n- punctuation at the start\n- punctuation at the end (: ; , - / \\)\n- no letters or digits at all',
  'tags:runon': 'Looks at tags of 10 or more characters, made only of letters and digits and used on 12 photos or fewer.\n# Flagged when\n- the tag can be cut into two or more of your popular tags (each used on 30 or more photos, at least 2 characters long)\n# Left alone when\n- the tag is a real dictionary word, such as cheesecake\n# How sure it is\n- Very likely when it splits into 3 or more tags, or the tag is 16 or more characters\n- Possible otherwise',
  'tags:notwin': '# Flagged when\n- a tag has accents (Kantō) and you have no tag for the plain spelling (Kanto)\nWhy: Flickr search cannot find accented tags, so a plain twin helps people find the photos.\n# How sure it is\n- Very likely when the tag is on 20 or more photos\n- Possible otherwise',
  'tags:noaccent': '# Flagged when\n- another spelling of the same word with accents is used by at least 2 of your tags, and by at least as many as the plain spelling\n# How sure it is\n- Very likely when the accented spelling is in 5 or more tags and at least 3 times as many as the plain one, and this tag is on 10 or more photos\n- Possible otherwise',
  'tags:spelling': '# Flagged when\n- the same tag differs in capitals, spacing or punctuation\nFlickr treats them as one tag, but each photo keeps the spelling it was typed with.\n# How sure it is\n- Unlikely when only capital letters differ\n- Possible otherwise',
  'tags:possessive': 'Looks at tags written as one word ending in \'s.\n# Flagged when\n- it is a one-word possessive and fewer than 30% of its photos carry a venue tag (restaurant, bar, pub, cafe, store, shop, hotel, food, pizza and similar)\nThe plain name is offered as the starting point to edit; 1980\'s is offered as 1980s.\n# Left alone when\n- the tag has two or more words (Del Frisco\'s, St. John\'s)\n- at least 30% of its photos carry a venue tag, because it is a place name (McDonald\'s, Joe\'s)\n# How sure it is\n- Very likely when the plain name (Cliff) is already one of your tags\n- Possible otherwise',
  'tags:plural': '# Flagged when\n- the rarer tag is on at most 5% as many photos as the other\n- the two are never on the same photo\n- at least half of the rarer tag\'s 8 most common companion tags also go with the other one\nThe rarer tag is the row; the other one is the suggested replacement.\n# Left alone when\n- you typed both on one photo (you meant both)\n- the company differs, which means a different word (queen and queens)\n# How sure it is\n- Very likely when the rarer tag is on one photo and the other is on 30 or more\n- Possible otherwise',
  'tags:missing': 'A tag is suggested for a photo when at least 2 of 5 clues agree (the number is in Tune checks):\n- 1: a tag the photo carries nearly always comes with it (98% or more; both tags on 20 or more photos)\n- 2: an album of 30 or more photos it is in, where 95% or more of the photos have the tag\n- 3: the place its title starts with (used on 10 or more photos), where 95% or more have the tag\n- 4: every one of at least 3 photos taken within 30 minutes and 300 m of it has the tag\n- 5: its title contains the name of the tag, for tags of two or more words used on 20 or more photos\nA photo can have several clues. Machine tags are never suggested.\n# How sure it is\n- Very likely when half or more of its photos have three or more clues\n- Possible otherwise',
  'tags:usedonce': '# Flagged when\n- a tag is on exactly one photo\n# Left alone when\n- it is a machine tag (with a colon)',
  'tags:generic': '# Flagged when\n- a tag matches a word on your list in Tune checks\nA word ending in * matches anything that starts that way (iphone* also flags iphone12).',
  'tags:numbers': '# Flagged when\n- a tag is only digits\n# Left alone when\n- it is a year from 1900 to 2099',
  'tags:filename': '# Flagged when\n- a tag looks like a camera or phone file name (IMG_1234, DSC01234, 20240315_101500) or a date-and-time stamp\n# Left alone when\n- it could be a real word followed by digits (image2013, p900, mov1080)',
  'photos:title': '# Flagged when\n- the title is empty, or looks like a camera file name: IMG_1234, DSC01234, GOPR3893, a date-and-time stamp, "Photo on ..." or "Screenshot ..."\nEach row also suggests how the title could start, when at least 2 photos taken within 10 minutes of it start with a place and at least 80% of them agree.',
  'photos:description': '# Flagged when\n- the description box is empty',
  'photos:tags': '# Flagged when\n- the photo has no tags\nFlickr\'s photo list sometimes leaves tags out, so every photo that looks untagged is double-checked with Flickr before it is listed.',
  'photos:tagsOne': '# Flagged when\n- the photo has exactly one tag',
  'photos:location': '# Flagged when\n- Flickr has no location for the photo\nEach row also suggests a spot when at least 2 geotagged photos taken within 10 minutes of it (with a real time, not exactly midnight) are within 300 m of each other. The numbers are in Tune checks.\nYou still add the location in Flickr.',
  'photos:dateFuture': '# Flagged when\n- the day the photo was taken is later than today',
  'photos:dateAfterUpload': '# Flagged when\n- the day taken is later than the day uploaded\nCompared by day, so time zones cannot cause a false alarm.\nNeeds a Rebuild to know its answer.',
  'photos:datePlaceholder': '# Flagged when\n- Flickr marks the date as unknown\n- the day is 1 January 1970, 1904, 1980, 2000 or 1900\n- the year is before 1900\nNeeds a Rebuild to know its answer.',
  'photos:descLink': '# Flagged when\n- once any code is removed, the description is only a web address (starting http, https or www)',
  'photos:descCopy': '# Flagged when\n- the description is the same as the title, ignoring capitals, spacing and punctuation at the end (after web code such as &amp; is decoded)',
  'photos:descMarkup': '# Flagged when\n- the description contains HTML code but nothing readable, such as empty line breaks or paragraphs\n# Left alone when\n- it has a picture on its own (that counts as content)',
  'photos:descTags': '# Flagged when\n- the description has at least 3 short words and no sentences\n- at least 70% of the words are tags the photo already has',
  'photos:locNull': '# Flagged when\n- Flickr reports no usable location, yet recorded an accuracy, which is what a failed lookup that put the photo at exactly 0, 0 looks like',
  'photos:locFar': '# Flagged when\n- the photos just before and just after it (each within an hour) are within 5 km of each other\n- this photo is more than 50 km from both\n# Left alone when\n- the photo is timed exactly at midnight, because scans of old prints carry a made-up time',
  'photos:locTitle': 'Needs titles that start with a place. Used only when enough of yours do (see Tune checks).\n# Flagged when\n- for each city named in titles with at least 10 geotagged photos, the middle of those photos is found, along with how far 90% of them lie from it\n- the photo is more than 5 times that distance, and at least 100 km, from the middle',
  'photos:duplicates': '# Flagged when\n- photos share the same date taken, down to the second\n- their upload times are at least 10 minutes apart (a number in Tune checks)\n# Left alone when\n- a burst was uploaded together\n- the time is exactly midnight (scans carry a made-up time)\nTitles play no part in deciding.\nNot duplicates marks every photo in the group as fine. FlickrFetch deletes nothing.',
  'photos:tagsMany': '# Flagged when\n- the photo has at least as many tags as your limit\nFlickr stops at 75, so a photo near the limit has no room left.',
  'albums:noAlbum': '# Flagged when\n- the photo is in none of your albums',
  'albums:empty': '# Flagged when\n- the album holds no photos',
  'albums:noCollection': '# Flagged when\n- the album is not inside any collection\nOnly checked when you use collections at all.',
  'albums:oneItem': '# Flagged when\n- the album holds exactly one photo',
  'albums:noDesc': '# Flagged when\n- the album\'s description is blank',
  'albums:dupTitle': '# Flagged when\n- two or more albums have the same title, ignoring capitals and spaces at the ends',
  'albums:misfit': 'Each album with 30 or more photos (10 if you chose its kind) is judged by what it is organised by.\n# How an album is sorted\n- Date: 95% of its photos sit in up to 4 visits (runs of 5 or more photos, less than 45 days apart)\n- Place: otherwise, most photos are within 25 km of its middle\n- Tag: otherwise, one tag is on half the album and much rarer elsewhere\n- Anything else is left alone\n# A photo is flagged when\n- Date: it sits on its own (a run of 2 or fewer), away from every visit, unless it is a return visit inside an away-from-home album\'s area\n- Place: it is further from the middle than 2.5 times the album\'s own spread, and at least 0.5 km more\n- Tag: it has none of the album\'s distinctive tags, while 95% of the photos do\n- Wrong place: it is filed in a different place\'s album, going by its "City - Neighbourhood" title or the photos beside it\n- Two places: it is in two place albums for different places\n# A flag is cleared when\n- at least half of 3 or more photos taken within 30 minutes and 300 m are in the same album, unless the photo is very far away\n# The two place reasons only apply when\n- both albums are place albums (at least half the photos have a title place, and 80% of those name one city)\n- their areas do not overlap, or they are sibling districts by name, never when one lies inside the other\n- the title wins when it supports the album the photo is in\nThe numbers are in Tune checks.',
  'albums:missing': '# A photo is suggested for an album it is not in when\n- the place its title starts with is used on 5 or more photos, and 75% or more of them are in that album, or\n- 80% or more of at least 3 photos taken within 30 minutes and 300 m of it are in that album\n# Guards\n- not when the photo already sits in a separate neighbourhood album\n- a trip or event album only gets photos taken during one of its visits (14 days either side)\n- the photo must carry the tags nearly every photo in the album has (for a subject album, one of its subject tags)\nOnly albums that are judged (30 or more photos, not left alone). Titles are used only when enough of yours start with a place.\nThe numbers are in Tune checks.'
}
export const logicOf = (id: string): string | undefined => RULE_LOGIC[id]

// The quick reasons offered after "This one is fine", per check (an "Other" box is always there too). The ones that are not listed use the general three.
const GENERAL_REASONS = ['It is correct as it is', 'The check is wrong here', 'Not worth fixing']
const FINE_REASONS: Record<string, string[]> = {
  'albums:misfit': ['A real exception, such as a trip photo', 'This album is meant to be mixed', 'A later visit to the same place', 'It belongs in both albums'],
  'albums:missing': ['It belongs somewhere else', 'This album is complete as it is', 'Not the same kind of photo'],
  'albums:noAlbum': ['It belongs in no album on purpose', 'I will add it later'],
  'tags:glued': ['Spelled that way on purpose', 'It is a real name', 'Two words that belong together'],
  'tags:runon': ['A real word or name', 'Spelled that way on purpose'],
  'tags:possessive': ['It is the name of a place or business', 'Both forms are meant'],
  'tags:typo': ['Not a typo: a real word or name', 'Both tags are meant to exist'],
  'tags:usedonce': ['A real one-off name', 'I will use it again'],
  'tags:generic': ['I want this tag'],
  'tags:missing': ['That tag does not fit these photos', 'The photos were left untagged on purpose', 'Not worth adding'],
  'photos:location': ['No place applies (indoors, a scan, a screenshot)', 'I do not want a location on this one'],
  'photos:locFar': ['The location is right', 'Taken on a trip, so far from its neighbours'],
  'photos:locTitle': ['The location is right', 'The title is wrong, not the location', 'Taken on a trip, titled for home'],
  'photos:duplicates': ['They are different photos', 'Both copies are meant to exist', 'A burst, uploaded at different times'],
  'photos:title': ['The title is fine', 'I will rename it later'],
  'photos:description': ['No description needed']
}
export const fineReasonsFor = (id: string): string[] => FINE_REASONS[id] ?? GENERAL_REASONS
