// Keeps a hover or click note inside the window. A note starts lined up with the left edge of its icon or button; this says how far to move it
// sideways (negative = left) so that it stays 8 px inside both edges of the window. Moving only as far as needed keeps it beside what it explains,
// and the left edge is never pushed off the screen, even in a narrow window.
export function sideShift(anchorLeft: number, noteWidth: number, windowWidth: number): number {
  const left = Math.max(8, Math.min(anchorLeft, windowWidth - 8 - noteWidth))
  return left - anchorLeft
}
