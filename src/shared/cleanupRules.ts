// The checks in the Cleanup tab, and how each one is treated.
//   on        Issue: shown as a problem that needs attention and counted in the score
//   optional  Warning: shown, but never lowers the score
//   off       not shown and not counted anywhere
// The user's choices are saved in the app settings (cleanupRules); anything not chosen uses the default here.

export type CleanupRuleState = 'off' | 'optional' | 'on'
export type CleanupReport = 'tags' | 'photos'

export interface CleanupRule {
  id: string                 // 'tags:<audit category>' or 'photos:<health condition>'
  report: CleanupReport
  name: string
  blurb: string
  example?: string           // a short real-looking case, shown in grey under the description
  phrase?: string            // the problem in a few words, for sentences like "2019: no tags"
  kind?: string              // the small label on a photo in the list
  list?: { key: 'auditGenericWords'; label: string; help: string }   // a list of words this check lets you change
  number?: { key: 'healthTagLimit'; label: string; min: number; max: number; def: number }   // a number this check lets you change
  needsRebuild?: boolean     // only knows its answer after the 3.6 Rebuild (it reads details older library lists did not keep)
  defaultState: CleanupRuleState
}

export const CLEANUP_RULES: CleanupRule[] = [
  { id: 'tags:glued', report: 'tags', name: 'Names stuck together', blurb: 'A lowercase letter runs straight into a capital, usually where a comma was lost.', example: 'NewYork becomes New York', defaultState: 'on' },
  { id: 'tags:typo', report: 'tags', name: 'Possible typos', blurb: 'A rare tag that looks like a misspelling of a common one.', example: 'Pairis, one letter off the popular tag Paris', defaultState: 'optional' },
  { id: 'tags:junk', report: 'tags', name: 'Odd characters', blurb: 'Stray punctuation, symbols or invisible characters in a tag.', example: 'MoMA: with a stray colon on the end', defaultState: 'on' },
  { id: 'tags:runon', report: 'tags', name: 'Run-ons', blurb: 'Very long tags that are probably several tags run together.', example: 'manhattanskylineatnightfromthebridge', defaultState: 'on' },
  { id: 'tags:notwin', report: 'tags', name: 'Accented tags with no plain twin', blurb: 'Flickr search cannot find accented tags, so a plain version helps people (and you) find the photos.', example: 'Kantō, with no plain Kanto beside it', defaultState: 'optional' },
  { id: 'tags:noaccent', report: 'tags', name: 'Plain tags that may need accents', blurb: 'A plain tag whose accented spelling you use elsewhere.', example: 'cafe, when you also use café', defaultState: 'optional' },
  { id: 'tags:spelling', report: 'tags', name: 'Typed more than one way', blurb: 'The same tag in different spellings, such as Québec and Quebec.', example: 'Québec and Quebec on different photos', defaultState: 'optional' },
  { id: 'tags:usedonce', report: 'tags', name: 'Tags used only once', blurb: 'A tag that sits on a single photo. Often a typo or a one-off word; sometimes a real name.', example: 'A tag on one photo and nowhere else', defaultState: 'off' },
  { id: 'tags:generic', report: 'tags', name: 'Generic tags', blurb: 'Words that say nothing about the photo, such as photo, camera or iphone. The list is yours to edit.', example: 'photo, camera, iphone12', list: { key: 'auditGenericWords', label: 'Words to flag', help: 'One per line. End a word with * to match anything that starts that way (iphone* also flags iphone12).' }, defaultState: 'optional' },
  { id: 'tags:numbers', report: 'tags', name: 'Numbers only', blurb: 'A tag made only of digits that is not a year (years from 1900 to 2099 are left alone).', example: '1234', defaultState: 'optional' },
  { id: 'tags:filename', report: 'tags', name: 'File-name tags', blurb: 'A tag that is a file name from a camera or phone, or a date-and-time stamp.', example: 'IMG_1234, DSC01234, 20240315_101500', defaultState: 'optional' },
  { id: 'photos:title', report: 'photos', name: 'No title, or a camera-file title', blurb: 'Photos with no title, or one like IMG_1234 or GOPR3893.', example: 'IMG_1234, or a blank title', phrase: 'no title or a camera-file title', defaultState: 'on' },
  { id: 'photos:description', report: 'photos', name: 'No description', blurb: 'Photos with an empty description.', example: 'A photo whose description box is empty', phrase: 'no description', defaultState: 'optional' },
  { id: 'photos:tags', report: 'photos', name: 'No tags', blurb: 'Photos that carry no tags.', example: 'A photo that no tag search can find', phrase: 'no tags', defaultState: 'on' },
  { id: 'photos:tagsOne', report: 'photos', name: 'Only one tag', blurb: 'Photos with a single tag, which usually means the photo is under-described.', example: 'A photo tagged only "cat"', phrase: 'only one tag', kind: 'Only one tag', defaultState: 'optional' },
  { id: 'photos:location', report: 'photos', name: 'No location', blurb: 'Photos with no place on the map.', example: 'A photo missing from the map', phrase: 'no location', defaultState: 'optional' },
  { id: 'photos:dateFuture', report: 'photos', name: 'Taken in the future', blurb: 'The date taken is later than today, usually a camera clock set wrong.', example: 'A photo dated next year', phrase: 'a date in the future', kind: 'Future date', defaultState: 'on' },
  { id: 'photos:dateAfterUpload', report: 'photos', needsRebuild: true, name: 'Taken after it was uploaded', blurb: 'The date taken is a later day than the day the photo was uploaded, which cannot be right.', example: 'Uploaded on 4 May, taken on 9 May', phrase: 'taken after it was uploaded', kind: 'Taken after upload', defaultState: 'on' },
  { id: 'photos:datePlaceholder', report: 'photos', needsRebuild: true, name: 'Placeholder date', blurb: 'Flickr marks the date as unknown, or it is a day devices fall back to when their clock is not set (1 January 1970, 1980 or 2000), or the year is before 1900.', example: 'A photo dated 1 January 1970', phrase: 'a placeholder date', kind: 'Placeholder date', defaultState: 'optional' },
  { id: 'photos:descLink', report: 'photos', needsRebuild: true, name: 'Description is only a link', blurb: 'The description is a web address and nothing else.', example: 'https://example.com/page', phrase: 'a description that is only a link', kind: 'Only a link', defaultState: 'on' },
  { id: 'photos:descCopy', report: 'photos', needsRebuild: true, name: 'Description copies the title', blurb: 'The description repeats the title word for word.', example: 'Title and description both say "Sunset at the pier"', phrase: 'a description that copies the title', kind: 'Copies the title', defaultState: 'on' },
  { id: 'photos:descMarkup', report: 'photos', needsRebuild: true, name: 'Description is only code', blurb: 'The description holds HTML code and nothing readable, such as empty line breaks.', example: '<br /><br />', phrase: 'a description with only code', kind: 'Only code', defaultState: 'on' },
  { id: 'photos:descTags', report: 'photos', needsRebuild: true, name: 'Description is a list of tags', blurb: "The description is a list of words that are mostly the photo's own tags.", example: 'paris eiffel tower night', phrase: 'a description that is a list of tags', kind: 'List of tags', defaultState: 'optional' },
  { id: 'photos:locNull', report: 'photos', needsRebuild: true, name: 'Located at 0, 0', blurb: 'A location set to exactly latitude 0, longitude 0 (in the ocean off Africa), usually a failed lookup.', example: 'A street photo placed in the Atlantic', phrase: 'a location at 0, 0', kind: 'At 0, 0', defaultState: 'on' },
  { id: 'photos:locFar', report: 'photos', name: 'Far from nearby photos', blurb: 'The photo sits far from the photos taken just before and after it, while those two are close to each other.', example: 'One photo in Spain between two taken in New Jersey', phrase: 'a location far from nearby photos', kind: 'Far from neighbours', defaultState: 'optional' },
  { id: 'photos:tagsMany', report: 'photos', name: 'Too many tags', blurb: 'More tags than your limit (65 unless you change it). Flickr stops at 75, so a photo near the limit has no room left.', example: 'A photo with 70 tags', phrase: 'too many tags', kind: 'Too many tags', number: { key: 'healthTagLimit', label: 'Flag photos with at least this many tags', min: 2, max: 75, def: 65 }, defaultState: 'optional' }
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
