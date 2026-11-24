import React from 'react'

// The text of a note, laid out as short rules. A line that starts with "# " is a heading, "- " is a bullet ("  - " a bullet
// inside a bullet), a blank line is a gap, anything else is a plain line. Notes written as plain text with line breaks still
// read the same, so every tooltip in the app can use this.

export default function RichNote({ text }: { text: string }): React.JSX.Element {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />
        const heading = /^# (.*)$/.exec(line)
        if (heading) return <div key={i} style={{ fontWeight: 700, marginTop: i === 0 ? 0 : 8 }}>{heading[1]}</div>
        const bullet = /^(\s*)- (.*)$/.exec(line)
        if (bullet) {
          const depth = Math.floor(bullet[1].length / 2)
          return (
            <div key={i} style={{ display: 'flex', gap: 6, paddingLeft: depth * 14, marginTop: 2 }}>
              <span aria-hidden="true" style={{ flex: 'none' }}>{depth > 0 ? '–' : '•'}</span>
              <span style={{ minWidth: 0 }}>{bullet[2]}</span>
            </div>
          )
        }
        return <div key={i}>{line}</div>
      })}
    </>
  )
}
