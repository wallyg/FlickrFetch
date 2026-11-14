import React, { useId } from 'react'

interface WaveBandProps {
  height: number | string
  // Soft version for sitting behind text (headers); the default is the full-strength brand look
  ghost?: boolean
  // Pins the band to the bottom of a position:relative parent
  style?: React.CSSProperties
}

// Brand wave motif (see assets/brand/wave-texture.png): three overlapping translucent ribbons
// fading from Flickr blue (left) to pink (right). Drawn as SVG so it stays crisp at any size.
export default function WaveBand({ height, ghost = false, style }: WaveBandProps): React.JSX.Element {
  const id = useId().replace(/:/g, '')
  const [a, b, c] = ghost ? [0.12, 0.2, 0.32] : [0.26, 0.48, 0.85]
  return (
    <svg
      viewBox="0 0 600 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height, pointerEvents: 'none', ...style }}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8CB4E8" />
          <stop offset="1" stopColor="#FF85BB" />
        </linearGradient>
      </defs>
      <path d="M0 44 C110 20 200 62 320 40 C430 20 520 40 600 24 L600 120 L0 120Z" fill={`url(#${id})`} opacity={a} />
      <path d="M0 64 C120 38 210 82 330 60 C440 40 530 58 600 48 L600 120 L0 120Z" fill={`url(#${id})`} opacity={b} />
      <path d="M0 88 C130 62 220 104 340 84 C450 66 540 80 600 72 L600 120 L0 120Z" fill={`url(#${id})`} opacity={c} />
    </svg>
  )
}
