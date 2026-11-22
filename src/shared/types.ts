// Shared types used by both main process and renderer

export interface FlickrUser {
  nsid: string
  username: string
  realname: string
  avatarUrl: string
  isPro: boolean
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
  cleanupRules?: Record<string, 'off' | 'optional' | 'on'>   // per check in the Cleanup tab; see shared/cleanupRules.ts
}

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
  hasPhotoMeta: boolean           // true when the scan also saved titles, descriptions, locations and thumbnails
}

export interface TagScanProgress {
  mode: 'full' | 'refresh'
  phase: 'scanning' | 'finishing' | 'done' | 'cancelled' | 'error'
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
  sort?: 'alpha' | 'count'
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
export type AuditCategory = 'glued' | 'typo' | 'notwin' | 'noaccent' | 'junk' | 'runon' | 'spelling'
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
}

export interface AuditSummaryRow { category: AuditCategory; open: number; plan: number; fine: number; fixed: number }
export interface AuditSummary { computedAt: number; hasIndex: boolean; rows: AuditSummaryRow[] }

export type AuditSort = 'suggested' | 'most' | 'fewest' | 'alpha'   // suggested = strongest suspicion first (today's order)

export interface AuditListQuery {
  category: AuditCategory
  status: AuditStatus
  search?: string
  sort?: AuditSort
  offset: number
  limit: number
}
export interface AuditListPage { rows: AuditFinding[]; total: number }

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
export type HealthCondition = 'title' | 'description' | 'tags' | 'location'

export interface HealthSummaryRow { condition: HealthCondition; open: number; fine: number }
export interface HealthSummary { hasData: boolean; photos: number; rows: HealthSummaryRow[] }

export interface HealthListQuery {
  condition: HealthCondition
  status: 'open' | 'fine'
  search?: string
  year?: string         // only photos taken in this year (from a dashboard cluster)
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
}
export interface HealthListPage { rows: HealthPhoto[]; total: number }

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
}

export interface HealthOverview {
  hasData: boolean
  photos: number
  complete: number             // photos with nothing missing
  withGap: number
  twoOrMore: number
  onlyOne: Record<HealthCondition, number>   // photos whose only gap is this one (with twoOrMore, adds up to withGap)
  byType: { condition: HealthCondition; state: 'optional' | 'on'; open: number }[]   // checks that are Off are left out; gap counts below cover the checks that are On
  byYear: { year: string; total: number; anyGap: number; both: number; warnOnly: number; title: number; description: number; tags: number; location: number }[]
  clusters: { condition: HealthCondition; year: string; count: number; total: number }[]
}

// ── On This Day and the Timeline (3.5): read-only views over the local photo list ──

export type PrivacyScope = 'all' | 'public' | 'notpublic'   // "not public" = private, friends, family, or friends and family

export interface DayPhoto { id: string; title: string; thumbUrl: string; dateTaken: string; privacy: number }   // privacy: 0 public, 1 friends, 2 family, 3 friends and family, 4 private
export interface DayYearGroup { year: string; count: number; photos: DayPhoto[] }
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
  total: number
  counts: { all: number; public: number; notPublic: number }
  years: DayYearGroup[]        // newest year first
  insights: DayInsights
  prev: DayNeighbour; next: DayNeighbour
}
export interface DayQuery { month: number; day: number; scope: PrivacyScope; perYear?: number; tag?: string }   // tag: only photos with this tag
export interface DayPhotosQuery { month: number; day: number; year: string; scope: PrivacyScope; offset: number; limit: number; tag?: string }
export type DatePhotoIdsQuery =
  | { kind: 'day'; month: number; day: number; year?: string; scope: PrivacyScope; tag?: string }
  | { kind: 'range'; from: string; to: string; scope: PrivacyScope }   // YYYY-MM-DD, inclusive

export interface TimelineMonths {
  hasData: boolean; hasCatalog: boolean; scope: PrivacyScope; total: number
  cells: { year: number; month: number; count: number }[]
  counts: { all: number; public: number; notPublic: number }
}
export interface TimelineDays { year: number; month: number; days: { day: number; count: number }[] }

export interface TodaySummary {
  month: number; day: number; total: number; yearCount: number
  firstYear: string; lastYear: string
  topYear: { year: string; count: number } | null
  topTags: { name: string; count: number; key: string }[]
  years: { year: string; count: number }[]   // oldest first, for the small bars in the card's hover
  thumbs: string[]             // small pictures from the busiest years, for the card
  cardHidden: boolean; cardEnabled: boolean; notifyEnabled: boolean
}

// Camera roll (Timeline): the photos of a month or a day in calendar order, grouped by day
export interface CameraRollQuery { from: string; to: string; scope: PrivacyScope; order: 'asc' | 'desc'; offset: number; limit: number }   // from and to: YYYY-MM-DD, inclusive; offset and limit count days
export interface CameraRollDay { date: string; count: number; photos: DayPhoto[] }   // photos: up to 600 per day
export interface CameraRollView { hasData: boolean; hasCatalog: boolean; scope: PrivacyScope; totalDays: number; totalPhotos: number; days: CameraRollDay[] }
