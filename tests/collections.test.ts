import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectionAlbums } from '../src/shared/collections'
import changelog from '../src/renderer/data/changelog'
import type { FlickrCollection, FlickrSet } from '../src/shared/types'

const read = (f: string): string => readFileSync(join(process.cwd(), f), 'utf8')
const set = (id: string, title: string): FlickrSet => ({ id, title } as FlickrSet)
const col = (title: string, sets: FlickrSet[], collections: FlickrCollection[] = []): FlickrCollection =>
  ({ id: title, title, description: '', iconUrl: '', coverUrls: [], sets, collections })

test('a collection download lists every album, each with the folders it sits in', () => {
  const tree = col('Trips', [set('1', 'Paris')], [
    col('2019', [set('2', 'Summer'), set('3', 'Summer')], [col('Extra', [set('4', 'Misc')])]),
    col('2020', [set('5', 'Summer')])
  ])
  const got = collectionAlbums(tree)
  assert.deepEqual(got.map(a => a.id), ['1', '2', '3', '4', '5'])
  assert.deepEqual(got.find(a => a.id === '1')!.path, ['Trips'])
  assert.deepEqual(got.find(a => a.id === '2')!.path, ['Trips', '2019'])
  assert.deepEqual(got.find(a => a.id === '4')!.path, ['Trips', '2019', 'Extra'])
  // two albums called "Summer" in different sub-collections no longer share a folder
  assert.notDeepEqual(got.find(a => a.id === '2')!.path, got.find(a => a.id === '5')!.path)
})

test('an album that is in two places in the tree is downloaded once', () => {
  const tree = col('A', [set('1', 'X')], [col('B', [set('1', 'X'), set('2', 'Y')])])
  assert.deepEqual(collectionAlbums(tree).map(a => a.id), ['1', '2'])
})

test('Download all albums asks first, and the main process does not queue an album that is already queued', () => {
  const page = read('src/renderer/pages/MainPage.tsx')
  assert.ok(/onClick=\{\(\) => setCollectionToDownload\(currentCollection\)\}/.test(page), 'the button opens the confirm box')
  assert.ok(!/onClick=\{\(\) => void window\.flickrAPI\.startCollectionBatch/.test(page), 'and does not start the download itself')
  const main = read('src/main/index.ts')
  const handler = main.slice(main.indexOf("ipcMain.handle('batch:startCollection'"), main.indexOf("ipcMain.handle('batch:startAlbum'"))
  assert.ok(/activeBatchAlbumId === id/.test(handler) && /batchQueue\.some\(j => j\.type === 'album' && j\.albumId === id\)/.test(handler))
  assert.ok(/collectionPath: path/.test(handler), 'sub-collections keep their own folders')
  assert.ok(/join\(downloadFolder, \.\.\.safeCollectionParts\)/.test(main))
})

test('the album grid stops asking for a page that failed, until Load more is pressed', () => {
  const src = read('src/renderer/components/AlbumPhotoGrid.tsx')
  assert.ok(/catch \(err\) \{\s*if \(req === albumReq\.current\) setMoreError/.test(src), 'a failed page is remembered')
  assert.ok(/!loadingMore && !loading && !moreError\) \{/.test(src), 'and the filters no longer reload it on their own')
  assert.ok(/setMoreError\(null\)/.test(src), 'a new try (or a new album) clears it')
  assert.ok(/albumReq\.current/.test(src) && /req !== albumReq\.current\) return/.test(src), 'answers for an album you left are ignored')
})

test('the changelog is readable code (a stray quote once stopped the whole app compiling)', () => {
  assert.ok(changelog.length > 10)
  for (const r of changelog) assert.ok(/^\d+\.\d+$/.test(r.version), r.version)
  assert.ok(changelog[0].highlights.length > 0)
})

import { parseTagInput, hasTags } from '../src/shared/tags'

test('a tag filter reads commas and Flickr\'s own tag form, so "New York" finds "newyork"', () => {
  assert.deepEqual(parseTagInput('New York, Paris ,, '), ['newyork', 'paris'])
  assert.deepEqual(parseTagInput(''), [])
  assert.ok(hasTags(['newyork', 'Trip'], parseTagInput('New York'), 'any'))
  assert.ok(hasTags(['New York', 'Trip'], parseTagInput('newyork, trip'), 'all'))
  assert.ok(!hasTags(['newyork'], parseTagInput('newyork, trip'), 'all'))
  assert.ok(hasTags(['newyork'], parseTagInput('newyork, trip'), 'any'))
  assert.ok(!hasTags(undefined, parseTagInput('paris'), 'any'), 'a photo with no tags has none of them')
  assert.ok(hasTags(undefined, [], 'all'), 'no tags typed: everything matches')
})

test('Discover Groups uses that same tag filter', () => {
  const src = read('src/renderer/components/DiscoverGroups.tsx')
  assert.ok(/parseTagInput\(poolAppliedTagInput\)/.test(src) && /hasTags\(p\.tags, tags, poolAppliedTagMode\)/.test(src))
  assert.ok(!/split\(\/\\s\+\/\)/.test(src), 'no longer splits the tag box on spaces')
})

test('a location of exactly 0, 0 is read as "no location", not saved into files', () => {
  const src = read('src/main/flickr.ts')
  assert.ok(/!\(lat === 0 && lon === 0\)/.test(src))
})

test('On This Day ignores a slow "Show all" for a day you have moved off', () => {
  const src = read('src/renderer/components/OnThisDayPanel.tsx')
  assert.ok(/viewRef\.current\+\+/.test(src) && /if \(view !== viewRef\.current\) return/.test(src))
})

test('a download that finishes for a photo you have moved off does not mark the photo now on screen', () => {
  const src = read('src/renderer/components/PhotoDetail.tsx')
  assert.ok(/shownId\.current = photo\.id/.test(src))
  assert.equal((src.match(/if \(forId !== shownId\.current\) return/g) ?? []).length, 2, 'both the finish and the failure are checked')
})

test('a mistyped sign-in code can be corrected: the pending sign-in is only cleared once Flickr accepts the code', () => {
  const src = read('src/main/auth.ts')
  const verify = src.slice(src.indexOf('export async function verifyOAuth'), src.indexOf('// Kept in memory only'))
  const clears = [...verify.matchAll(/pendingRequestToken = null/g)].map(m => m.index ?? 0)
  const post = verify.indexOf('await axios.post(accessTokenUrl')
  assert.equal(clears.length, 1)
  assert.ok(clears[0] > post, 'cleared after the request that checks the code, not before it')
})

test('a missing avatar falls back once, not in a loop when the fallback is missing too (offline)', () => {
  const src = read('src/renderer/pages/MainPage.tsx')
  assert.equal((src.match(/if \(!e\.currentTarget\.src\.endsWith\('buddyicon\.gif'\)\)/g) ?? []).length, 2)
})

import { parseDiscoverQuery } from '../src/shared/discoverQuery'
test('Discover finds a person from a name, an id, or any link to their page or one of their photos', () => {
  assert.deepEqual(parseDiscoverQuery('  someone '), { kind: 'name', name: 'someone' })
  assert.deepEqual(parseDiscoverQuery('12345678@N00'), { kind: 'nsid', nsid: '12345678@N00' })
  for (const link of ['https://www.flickr.com/photos/someone/', 'https://www.flickr.com/photos/someone/53012345678/', 'http://flickr.com/photos/someone/albums/72177', 'www.flickr.com/people/someone/?x=1', 'flickr.com/photos/someone#top']) {
    assert.deepEqual(parseDiscoverQuery(link), { kind: 'name', name: 'someone' }, link)
  }
  assert.deepEqual(parseDiscoverQuery('https://www.flickr.com/photos/12345678@N00/5301/'), { kind: 'nsid', nsid: '12345678@N00' })
  assert.deepEqual(parseDiscoverQuery('https://www.flickr.com/photos/a%20b/'), { kind: 'name', name: 'a b' })
  assert.deepEqual(parseDiscoverQuery('%E0%A4%A'), { kind: 'name', name: '%E0%A4%A' }, 'text that is not valid percent-coding is kept as typed')
})

test('the words in Settings match what the app does (size codes in file names, the names of the three check choices)', () => {
  const naming = read('src/main/fileNaming.ts')
  const map = naming.slice(naming.indexOf('const SIZE_TOKEN_MAP'), naming.indexOf('}', naming.indexOf('const SIZE_TOKEN_MAP')))
  const codes = [...map.matchAll(/:\s*'([a-z]+)'/g)].map(m => m[1])
  assert.deepEqual(codes, ['o', 'xl', 'l', 'm', 's', 'sq'])
  const note = read('src/renderer/components/SettingsModal.tsx')
  for (const c of codes) assert.ok(new RegExp(`\\b${c}\\b`).test(note.slice(note.indexOf('Adds a short size code'), note.indexOf('Useful when downloading different sizes'))), `the note names ${c}`)
  assert.ok(/Issue, Warning and Off/.test(read('src/renderer/components/AlbumCheckSettings.tsx')))
  assert.ok(/label: 'Issue'/.test(read('src/renderer/components/TuneChecks.tsx')) && /label: 'Warning'/.test(read('src/renderer/components/TuneChecks.tsx')))
})

test('the copy edit (#268): one spelling, plain headings, loading words, empty lines that say what to do', () => {
  const fit = read('src/renderer/components/AlbumFitSettings.tsx') + read('src/renderer/components/LocationHintSettings.tsx')
  assert.ok(!/neighbour|Neighbourhood|metres/i.test(fit), 'American spelling in Tune checks')
  assert.ok(!/Grey means/.test(read('src/renderer/components/TimelinePanel.tsx')))
  const settings = read('src/renderer/components/SettingsModal.tsx')
  assert.ok(!/Notifications &amp; Dock|Rights &amp; provenance/.test(settings))
  const about = read('src/renderer/components/AboutModal.tsx') + read('src/renderer/components/ProblemModal.tsx') + read('src/renderer/pages/LoginPage.tsx')
  assert.ok(!/The Problem FlickrFetch Solves|Questions & Feedback|Releases & Issues/.test(about), 'one way of writing the names')
  assert.ok(!/Getting (sharper|bigger) pictures|Couldn't get these pictures/.test(read('src/renderer/components/ShareDialog.tsx')), 'Loading, not Getting')
  assert.ok(!/authorization code/i.test(read('src/renderer/pages/LoginPage.tsx')), 'the code is "the code from Flickr"')
  for (const f of ['AuditPanel', 'AlbumsPanel', 'HealthPanel', 'DuplicatesList', 'BackupPanel']) assert.ok(!/'Nothing here\.'|>Nothing here\.</.test(read(`src/renderer/components/${f}.tsx`)), `${f}: no bare "Nothing here."`)
  assert.ok(!/Smart Sync/.test(readFileSync(join(process.cwd(), 'README.md'), 'utf8')))
  assert.ok(changelog[0].highlights.every(h => h.length < 700), 'no bullet in the newest changelog entry is a wall of text')
})

test('the Settings wording (#268 C and H): our own words are out of the descriptions, and the headings say what they hold', () => {
  const settings = read('src/renderer/components/SettingsModal.tsx')
  const fit = read('src/renderer/components/AlbumFitSettings.tsx')
  assert.ok(!/cluster|outlier|spread/i.test(fit.slice(fit.indexOf('const NOT_FIT'), fit.indexOf('const BELONG'))), 'Album fit: no cluster, outliers or spread')
  assert.ok(!/batch/i.test(settings.slice(settings.indexOf('Show download progress'), settings.indexOf('Show download progress') + 400)), 'no "batch" in the General descriptions')
  assert.ok(/>Separator</.test(settings) && /Size code/.test(settings) && /Location \(GPS\)/.test(settings))
  assert.ok(!/Part separator|Size indicator|GPS coordinates|Title transform|Strip GPS from private/.test(settings), 'the old headings are gone')
  assert.ok(/Special characters are kept in file names by default/.test(settings), 'the brackets tip says special characters')
  assert.ok(/Leave GPS out of private photos/.test(settings) && />Clean-up</.test(settings))
  assert.ok(!/wraps around the core|resets at the start of each batch/.test(settings))
})

test('the review fixes: a menu over a disabled control keeps its clicks, an album called Photostream keeps its folder, Explore has the wave banner', () => {
  const host = read('src/renderer/ui/HoverCardHost.tsx')
  assert.ok(/function coveredByLayer/.test(host) && /if \(coveredByLayer\(el, top\)\) return false/.test(host), 'a layer over the control means the pointer is not on the control')
  const main = read('src/renderer/pages/MainPage.tsx')
  assert.ok(/isPhotostream \? '' : displayTitle/.test(main) && /'Photostream', 'Photostream', true\)/.test(main) && !/displayTitle === 'Photostream'/.test(main))
  assert.ok(/<WaveHeader>/.test(read('src/renderer/components/DiscoverExplore.tsx')), 'Explore uses the same banner as the other Discover screens')
  assert.ok(!/get your Flickr details/.test(read('src/main/flickr.ts')))
})

test('3.14 design passes: About says whose Flickr the link opens, and the Confirm download box shows what is left out', () => {
  const about = read('src/renderer/components/AboutModal.tsx')
  assert.ok(!/My Flickr<\/span>/.test(about) && /Photos by Wally/.test(about), 'the link opens the author\'s page, so it says whose')
  assert.ok(/This product uses the Flickr API but is not endorsed or certified by SmugMug, Inc\./.test(about), 'Flickr\'s own attribution words stay as they are')
  const confirm = read('src/renderer/components/DownloadConfirmModal.tsx')
  assert.ok(/Saved in each file:/.test(confirm) && /Not saved:/.test(confirm), 'one line for what is saved, one for what is left out')
  assert.ok(!/>Change settings</.test(confirm) && (confirm.match(/>Change</g) ?? []).length >= 3, 'each thing you can change has its own Change link')
})

test('About opens from the avatar menu as well as the Mac menu bar, both through the one handler in the main process', () => {
  const main = read('src/main/index.ts')
  assert.ok(/function showAbout\(\)/.test(main) && /ipcMain\.on\('app:openAbout', \(\) => showAbout\(\)\)/.test(main) && /label: 'About FlickrFetch',\s*click: \(\) => \{\s*showAbout\(\)/.test(main))
  assert.ok(/openAbout: \(\): void => ipcRenderer\.send\('app:openAbout'\)/.test(read('src/preload/index.ts')))
  const page = read('src/renderer/pages/MainPage.tsx')
  assert.ok(/window\.flickrAPI\.openAbout\(\)[\s\S]{0,80}About FlickrFetch/.test(page) && page.indexOf('About FlickrFetch</button>') < page.indexOf('>Sign out</button>'), 'above Sign out')
})

test('On This Day: the day buttons are never squeezed by the action buttons in a narrow window (the Tomorrow button was cut off)', () => {
  const src = read('src/renderer/components/OnThisDayPanel.tsx')
  assert.ok(/navSeg: \{[^}]*flexShrink: 0/.test(src), 'the Yesterday / Jump / Tomorrow group keeps its width')
  assert.ok(/headText: \{ flex: '1 1 auto'/.test(src), 'the heading block is as wide as its content, so the buttons wrap under it')
})

test('Cmd+F on the Map opens the Filters drawer and puts the cursor in the album box (#256)', () => {
  const map = read('src/renderer/components/MapPanel.tsx')
  assert.ok(/e\.key\.toLowerCase\(\) === 'f'[\s\S]{0,200}setDrawerOpen\(true\)[\s\S]{0,200}albumRef\.current\?\.focus\(\)/.test(map), 'Cmd+F opens the drawer then focuses the album box')
  assert.ok(/<AlbumBox inputRef=\{albumRef\}/.test(map) && /inputRef=\{inputRef\}|ref=\{inputRef\}/.test(read('src/renderer/components/AlbumBox.tsx')))
})

test('the Issue mark is the darker red ink (red against amber was too close for red-green colour blindness, #238)', () => {
  assert.ok(/export const COLORS = \{ open: 'var\(--ff-error-ink\)'/.test(read('src/renderer/components/DashboardParts.tsx')))
  assert.ok(/--ff-error-ink: *#B91C1C/.test(read('src/renderer/index.html')), 'the ink is the brand guide\'s #B91C1C')
})
