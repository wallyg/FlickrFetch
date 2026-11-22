import React, { useMemo } from 'react'
import { parseDescription, type DescNode } from '../../shared/description'

// Draws a Flickr description: links, bold, italic, line breaks and simple lists.
// Built from React elements for an allowed set of tags, never by inserting Flickr's HTML into the page,
// so nothing else in a description can run or load. Links open in the default browser.

function renderNodes(nodes: DescNode[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    if (n.t === 'text') return n.v
    if (n.t === 'br') return <br key={i} />
    const kids = renderNodes(n.children)
    switch (n.tag) {
      case 'a': {
        const href = n.href ?? ''
        return (
          <a
            key={i}
            href={href}
            title={href}
            style={{ color: 'var(--ff-blue)', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={e => { e.preventDefault(); window.flickrAPI.openExternal(href) }}
          >{kids}</a>
        )
      }
      case 'b': return <strong key={i}>{kids}</strong>
      case 'i': return <em key={i}>{kids}</em>
      case 'ul': return <ul key={i} style={{ margin: '4px 0', paddingLeft: '18px' }}>{kids}</ul>
      case 'li': return <li key={i}>{kids}</li>
      case 'p': return <div key={i} style={{ margin: '0 0 6px' }}>{kids}</div>
    }
  })
}

export default function DescriptionView({ html, style }: { html: string; style?: React.CSSProperties }): React.JSX.Element {
  const nodes = useMemo(() => parseDescription(html), [html])
  // pre-wrap keeps the line breaks Flickr stores as plain newlines
  return <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...style }}>{renderNodes(nodes)}</div>
}
