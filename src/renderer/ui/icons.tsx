import React from 'react'

// Small line icons for the quiet buttons. They take the text colour, so a button decides how they look.

const base = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export const BarsIcon = (): React.JSX.Element => (   // "more detail on hover": a tiny bar chart
  <svg {...base}><path d="M3 13V8M8 13V3M13 13V6" /></svg>
)
export const OpenIcon = (): React.JSX.Element => (   // open in the Photostream: a box with an arrow out
  <svg {...base}><path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" /></svg>
)
export const DownloadIcon = (): React.JSX.Element => (
  <svg {...base}><path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" /></svg>
)
export const UpIcon = (): React.JSX.Element => (
  <svg {...base} width={18} height={18}><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>
)
export const CameraRollIcon = (): React.JSX.Element => (
  <svg {...base}><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><path d="M2.5 10l3-3 3 3 2-2 3 3" /></svg>
)
