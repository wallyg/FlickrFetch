import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSettings, loadSettingsCached, saveSettings } from '../src/main/settings'

// The map asks for the settings for every street map square, so the file is only read again when it has changed.
test('the settings are read once, handed back as they were, and read again as soon as the file changes', () => {
  const base = loadSettings()
  saveSettings({ ...base, mapStreet: true })
  const a = loadSettingsCached(), b = loadSettingsCached()
  assert.equal(a.mapStreet, true)
  assert.equal(a, b)                                                  // the same object: nothing was read the second time
  saveSettings({ ...base, mapStreet: false })                         // a change (even the same length of file) is seen straight away
  assert.equal(loadSettingsCached().mapStreet, false)
  saveSettings({ ...base, mapStreet: true, mapCacheMb: 50 })
  const c = loadSettingsCached()
  assert.equal(c.mapStreet, true); assert.equal(c.mapCacheMb, 50)
})
