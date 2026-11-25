import type { DownloadedSize } from '../shared/types'

// How many photos in the running batch came down smaller than the Original that was asked for (#126). The batch queue runs one batch at a time:
// it starts a new tally before each one, every photo's size is passed through note(), and the batch's progress messages carry the total.
let smaller = 0

export function resetSizeTally(): void { smaller = 0 }

/** Counts the photo when its size is a limited one, and gives the size back unchanged. */
export function noteSize(size: DownloadedSize): DownloadedSize {
  if (size.limited) smaller++
  return size
}

export function smallerSoFar(): number { return smaller }
