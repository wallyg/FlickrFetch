# Spacing audit (for #241, written 26 Nov 2026)

Measured before deciding on a scale, as the 3.14 plan says. Every `padding`, `margin` and `gap` written in a screen's style (about 1,160 style lines, 1,694 individual sizes) was counted. Nothing was changed.

## What it shows

- **35 different sizes are in use.** The 8 most common cover 76% of everything and the 12 most common cover 89%; the other 23 sizes share the last 11%.
- **0 is the most common value** (271 times: a reset). After that: 8 (222), 6 (186), 4 (156), 10 (151), 12 (131), 2 (94), 16 (78), 24 (72), 5 (64), 14 (45), 20 (37).
- **6 and 10 are heavily used** (337 times between them, 20% of all) but sit between the usual 4-pixel steps. They are not mistakes: they are how the screens were actually built.
- **Odd one-offs:** 1, 3, 7, 9, 11, 13, 18, 22, 26, 28, 30, 36, 40, 48, 56, 60, 70, 72 and a few negative values (used to pull things closer) together account for about 11% of the sizes.
- **The busiest screens use the most sizes:** photo detail and Settings (19 each), Audit, History, On This Day and the main page (17 each).

## Options for a scale

| Option | Steps | Share of today's sizes already on it | What changes |
|---|---|---|---|
| A. Keep what is common | 0, 2, 4, 6, 8, 12, 16, 24, 32 | about 71% | 10 moves to 8 or 12, 5 to 4 or 6, 14 to 12 or 16, 20 to 16 or 24; the one-offs move to the nearest step |
| B. Strict 4-pixel grid | 0, 4, 8, 12, 16, 24, 32 | about 55% | 6 and 10 (20% of everything) and 2 also move, so many small gaps shift by 2 px |
| C. Strict 8-pixel grid | 0, 8, 16, 24, 32 | about 38% | most small gaps double or halve; a real redesign of density |

Recommendation: **A**. It keeps about 70% of the app's spacing exactly as it is today, so the sweep changes little and is easy to check (nearly three quarters of today's sizes already sit on it), and it still removes the 23 stray sizes. B or C would change the look of nearly every screen and need the owner to look at each.

## The numbers

### Padding: 851 values, 28 different sizes

| Size (px) | Times used | In how many files | Share |
|---|---|---|---|
| 0 | 99 | 41 | 12% |
| 8 | 94 | 33 | 11% |
| 10 | 71 | 41 | 8% |
| 6 | 70 | 33 | 8% |
| 4 | 68 | 32 | 8% |
| 24 | 63 | 28 | 7% |
| 12 | 63 | 29 | 7% |
| 16 | 51 | 20 | 6% |
| 2 | 43 | 23 | 5% |
| 5 | 39 | 21 | 5% |
| 20 | 32 | 12 | 4% |
| 7 | 26 | 15 | 3% |
| 14 | 23 | 20 | 3% |
| 3 | 19 | 12 | 2% |
| 9 | 17 | 13 | 2% |
| 1 | 16 | 13 | 2% |
| 18 | 11 | 9 | 1% |
| 48 | 9 | 4 | 1% |
| 10 more sizes | 37 | | 4% |

Used only once or twice: 56, 70, 72

### Margin: 481 values, 24 different sizes

| Size (px) | Times used | In how many files | Share |
|---|---|---|---|
| 0 | 166 | 38 | 35% |
| 8 | 61 | 30 | 13% |
| 4 | 52 | 27 | 11% |
| 6 | 47 | 26 | 10% |
| 2 | 33 | 16 | 7% |
| 10 | 27 | 16 | 6% |
| 12 | 22 | 18 | 5% |
| 14 | 13 | 8 | 3% |
| 24 | 9 | 7 | 2% |
| 1 | 8 | 4 | 2% |
| 3 | 6 | 6 | 1% |
| 16 | 6 | 6 | 1% |
| 5 | 6 | 4 | 1% |
| 20 | 5 | 4 | 1% |
| -20 | 4 | 1 | 1% |
| -1 | 4 | 4 | 1% |
| 18 | 4 | 3 | 1% |
| 22 | 2 | 1 | 0% |
| 6 more sizes | 6 | | 1% |

Used only once or twice: -40, -36, 7, 22, 26, 28, 32

### Gap: 362 values, 16 different sizes

| Size (px) | Times used | In how many files | Share |
|---|---|---|---|
| 6 | 69 | 34 | 19% |
| 8 | 67 | 37 | 19% |
| 10 | 53 | 32 | 15% |
| 12 | 46 | 26 | 13% |
| 4 | 36 | 18 | 10% |
| 16 | 21 | 18 | 6% |
| 5 | 19 | 10 | 5% |
| 2 | 18 | 14 | 5% |
| 14 | 9 | 7 | 2% |
| 3 | 8 | 7 | 2% |
| 0 | 6 | 6 | 2% |
| 7 | 5 | 4 | 1% |
| 9 | 2 | 2 | 1% |
| 30 | 1 | 1 | 0% |
| 18 | 1 | 1 | 0% |
| 26 | 1 | 1 | 0% |

Used only once or twice: 9, 18, 26, 30

## How it was measured
Every style entry named padding, margin, gap (and their top, bottom, left, right, row and column forms) in the renderer's .tsx files was read with the TypeScript compiler, and every pixel value in it counted (a shorthand such as "6px 12px" counts both). Values written as variables, percentages or em were not counted. Spacing set in index.html (the page itself) was not included.
