import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { privacyLevelOf } from '../src/shared/privacy'

// "Friends & Family" on screen is the same set of photos the album download takes.
test('every level of the Privacy filter can be told from Flickr\'s three flags', () => {
  assert.equal(privacyLevelOf({ ispublic: 1, isfriend: 0, isfamily: 0 }), 'public')
  assert.equal(privacyLevelOf({ ispublic: 0, isfriend: 1, isfamily: 0 }), 'friends')
  assert.equal(privacyLevelOf({ ispublic: 0, isfriend: 0, isfamily: 1 }), 'family')
  assert.equal(privacyLevelOf({ ispublic: 0, isfriend: 1, isfamily: 1 }), 'friendsFamily')
  assert.equal(privacyLevelOf({ ispublic: 0, isfriend: 0, isfamily: 0 }), 'private')
  assert.equal(privacyLevelOf({}), 'public')   // other people's photos come with no flags
})

test('the grids and the album download use the one rule', () => {
  const grid = readFileSync(join(process.cwd(), 'src/renderer/components/PhotoGridShared.tsx'), 'utf8')
  const main = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
  assert.ok(/getPrivacyLevel\(photo: FlickrPhoto\): PrivacyLevel \{\s*return privacyLevelOf\(photo\)/.test(grid))
  assert.ok(/privacyLevelOf\(p\) === privacyFilter/.test(main))
  assert.ok(!/getPrivacyLevel\s*=/.test(main), 'the download has no privacy rule of its own')
})
