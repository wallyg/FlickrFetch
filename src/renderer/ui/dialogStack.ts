// Which dialog is on top, and where Tab goes inside one. Kept apart from the screen code so it can be tested.

const stack: number[] = []
let next = 1

/** A dialog opening takes the top place; give the number back to popDialog when it closes. */
export function pushDialog(): number { const id = next++; stack.push(id); return id }
export function popDialog(id: number): void { const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1) }
/** How many dialogs are open up to and including this one (1 for the first). A dialog opened later sits above the ones already open, whichever is written first in the page. */
export function depthOf(id: number): number { return stack.indexOf(id) + 1 }
/** Only the dialog on top answers Esc, so a note opened over About closes first and About stays. */
export function isTopDialog(id: number): boolean { return stack[stack.length - 1] === id }

/** Where Tab (or Shift+Tab) lands among `count` focusable things inside a dialog, going round at the ends. -1 when there is nothing to focus. */
export function nextFocusIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1
  if (current < 0) return backwards ? count - 1 : 0
  return (current + (backwards ? -1 : 1) + count) % count
}
