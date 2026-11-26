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
