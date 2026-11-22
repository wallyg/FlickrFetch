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
  { id: 'photos:title', report: 'photos', name: 'No title, or a camera-file title', blurb: 'Photos with no title, or one like IMG_1234 or GOPR3893.', example: 'IMG_1234, or a blank title', defaultState: 'on' },
  { id: 'photos:description', report: 'photos', name: 'No description', blurb: 'Photos with an empty description.', example: 'A photo whose description box is empty', defaultState: 'optional' },
  { id: 'photos:tags', report: 'photos', name: 'No tags', blurb: 'Photos that carry no tags.', example: 'A photo that no tag search can find', defaultState: 'on' },
  { id: 'photos:location', report: 'photos', name: 'No location', blurb: 'Photos with no place on the map.', example: 'A photo missing from the map', defaultState: 'optional' }
]

export type CleanupRuleSettings = Record<string, CleanupRuleState>

export function ruleState(settings: CleanupRuleSettings | undefined, id: string): CleanupRuleState {
  const chosen = settings?.[id]
  if (chosen === 'off' || chosen === 'optional' || chosen === 'on') return chosen
  return CLEANUP_RULES.find(r => r.id === id)?.defaultState ?? 'on'
}
