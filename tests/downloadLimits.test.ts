import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, writePhotoRecord, searchPhotoRecords, getPhotoRecord } from '../src/main/database'
import { describeSize } from '../src/main/downloader'
import { noteSize, resetSizeTally, smallerSoFar } from '../src/main/sizeTally'
import { isFreeAccount, limitNotice, sizeTag, smallerPart } from '../src/shared/downloadLimits'
import type { PhotoSize } from '../src/shared/types'

// Flickr's size limit on free accounts (#126, Phase 1): what the Confirm Download box says, the count after a download, and the tag in Download History.
before(() => { openDatabase('test@N00') })

test('only an account Flickr said is not Pro counts as free: an unknown answer assumes nothing', () => {
  assert.equal(isFreeAccount(false), true)
  assert.equal(isFreeAccount(true), false)
  assert.equal(isFreeAccount(undefined), false)             // the lookup failed (offline, throttled): no note for what may be a Pro account
  assert.equal(isFreeAccount(true, true), true)             // the development-only switch pretends
  assert.equal(isFreeAccount(undefined, true), true)
})

test('a Pro account never sees the note, whatever size it asks for', () => {
  assert.deepEqual(limitNotice(false, 'original', 'Original'), { quality: 'Original', callout: null })
  assert.deepEqual(limitNotice(false, 'large', 'Large'), { quality: 'Large', callout: null })
})

test('a free account asking for the Original is told about the 1024 px limit, and that the metadata is still saved', () => {
  const n = limitNotice(true, 'original', 'Original')
  assert.equal(n.quality, 'Original (up to 1024 px on your account)')
  assert.match(n.callout ?? '', /1024 px/)
  assert.match(n.callout ?? '', /still saved in every file/)
  assert.match(n.callout ?? '', /Creative Commons/)
})

test('a free account that asks for a smaller size on purpose is not warned about the Original', () => {
  for (const size of ['xlarge', 'large', 'medium', 'small', 'square']) assert.deepEqual(limitNotice(true, size, 'X'), { quality: 'X', callout: null })
})

test('the summary words appear only when something came down smaller', () => {
  assert.equal(smallerPart(undefined), null)
  assert.equal(smallerPart(0), null)
  assert.equal(smallerPart(1), '1 saved smaller than the original')
  assert.equal(smallerPart(1234), `${(1234).toLocaleString()} saved smaller than the original`)
})

test('the History tag: Smaller size, Original, or nothing', () => {
  assert.equal(sizeTag({ sizeLabel: 'Large', sizeLimited: true }), 'Smaller size')
  assert.equal(sizeTag({ sizeLabel: 'Original', sizeLimited: false }), 'Original')
  assert.equal(sizeTag({ sizeLabel: 'Large', sizeLimited: false }), null)   // a size chosen on purpose
  assert.equal(sizeTag({ sizeLabel: '', sizeLimited: false }), null)        // downloaded before sizes were recorded
  assert.equal(sizeTag({}), null)
})

const size = (label: string, media: PhotoSize['media'] = 'photo'): PhotoSize => ({ label, width: 1024, height: 768, source: 'x', media })
test('the batch tally counts photos that came down smaller, and starts again for each batch', () => {
  resetSizeTally()
  const full = describeSize([size('Large 1600'), size('Original')], 'original')
  const cut = describeSize([size('Large'), size('Medium')], 'original')           // the Original was asked for and not offered
  const chosen = describeSize([size('Large'), size('Medium')], 'large')           // a smaller size on purpose
  const video = describeSize([size('Site MP4', 'video'), size('Video Original', 'video')], 'original')
  for (const s of [full, cut, chosen, video]) assert.equal(noteSize(s), s)         // handed back unchanged
  assert.equal(smallerSoFar(), 1)
  noteSize(cut)
  assert.equal(smallerSoFar(), 2)
  resetSizeTally()
  assert.equal(smallerSoFar(), 0)
})

test('the download record keeps the size outcome, and a read-back carries it to the History tag', () => {
  writePhotoRecord('full1', 1, 'Whole', '', { label: 'Original', width: 4000, height: 3000, limited: false })
  writePhotoRecord('cut1', 1, 'Cut', '', { label: 'Large', width: 1024, height: 768, limited: true })
  writePhotoRecord('old1', 1, 'Old')                                                // from before sizes were recorded
  const byId = new Map(searchPhotoRecords({}).map(r => [r.photoId, r]))
  assert.equal(sizeTag(byId.get('full1')!), 'Original')
  assert.equal(sizeTag(byId.get('cut1')!), 'Smaller size')
  assert.equal(sizeTag(byId.get('old1')!), null)
  assert.deepEqual({ l: getPhotoRecord('cut1')!.sizeLabel, x: getPhotoRecord('cut1')!.sizeLimited }, { l: 'Large', x: true })
})
