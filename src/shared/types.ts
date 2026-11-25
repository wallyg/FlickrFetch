// Shared types used by both main process and renderer

export interface FlickrUser {
  nsid: string
  username: string
  realname: string
  avatarUrl: string
  isPro?: boolean      // undefined when Flickr could not be asked (offline, throttled): then nothing is assumed about the account
  memberSince: number  // year extracted from datecreate Unix timestamp
}

export interface FlickrTokenData {
  accessToken: string
  accessTokenSecret: string
  nsid: string
  username: string
  realname: string
}

export interface FlickrPhoto {
  id: string
  title: string
  thumbnailUrl: string
  url_m?: string         // medium-size URL (240px longest side); used for justified grid
  width_m?: number       // pixel width at medium size; used for justified aspect ratio
  height_m?: number      // pixel height at medium size; used for justified aspect ratio
  dateTaken: string
  media?: 'photo' | 'video'
  datePosted?: string    // Unix timestamp string from Flickr date_upload extra
  ispublic?: number
  isfriend?: number
  isfamily?: number
  tags?: string[]        // populated when extras=tags is requested (album view)
  lastUpdate?: number    // Flickr last_update unix timestamp (seconds); used for Smart Download Updated
  license?: string       // Flickr license id string ('0'=ARR, '1'-'6'=CC, '7','9','10'=PD, '8'=US Gov)
}

export type FileNamingCore = 'title' | 'id' | 'id-title' | 'title-id'
export type FileNamingSep = '.' | '-' | '_' | ' ' | '|'
export type DateFormat = 'YYYY-MM-DD' | 'YYYY-MM-DD HH-MM-SS' | 'YYYY.MM.DD' | 'YYYY.MM.DD HH.MM.SS'
export type PartPosition = 'off' | 'prefix' | 'suffix'
export type CaseTransform = 'none' | 'lowercase' | 'uppercase'
export type DownloadSize = 'original' | 'xlarge' | 'large' | 'medium' | 'small' | 'square'
export type ConflictBehavior = 'skip' | 'rename' | 'overwrite'

export interface FileNamingConfig {
  core: FileNamingCore
  separator: FileNamingSep
  date: { position: PartPosition; format: DateFormat }
  sequence: { position: PartPosition }
  customText: { position: PartPosition; text: string }
  caseTransform: CaseTransform
  charSubstitution: boolean  // replace spaces in title with separator
  sizeToken: { position: PartPosition }  // size indicator as prefix or suffix
  subStripParens?: boolean     // strip '(' and ')' before sanitization
  subStripBrackets?: boolean   // strip '[' and ']' before sanitization
}

export interface AppSettings {
  fileNaming: FileNamingConfig
  downloadFolder: string
  showDockProgress: boolean
  notifyOnComplete: boolean
  conflictBehavior: ConflictBehavior
  downloadSize: DownloadSize
  openFinderOnComplete: boolean
  metadata: MetadataSettings
  onThisDayCard?: boolean      // show the On This Day card at the top of My Flickr (default on)
  onThisDayNotify?: boolean    // one macOS notification a day with today's On This Day (default off)
  autoUpdateWhen?: 'open' | 'daily' | 'off'   // quietly Update the library list: every time the app opens, once a day (default), or never
  autoUpdate?: boolean         // earlier form of the same setting (false = off); autoUpdateWhen wins when both exist
  auditGenericWords?: string[] // the words the 'generic tags' check flags (a trailing * matches anything that starts that way); default list in cleanupRules.ts
  devPretendFree?: boolean     // development builds only: show the free-account size notes (#126) although the account is Pro
  healthTagLimit?: number      // the 'too many tags' check flags photos with at least this many tags (2 to 75, default 65)
  healthScope?: Partial<{ videos: boolean; locVideos: 'same' | 'include' | 'leave'; locPrivacy: 'all' | 'public' | 'notPublic' }>   // which photos the Photos checks look at (Tune checks, #246); see shared/healthScope.ts
  duplicates?: Partial<DuplicateSettings>   // the number behind the Possible duplicates check (Tune checks)
  locationHints?: Partial<LocationHintSettings>   // the numbers behind the location and title hints in the Photos checks (Tune checks)
  missingTags?: Partial<MissingTagSettings>   // the numbers behind the "Photos missing a tag" check (Tune checks)
  albumFit?: Partial<AlbumFitSettings>   // the numbers behind the Album fit lists (Tune checks); anything missing uses its default
  cleanupRules?: Record<string, 'off' | 'optional' | 'on'>   // per check in the Cleanup tab; see shared/cleanupRules.ts
  mapStreet?: boolean          // the Map tab's street map: true on, false off, missing = never asked (the first time it is turned on, a note explains it)
  mapCacheMb?: number          // room for the saved street pictures, in megabytes (20 to 5000, default 300)
}

export interface MapCacheInfo { bytes: number; files: number }

export interface BatchProgress {
  current: number       // number completed so far
  total: number
  albumTitle: string
  activeTitle: string   // file currently being fetched/downloaded
  latestTitle: string   // most recently completed
  latestFilePath: string | null
  status: 'running' | 'done' | 'cancelled' | 'error'
  allTitles?: string[]  // full ordered list, sent once in the initial event
  queuedCount?: number   // how many batches are waiting behind this one
  queuedAlbums?: { id: string; title: string; photoCount?: number; videoCount?: number }[]
  error?: string
  skippedCount?: number                   // collision skips (file already exists, behavior = skip)
  skippedSizeUnavailableCount?: number    // photos where the requested size doesn't exist on Flickr
  smallerCount?: number                   // photos saved smaller than the Original that was asked for (free accounts, #126)
  failedCount?: number                    // photos that errored and were skipped
  failedPhotos?: { id: string; title: string }[]
  discoverFolder?: string    // set on done events from Discover batch runners, used for retry routing
  smartFilteredCount?: number // photos excluded by smart filter (Never Downloaded / Download Updated)
  paused?: boolean
  completedAt?: number  // ms epoch, set when stacked into completedBatches
}

export interface BatchLogEntry {
  id: number
  createdAt: number            // ms since epoch
  source: string               // album name / 'Photostream' / 'Selected Photos'
  sourceType: 'album' | 'photostream' | 'selected' | 'discover' | 'discover_people' | 'discover_groups'
  total: number
  downloaded: number
  skippedCollision: number
  failed: number
  status: 'complete' | 'partial' | 'cancelled' | 'error'
  failedPhotos?: { id: string; title: string }[]
}

export interface PhotoDownloadRecord {
  photoId: string
  lastDownloadedAt: number     // ms since epoch (when we downloaded it)
  flickrLastUpdate: number     // Flickr's last_update timestamp (seconds) at download time
  title: string
  thumbnailUrl: string
  sizeLabel?: string           // the Flickr size it came down at ('Original', 'Large', ...); empty for downloads from before 3.6
  sizeLimited?: boolean        // the Original was asked for and Flickr gave a smaller size (free accounts)
}

export interface PhotoRecordQuery {
  title?: string
  photoId?: string
  dateMin?: number  // ms since epoch
  dateMax?: number  // ms since epoch
}

// Same shape as PhotoDownloadRecord but stored in a separate table so
// Discover downloads never interfere with Smart Download checks on your own photos.
export interface DiscoverDownloadRecord extends PhotoDownloadRecord {
  source: string
}

export interface MetadataSettings {
  embedTitle: boolean
  embedDescription: boolean
  embedTags: boolean
  embedDateTaken: boolean
  embedCreator: boolean
  embedGps: boolean
  stripGpsFromPrivate: boolean
  embedLicense: boolean
  embedPhotoUrl: boolean
  embedPhotoId: boolean
  writeSidecarJson: boolean
  keepDescriptionHtml: boolean   // true = embed Flickr's original HTML description; false = plain text
}

export type LicenseFilter = 'all' | 'cc' | 'public' | 'gov' | 'arr'

export interface PhotoInfo {
  id: string
  title: string
  description: string
  tags: string[]
  dateTaken: string | null
  latitude: number | null
  longitude: number | null
  locationName?: string
  ownerName: string
  ownerPathAlias: string
  license: string
  isPrivate: boolean
}

export interface PhotoSize {
  label: string
  width: number
  height: number
  source: string
  media: 'photo' | 'video'
}

export interface PhotoPage {
  photos: FlickrPhoto[]
  page: number
  pages: number
  total: number
}

export interface FlickrAlbum {
  id: string
  title: string
  description: string
  photoCount: number
  videoCount: number
  coverPhotoUrl: string
}

export interface AlbumPage {
  albums: FlickrAlbum[]
  page: number
  pages: number
  total: number
}

export interface FlickrSet {
  id: string
  title: string
  description: string
  coverPhotoUrl?: string
}

export interface FlickrCollection {
  id: string
  title: string
  description: string
  iconUrl: string
  coverUrls: string[]   // up to 4 album cover URLs for 2×2 collage thumbnail
  collections: FlickrCollection[]
  sets: FlickrSet[]
}

export interface CameraExif {
  camera?: string       // make + model, e.g. "Canon EOS 5D Mark IV"
  lens?: string
  aperture?: string     // e.g. "f/2.8"
  shutterSpeed?: string // e.g. "1/500 sec"
  iso?: string          // e.g. "800"
  focalLength?: string  // e.g. "85 mm"
}

export type SearchOperator = 'contains' | 'starts' | 'ends' | 'exact'
export type DateRangeField = 'taken' | 'posted'
export type TagMode = 'any' | 'all'

export interface PhotoSearchParams {
  query?: string
  operator?: SearchOperator
  tagQuery?: string
  tagMode?: TagMode    // 'any' = OR across tags, 'all' = AND; defaults to 'any'
  dateField?: DateRangeField
  dateMin?: string   // YYYY-MM-DD
  dateMax?: string   // YYYY-MM-DD
}

export interface DiscoverUser {
  nsid: string
  username: string
  realname: string
  avatarUrl: string
  photoCount?: number
}

export interface DiscoverContact {
  nsid: string
  username: string
  realname: string
  avatarUrl: string
}

export interface DiscoverGroup {
  id: string
  nsid: string
  name: string
  memberCount?: number
  photoCount?: number
  iconUrl?: string
}

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error'

export interface AuthState {
  status: AuthStatus
  user: FlickrUser | null
  error: string | null
}

// ── Tag index (Tags tab) ─────────────────────────────────────────────────────

export interface TagIndexStatus {
  hasIndex: boolean
  scanning: boolean
  lastScanAt: number | null       // ms; last completed scan or refresh
  lastFullScanAt: number | null   // ms; last completed full scan
  indexedPhotos: number
  tagCount: number
  flickrTotal: number | null      // photo total reported by Flickr at the last check
  hasSpellings: boolean           // true when the as-typed spellings were fetched ("New York")
  hasCatalog: boolean             // true when the scan also saved each photo's privacy and location (3.5), for On This Day and the Timeline
  hasCatalogV3: boolean           // true when it also saved the media type, upload date and description flags (3.6)
  hasAlbums: boolean              // true when the albums and which photo is in which album have been read (3.7)
  hasPhotoMeta: boolean           // true when the scan also saved titles, descriptions, locations and thumbnails
}

export interface TagScanProgress {
  mode: 'full' | 'refresh'
  phase: 'scanning' | 'finishing' | 'albums' | 'done' | 'cancelled' | 'error'
  page: number
  pages: number
  photos: number
  total: number
  error?: string
}

export interface TagRow {
  name: string      // Flickr's clean form ("newyork"); this is the key for filtering photos
  display: string   // best as-typed spelling ("New York"); falls back to name
  variants: number  // how many different spellings exist for this tag (1 = consistent)
  spellings: string[] // every spelling typed for this tag (empty when only the clean form is known)
  count: number
}

export type TagTextOperator = 'contains' | 'startsWith' | 'endsWith' | 'exact'

export interface TagListQuery {
  prefix?: string              // letter or letter pair chosen in the strip ('' = all)
  afterPrefix?: 'other'        // with prefix: next character is not a letter or digit
  other?: boolean              // true = tags that start with a non-Latin letter or symbol
  script?: string              // with other: only this bucket (latin, cyrillic, greek, arabic, hebrew, indic, cjk, korean, seasia, digits, misc)
  base?: string                // with other + latin: only tags whose first letter is this plain letter once accents are removed (é -> e)
  digits?: boolean             // true = tags that start with a digit
  text?: string                // text typed in the filter box
  operator?: TagTextOperator   // how text matches (default contains)
  sort?: 'alpha' | 'alphaDesc' | 'count'
  includeMachine?: boolean     // machine tags (contain ':') are hidden unless true
  offset?: number
  limit?: number
}

export interface TagListPage {
  rows: TagRow[]
  total: number
}

export interface TagLetterGroup {
  key: string      // next character: a-z; '#' (all digits) at the top level, 0-9 deeper; 'other'; '' = the bare tag itself
  label: string
  count: number    // tags in this group
}

// ── Tag audit (read-only report of likely tag problems) ──────────────────────
export type AuditCategory = 'glued' | 'typo' | 'notwin' | 'noaccent' | 'junk' | 'runon' | 'spelling' | 'usedonce' | 'generic' | 'numbers' | 'filename' | 'missing' | 'plural' | 'possessive'   // missing: a tag that photos probably lack (the row is the tag to add; its photos are the ones missing it)
export type AuditStatus = 'open' | 'plan' | 'fine' | 'fixed'
export type AuditConfidence = 'high' | 'medium' | 'low'

export interface AuditFinding {
  category: AuditCategory
  tag: string             // Flickr's clean form; with the category this identifies the finding
  display: string         // the spelling shown in the Tags tab
  count: number           // photos with this tag
  confidence: AuditConfidence
  replacement: string     // what to replace the tag with: a comma list (it may include the original, to keep it)
  evidence: string
  spellings: string[]
  status: AuditStatus
  flickrUrl: string       // this tag's page on your Flickr account (a handy place to fix it by hand)
  clues?: AuditClue[]     // Photos missing a tag: how many of the photos each clue points to
}
// habit: a tag it always travels with (top: the most common one); album; titlePlace: the place its title starts with; near: photos taken right beside it; titleName: the title contains the tag's name
export interface AuditClue { key: 'habit' | 'album' | 'titlePlace' | 'near' | 'titleName'; n: number; top?: string }

export interface AuditSummaryRow { category: AuditCategory; open: number; plan: number; fine: number; fixed: number }
export interface AuditSummary { computedAt: number; hasIndex: boolean; rows: AuditSummaryRow[] }

export type AuditSort = 'suggested' | 'most' | 'fewest' | 'alpha' | 'alphaDesc'   // suggested = strongest suspicion first (today's order)

export interface AuditListQuery {
  category: AuditCategory
  status: AuditStatus
  search?: string
  sort?: AuditSort
  reason?: string         // Odd characters: show only one kind of problem (the reason text of the rows)
  offset: number
  limit: number
}
export interface AuditListPage { rows: AuditFinding[]; total: number; reasons?: Record<string, number> }   // reasons: Odd characters, how many rows each reason has (before the reason filter)

export type AuditExportQuery = Omit<AuditListQuery, 'offset' | 'limit'>

export interface AuditSetRequest {
  tag: string
  category: AuditCategory
  status: 'open' | 'plan' | 'fine'   // 'open' clears a plan or fine mark
  replacement?: string               // the user's edit of the replacement list
}

export interface AuditPlanRow {
  category: AuditCategory
  tag: string
  display: string
  count: number
  replacement: string
  status: 'plan' | 'fixed'
  flickrUrl: string
  line: string            // "Replace "Kantō" with Kantō, Kanto (1,133 photos)"
}

// ── Metadata health (photos with missing or weak metadata) ───────────────────
export type HealthCondition =
  | 'title' | 'description' | 'tags' | 'tagsOne' | 'location'                  // missing
  | 'dateFuture' | 'dateAfterUpload' | 'datePlaceholder'                       // dates
  | 'descLink' | 'descCopy' | 'descMarkup' | 'descTags'                        // descriptions that are not real descriptions
  | 'locNull' | 'locVague' | 'locFar' | 'locTitle' | 'duplicates'                                                       // locations that look wrong
  | 'tagsMany'                                                                 // too many tags

export interface HealthSummaryRow { condition: HealthCondition; open: number; fine: number }
export interface HealthSummary { hasData: boolean; photos: number; rows: HealthSummaryRow[] }

export type HealthSort = 'newest' | 'oldest' | 'title' | 'titleDesc'   // by date taken, or by title
export interface HealthListQuery {
  condition: HealthCondition
  status: 'open' | 'fine'
  sort?: HealthSort
  search?: string
  year?: string         // only photos taken in this year (from a dashboard cluster)
  reason?: 'none' | 'camera'   // No title or camera-file title: only photos with no title, or only camera-file titles
  offset: number
  limit: number
}
export type HealthExportQuery = Omit<HealthListQuery, 'offset' | 'limit'>

export interface HealthPhoto {
  photoId: string
  title: string
  thumbUrl: string
  dateTaken: string
  kind: string          // for titles: 'No title' or 'Camera-file title'
  flickrUrl: string
  status: 'open' | 'fine'
  hint?: string         // a suggestion worked out from the photos taken beside it (a location, a title start), with why
  hintMapUrl?: string   // a map showing the suggested place, or the geotag that looks wrong
  hintGeo?: { lat: number; lon: number }   // the same place as numbers, for opening the app's own Map on it
}
export interface HealthListPage { rows: HealthPhoto[]; total: number; reasons?: { none: number; camera: number } }   // reasons: No title or camera-file title, how many rows of each kind (before the reason filter)

// Possible duplicates (#157): photos with the same date taken, to the second, uploaded at different times
export interface DuplicatePhoto {
  photoId: string; title: string; thumbUrl: string
  uploadedAt: number        // seconds since 1970
  tags: number; albums: number | null   // albums: null when the album list has not been read yet
  privacy: number           // 0 public, 1 friends, 2 family, 3 friends and family, 4 private
  flickrUrl: string; status: 'open' | 'fine'
}
export interface DuplicateGroup { taken: string; gapSeconds: number; photos: DuplicatePhoto[] }
export type DuplicateSort = 'gap' | 'newest' | 'oldest'
export interface DuplicateQuery { status: 'open' | 'fine'; search?: string; sort?: DuplicateSort; offset: number; limit: number }
export interface DuplicatePage { groups: DuplicateGroup[]; total: number; photos: number }   // total: groups in this list; photos: photos in them
export interface DuplicateSettings { gapMinutes: number }   // how far apart (in minutes) two uploads must be to count as a possible duplicate
export interface DuplicateStats { groups: number; photos: number }

// ── Album checks (3.7) ──────────────────────────────────────────────────────
export type AlbumCondition = 'noAlbum' | 'empty' | 'noCollection' | 'oneItem' | 'noDesc' | 'dupTitle' | 'misfit' | 'missing'
// What an album is organised by, which decides how photos are judged against it (3.8). 'anything' is left alone.
export type AlbumKind = 'date' | 'place' | 'tag' | 'anything'
// photos and albums: for May not fit and May be missing, the DISTINCT photos and the albums involved (open is the number of rows in the list)
export interface AlbumSummaryRow { condition: AlbumCondition; open: number; fine: number; photos?: number; albums?: number }
export interface AlbumGroupCount { total: number; issue: number; warning: number }   // of the whole: how many have an Issue, how many only a Warning
export interface AlbumBiggest { condition: 'misfit' | 'missing'; albumId: string; title: string; photos: number }
export interface AlbumSummary {
  hasData: boolean             // false until a Rebuild has read the albums
  albums: number
  photos: number               // photos and videos in the library list
  scannedAt: number | null     // when the albums were last read (ms)
  rows: AlbumSummaryRow[]
  groups: { albums: AlbumGroupCount; photos: AlbumGroupCount }   // Your albums, and Photos and their albums
  issues: AlbumBiggest[]       // the albums with the most photos flagged by a check set to Issue (at most 5)
  warnings: AlbumBiggest[]     // the same for a check set to Warning
}
export type AlbumSort = 'newest' | 'oldest' | 'title' | 'titleDesc'
export type MisfitReason = 'date' | 'place' | 'tag' | 'wrong' | 'double'
export interface AlbumListQuery { condition: AlbumCondition; status: 'open' | 'fine'; search?: string; sort?: AlbumSort; reason?: MisfitReason; offset: number; limit: number }
export type AlbumExportQuery = Omit<AlbumListQuery, 'offset' | 'limit'>
// One row of a list: a photo (Photos in no album) or an album (every other check)
export interface AlbumItem {
  id: string; title: string; thumbUrl: string; detail: string; flickrUrl: string; status: 'open' | 'fine'; isPhoto: boolean
  // Album fit rows (3.8) only: why it was suggested, the album concerned and what it is organised by
  why: string; albumId: string; albumUrl: string; kind: AlbumKind | ''; kindGuessed: boolean
  description?: string   // the album's own description, on May be missing rows (only when it has one)
  count?: number         // May be missing rows: how many photos are suggested for this album
}
export interface AlbumListPage { rows: AlbumItem[]; total: number; reasons?: Record<'all' | MisfitReason, number> }   // reasons: May not fit only, how many rows each reason has (before the reason filter)
export interface AlbumFitPhoto { photoId: string; title: string; thumbUrl: string; flickrUrl: string }
// One album in Settings > Album Checks (How each album is judged)
export interface AlbumKindRow { albumId: string; title: string; photos: number; kind: AlbumKind; pick: AlbumKind; overridden: boolean; why: string }
export interface AlbumSetRequest { id: string; condition: AlbumCondition; status: 'open' | 'fine' }
export interface AlbumKindRequest { albumId: string; kind: AlbumKind | 'auto' }
// Why something was marked "This one is fine" (#189)
export interface FineReasonRequest { checkId: string; key: string; label: string; reason: string; note?: string }
export interface FineReasonSummaryRow { checkId: string; reason: string; count: number }

// The numbers behind the Photos hints (defaults in locationHints.ts)
export interface LocationHintSettings {
  minutes: number   // photos taken within this many minutes of a photo are "beside" it
  meters: number    // a location is suggested only when those photos are within this many metres of each other
}
// What the hints find with the current numbers
export interface LocationHintStats { locations: number; noLocation: number; titles: number; farTitles: number }

// The numbers behind "Photos missing a tag" (defaults in missingTags.ts)
export interface MissingTagSettings {
  agree: number        // how many of the four clues must agree before a tag is suggested
  implication: number  // percent: photos with tag A carry tag B at least this often
  albumShare: number   // percent of an album's photos that carry a tag before the rest are suggested it
  titleShare: number   // percent of the photos with the same title place that carry a tag before the rest are suggested it
}
// What the check finds with the current numbers
export interface MissingTagStats { tags: number; photos: number; suggestions: number }

// The numbers behind Album fit, all adjustable in Tune checks (defaults in albumFit.ts)
export interface AlbumFitSettings {
  share: number      // percent of an album that must sit in its cluster (dates or tags) before its outliers are called out
  gapDays: number    // photos at most this many days apart belong to one visit
  isolated: number   // a run of this many photos or fewer, away from every visit, is on its own
  farTimes: number   // out of place when further from the middle than this many times the album's own spread...
  farKm: number      // ...and at least this many km beyond that spread
  titleShare: number // May belong: percent of the photos sharing a title place that must be in an album before the rest are suggested for it
  titleMin: number   // ...and the title place must be used on at least this many photos
  nearShare: number  // May belong: percent of the photos taken nearby (in time and place) that must be in an album
  nearMin: number    // ...out of at least this many nearby photos
  nearMinutes: number // "nearby" means taken within this many minutes...
  nearMeters: number  // ...and this many metres
  bothOnly: number   // 1: suggest only when the title place and the nearby photos agree
  titleMode: number  // 1: use the place a title starts with, but only when enough titles have one (see titleAutoMin); 0: never use titles
  titleAutoMin: number // Automatic: titles are used only when at least this percent of photos start their title with a place
  wrongOn: number    // May not fit: 1 = flag a photo filed in a different place's album than its title (or the photos beside it) says; 0 = off
  doubleOn: number   // May not fit: 1 = flag a photo that is in two albums for different places; 0 = off
  vouchShare: number // May not fit: a photo is left alone when at least this percent of its nearby photos are in the same album (0 turns this off)
}
// What Album fit found with the current numbers, to calibrate them
export interface AlbumFitStats {
  judged: number                                // albums with enough photos to be judged
  byKind: Record<AlbumKind, number>             // how those albums were sorted (date, place, tag, left alone)
  misfitPhotos: number; misfitAlbums: number    // may not fit: distinct photos (a photo can fit two albums badly), and albums involved
  byReason: { date: number; place: number; tag: number; wrong: number; double: number }
  missingAlbums: number; missingPhotos: number  // may belong: albums, and suggested photos in all
  misfitMarked: number; misfitMarkedStill: number   // photos you marked fine in May not fit, and how many of those the current numbers still flag
  missingMarked: number; missingMarkedStill: number // the same for albums marked fine in May belong
  titledPercent: number; titlesOn: boolean      // share of photos whose title starts with a place, and whether the title rules are in use
  missingBoth: number                           // of those photos, how many are backed by both the title place and the nearby photos
}

// ── Backup report (what is downloaded, from local records only) ─────────────
// Which size a photo came down at, saved with its download record (older records have no label)
export interface DownloadedSize { label: string; width: number; height: number; limited: boolean }   // limited: the original was asked for and Flickr gave a smaller size

export type BackupList = 'not' | 'new' | 'changed' | 'smaller'
export interface BackupSummary {
  hasData: boolean
  library: number              // photos and videos in the library list
  downloaded: number           // of those, how many have a download record
  notDownloaded: number
  lastDownloadAt: number | null   // when something was last downloaded (ms); null if never
  newSince: number             // uploaded after that moment and not downloaded
  changed: number              // changed on Flickr since they were downloaded
  unknownUpdate: number        // downloaded, but the record has no Flickr update time, so a change cannot be judged
  smaller: number              // downloaded at a smaller size than the original, because Flickr did not offer the original
  sizeUnknown: number          // downloaded before FlickrFetch recorded sizes, so the size is not known
}
export type BackupSort = 'uploaded' | 'uploadedOldest' | 'taken' | 'title' | 'titleDesc'   // newest upload first by default
export interface BackupQuery { list: BackupList; search?: string; sort?: BackupSort; offset: number; limit: number }

export interface HealthSetRequest { photoId: string; condition: HealthCondition; status: 'open' | 'fine' }

// ── Dashboard overviews ──────────────────────────────────────────────────────
export interface AuditOverview {
  hasIndex: boolean
  totalTags: number
  totalPhotos: number
  flaggedTags: number          // tags with an open or planned finding from the checks that are On
  flaggedPhotos: number        // photos carrying at least one of those tags
  plan: number
  fine: number
  fixed: number
  optionalTags: number         // tags flagged only by Optional checks
  optionalPhotos: number
  byType: { category: AuditCategory; state: 'optional' | 'on'; open: number; plan: number; fine: number; fixed: number; photos: number }[]   // checks that are Off are left out
  biggest: { display: string; category: AuditCategory; count: number }[]
  biggestWarnings: { display: string; category: AuditCategory; count: number }[]   // the same for checks set to Warning (at most 10)
}

export interface HealthOverview {
  hasData: boolean
  photos: number
  complete: number             // photos with nothing missing
  withGap: number              // photos with a gap from a check set to Issue
  warnOnly: number             // photos with no Issue gap but a gap from a check set to Warning
  twoOrMore: number
  onlyOne: Record<HealthCondition, number>   // photos whose only gap is this one (with twoOrMore, adds up to withGap)
  byType: { condition: HealthCondition; state: 'optional' | 'on'; open: number }[]   // checks that are Off are left out; gap counts below cover the checks that are On
  byYear: { year: string; total: number; anyGap: number; both: number; warnOnly: number; by: Record<HealthCondition, number> }[]   // by: photos with each gap in that year (checks that are Off are 0)
  clusters: { condition: HealthCondition; year: string; count: number; total: number }[]
}

// ── The Photo Map (3.10): your located photos as dots and numbered circles, worked out from the local library list ──

// The filters of the Map tab. Choices inside one filter match ANY of them (two albums: photos in either); different filters all have to match.
export type MapAccuracy = 'street' | 'town' | 'vague'   // Flickr's 1 to 16 precision: street 15 or 16, town or better 11 or more, vague 1 to 10 (none recorded matches none of these)
export interface MapFilter {
  media?: 'photo' | 'video'
  privacy?: 0 | 1 | 2 | 3 | 4         // 0 public, 1 friends, 2 family, 3 friends and family, 4 private
  dateField?: 'taken' | 'posted'      // which date the range applies to (default taken)
  dateFrom?: number; dateTo?: number  // YYYYMMDD; photos with no such date are left out once a range is set
  tags?: string[]; tagMode?: 'any' | 'all'   // typed names ("New York" and "newyork" are the same tag)
  albumIds?: string[]
  accuracy?: MapAccuracy
}
export interface MapAlbumHit { id: string; title: string; count: number }
export interface MapViewQuery extends MapFilter { west: number; south: number; east: number; north: number; zoom: number }   // zoom may be fractional (256 px is the whole world at zoom 0)
// One dot (count 1, with the photo's id) or one numbered circle. cx and cy name the grid cell it stands for, so a click can ask for its photos.
export interface MapCluster { lat: number; lon: number; count: number; cx: number; cy: number; id?: string }
export interface MapView {
  clusters: MapCluster[]
  inView: number          // photos in the window that pass the filters
  matching: number        // located photos anywhere that pass the filters
  located: number         // photos with a usable location
  photos: number          // photos in the library list
}
export interface MapCellQuery extends MapFilter { zoom: number; cx: number; cy: number; offset: number; limit: number }
export interface MapCellPage { ids: string[]; total: number }   // newest first

// ── On This Day and the Timeline (3.5): read-only views over the local photo list ──

export type PrivacyScope = 'all' | 'public' | 'notpublic'   // "not public" = private, friends, family, or friends and family

export interface DayPhoto { id: string; title: string; thumbUrl: string; dateTaken: string; privacy: number; media: 'photo' | 'video' }   // privacy: 0 public, 1 friends, 2 family, 3 friends and family, 4 private
export interface DayYearGroup { year: string; count: number; videos: number; photos: DayPhoto[] }   // count includes the videos
export interface DayInsights {
  topTags: { name: string; count: number; key: string }[]   // key: the tag as saved in the library, for filtering
  busiestHours: { hour: number; count: number }[]
  hourCounts: number[]         // photos per hour of the day, 24 entries (midnight first)
  earliestHour: number | null
  latestHour: number | null
  withLocation: number
}
export interface DayNeighbour { month: number; day: number; count: number }
export interface DayView {
  hasData: boolean
  hasCatalog: boolean          // false until a Full rescan has saved each photo's privacy (3.5)
  month: number; day: number
  scope: PrivacyScope
  total: number                // photos and videos
  videos: number               // how many of the total are videos
  counts: { all: number; public: number; notPublic: number }
  levels: number[]             // photos at each privacy level (public, friends, family, friends and family, private), with every other choice applied but not the privacy one
  years: DayYearGroup[]        // newest year first
  insights: DayInsights
  prev: DayNeighbour; next: DayNeighbour
}
// The Photos / Videos switch and the album choice, on top of the privacy scope: shared by On This Day and the Timeline
export type DateMedia = 'photo' | 'video'
export type DatePrivacy = 0 | 1 | 2 | 3 | 4   // 0 public, 1 friends, 2 family, 3 friends and family, 4 private
export interface DateExtra { media?: DateMedia; albumIds?: string[]; privacy?: DatePrivacy }   // albumIds: photos in any of these albums; privacy: exactly this level
export interface DayQuery extends DateExtra { month: number; day: number; scope: PrivacyScope; perYear?: number; tag?: string }   // tag: only photos with this tag
export interface DayPhotosQuery extends DateExtra { month: number; day: number; year: string; scope: PrivacyScope; offset: number; limit: number; tag?: string }
export type DatePhotoIdsQuery = DateExtra & (
  | { kind: 'day'; month: number; day: number; year?: string; scope: PrivacyScope; tag?: string }
  | { kind: 'range'; from: string; to: string; scope: PrivacyScope })   // YYYY-MM-DD, inclusive

export interface TimelineMonths {
  hasData: boolean; hasCatalog: boolean; scope: PrivacyScope; total: number
  cells: { year: number; month: number; count: number; videos: number }[]
  counts: { all: number; public: number; notPublic: number }
  levels: number[]             // photos at each privacy level, as in DayView
}
export interface TimelineDays { year: number; month: number; days: { day: number; count: number; videos: number }[] }

export interface TodaySummary {
  month: number; day: number; total: number; videos: number; yearCount: number
  firstYear: string; lastYear: string
  topYear: { year: string; count: number } | null
  topTags: { name: string; count: number; key: string }[]
  years: { year: string; count: number }[]   // oldest first, for the small bars in the card's hover
  thumbs: string[]             // small pictures from the busiest years, for the card
  cardHidden: boolean; cardEnabled: boolean; notifyEnabled: boolean
}

// Camera roll (Timeline): the photos of a month or a day in calendar order, grouped by day
export interface CameraRollQuery extends DateExtra { from: string; to: string; scope: PrivacyScope; order: 'asc' | 'desc'; offset: number; limit: number }   // from and to: YYYY-MM-DD, inclusive; offset and limit count days
export interface CameraRollDay { date: string; count: number; videos: number; photos: DayPhoto[] }   // photos: up to 600 per day
export interface CameraRollView { hasData: boolean; hasCatalog: boolean; scope: PrivacyScope; totalDays: number; totalPhotos: number; totalVideos: number; days: CameraRollDay[] }
