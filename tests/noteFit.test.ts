import test from 'node:test'
import assert from 'node:assert/strict'
import { sideShift } from '../src/renderer/ui/noteFit'

// Hover and click notes stay inside the window (#263): they start lined up with their icon, and slide sideways only as far as they must.
test('a note that fits stays lined up with its icon', () => {
  assert.equal(sideShift(100, 300, 1200), 0)
})

test('near the right edge the note slides left just enough to keep an 8 px margin', () => {
  assert.equal(sideShift(1100, 300, 1200), -208)   // its left edge goes to 892, its right edge to 1192
})

test('in a narrow window the note is never pushed off the left edge', () => {
  // an icon at x=300 in a 592 px window with a 440 px note: moving left to fit the right edge puts the left edge at 144, which is fine,
  assert.equal(sideShift(300, 440, 592), -156)
  // but a note wider than the room starts at 8 px, never off the screen
  assert.equal(sideShift(300, 600, 592), -292)
})

test('an icon near the left edge keeps its margin', () => {
  assert.equal(sideShift(2, 300, 1200), 6)
})
