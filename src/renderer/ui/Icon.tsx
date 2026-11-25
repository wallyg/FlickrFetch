import React from 'react'

// The app's one icon set (#229): line icons on a 16 px grid, drawn at a 1.5 px stroke with round ends and corners, in the colour of the text around them
// (currentColor). It replaces the emoji and the plain characters that used to do icon work (the cross, the tick, the arrows), so every icon matches.
// The size follows the text it sits in (1em); give `size` for a fixed one. The stroke stays 1.5 px at any size.

const P = ({ d }: { d: string }): React.JSX.Element => <path d={d} vectorEffect="non-scaling-stroke" />
const C = ({ cx, cy, r }: { cx: number; cy: number; r: number }): React.JSX.Element => <circle cx={cx} cy={cy} r={r} vectorEffect="non-scaling-stroke" />
const B = ({ x, y, w, h, rx }: { x: number; y: number; w: number; h: number; rx: number }): React.JSX.Element => <rect x={x} y={y} width={w} height={h} rx={rx} vectorEffect="non-scaling-stroke" />

const PATHS: Record<string, React.JSX.Element> = {
  close: <P d="M4 4l8 8M12 4l-8 8" />,
  check: <P d="M3.5 8.5l3 3 6-6.5" />,
  arrowDown: <P d="M8 2.5v10.5M4 9l4 4 4-4" />,
  arrowUp: <P d="M8 13.5V3M4 7l4-4 4 4" />,
  arrowRight: <P d="M2.5 8h11M9.5 4l4 4-4 4" />,
  arrowLeft: <P d="M13.5 8h-11M6.5 4l-4 4 4 4" />,
  external: <P d="M5 11l6-6M6 4.5h5.5V10" />,
  chevronLeft: <P d="M10 3.5L5.5 8l4.5 4.5" />,
  chevronRight: <P d="M6 3.5L10.5 8 6 12.5" />,
  chevronDown: <P d="M3.5 6l4.5 4.5L12.5 6" />,
  return: <P d="M4 2.5v6.5h8M9 6l3 3-3 3" />,
  refresh: <P d="M12.8 3v3.2H9.6M12.6 6.2A5 5 0 1 0 13 8.5" />,
  warning: <><P d="M8 2.2l6.2 11H1.8z" /><P d="M8 6.5v3.2M8 11.6v.1" /></>,
  lock: <><B x={3.2} y={7} w={9.6} h={6.8} rx={1.6} /><P d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7" /></>,
  calendar: <><B x={2.3} y={3.4} w={11.4} h={10.2} rx={1.6} /><P d="M2.3 6.6h11.4M5.4 2v2.6M10.6 2v2.6" /></>,
  bell: <><P d="M3.8 11.2V7.4a4.2 4.2 0 0 1 8.4 0v3.8l1.1 1.5H2.7z" /><P d="M6.7 14.2a1.5 1.5 0 0 0 2.6 0" /></>,
  tag: <><P d="M2.4 8.3V2.4h5.9l5.4 5.4-5.9 5.9z" /><P d="M5.4 5.4v.1" /></>,
  clock: <><C cx={8} cy={8} r={5.6} /><P d="M8 4.8V8l2.1 1.4" /></>,
  pin: <><P d="M8 14.2s4.6-4.1 4.6-7.6a4.6 4.6 0 0 0-9.2 0c0 3.5 4.6 7.6 4.6 7.6z" /><C cx={8} cy={6.6} r={1.6} /></>,
  switches: <><B x={1.5} y={2} w={13} h={5} rx={2.5} /><C cx={11.5} cy={4.5} r={1.1} /><B x={1.5} y={9} w={13} h={5} rx={2.5} /><C cx={4.5} cy={11.5} r={1.1} /></>,
  computer: <><B x={2} y={2.5} w={12} h={8} rx={1.5} /><P d="M5.5 13.5h5M8 10.5v3" /></>,
  person: <><C cx={8} cy={5.3} r={2.6} /><P d="M2.8 14c0-3 2.4-4.8 5.2-4.8s5.2 1.8 5.2 4.8" /></>,
  pulse: <P d="M1.5 8h3l2-5.2 3 10.2 2-5h3" />,
  cog: <><P d="M6.71 3.17 L6.97 1.48 L9.03 1.48 L9.29 3.17 L10.50 3.67 L11.88 2.66 L13.34 4.12 L12.33 5.50 L12.83 6.71 L14.52 6.97 L14.52 9.03 L12.83 9.29 L12.33 10.50 L13.34 11.88 L11.88 13.34 L10.50 12.33 L9.29 12.83 L9.03 14.52 L6.97 14.52 L6.71 12.83 L5.50 12.33 L4.12 13.34 L2.66 11.88 L3.67 10.50 L3.17 9.29 L1.48 9.03 L1.48 6.97 L3.17 6.71 L3.67 5.50 L2.66 4.12 L4.12 2.66 L5.50 3.67Z" /><C cx={8} cy={8} r={2} /></>
}

export type IconName = keyof typeof PATHS

export default function Icon({ name, size, style }: { name: IconName; size?: number | string; style?: React.CSSProperties }): React.JSX.Element {
  const s = size ?? '1em'
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0, ...style }}>
      {PATHS[name]}
    </svg>
  )
}
