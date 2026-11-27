// The spacing scale (#241, approved 26 Nov 2026, measured in docs/design/spacing-audit.md): every padding, margin and gap is one of these, in pixels.
// A size above the top step (a hero space, a page margin) is a layout dimension, not a gap, and is free. tests/spacingGuard.test.ts keeps the scale:
// it counts the sizes still off it, file by file, and the counts only go down.
export const SPACING_SCALE = [0, 2, 4, 6, 8, 12, 16, 24, 32] as const
export const SPACING_TOP = 32
