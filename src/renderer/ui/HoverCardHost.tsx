import React, { useEffect, useState } from 'react'
import HoverCard from './HoverCard'

// Gives every tip in the app the one hover card (#228), without each control having to ask for it. Mounted once, at the top of the page.
//
// - `title="..."` on any element: the browser's own tip (slow, grey, cut off by scrolling boxes, wraps badly) is swapped for the card. The title is
//   taken off the element while the card is up, and put back after, so nothing else sees a change.
// - `data-tip="..."` on any element: the same card, for longer explanations (HoverNote, InfoTip). `data-tip-anchor` on something inside says where
//   the card sits (the small (i)); without it the card sits against the element itself.
//
// The card comes from the mouse after a short pause (straight away when you are moving from one tip to the next) and from the keyboard
// when a control gets focus by Tab. It goes away on click, scroll, any key but Tab, or when the pointer leaves. It works on disabled controls
// and on text that is cut off, because it reads the element, not the browser's idea of what to show.

const DELAY_MS = 250      // pause before the first card
const CHAIN_MS = 400      // moving from one tip to the next within this time skips the pause
const KEEP_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta'])

interface Shown { anchorEl: Element; text: string; pointerX: number | null }

function tipOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('[data-tip],[title]') : null
}
// A disabled control gets no pointer events from the browser, so (with pointer-events: none from index.html) it is found by where the pointer is.
// It only counts when it is really under the pointer: not covered by a dialog that opened over its screen, and not scrolled out of view inside a box that clips it.
let candidates: Element[] = []
let candidatesAt = 0
// A pop-up menu (a fixed or layered box that does not hold the control) drawn over the control: the pointer is on the menu, not on the control, and the menu's clicks must go through
function coveredByLayer(el: Element, top: Element): boolean {
  if (top === el || top.contains(el)) return false
  for (let a: Element | null = top; a && a !== document.body && !a.contains(el); a = a.parentElement) {
    const cs = getComputedStyle(a)
    if (cs.position === 'fixed' || (cs.position === 'absolute' && cs.zIndex !== 'auto')) return true
  }
  return false
}
function reachable(el: Element, x: number, y: number): boolean {
  const top = document.elementFromPoint(x, y)
  if (!top) return false
  if (coveredByLayer(el, top)) return false
  if ((el.closest('[data-dialog]') ?? null) !== (top.closest('[data-dialog]') ?? null)) return false   // a dialog is over it (or it is in one and the pointer is outside)
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const cs = getComputedStyle(a)
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
    const r = a.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false                             // scrolled out of its box
  }
  return true
}
function disabledAt(x: number, y: number): Element | null {
  const now = Date.now()
  if (now - candidatesAt > 300) { candidates = Array.from(document.querySelectorAll('[disabled][title],[disabled][data-tip]')); candidatesAt = now }   // not a whole-page search on every pointer move
  for (const el of candidates) {
    if (!el.isConnected) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && reachable(el, x, y)) return el
  }
  return null
}
function textOf(el: Element): string { return (el.getAttribute('data-tip') ?? el.getAttribute('title') ?? '').trim() }

export default function HoverCardHost(): React.JSX.Element | null {
  const [shown, setShown] = useState<Shown | null>(null)

  useEffect(() => {
    let current: { el: Element; title: string | null; label: boolean } | null = null
    let timer: number | null = null
    let pending: Element | null = null      // the control whose card is about to appear
    let lastHide = 0
    let frame = 0

    const clearTimer = (): void => { if (timer !== null) { window.clearTimeout(timer); timer = null }; pending = null }
    const hide = (): void => {
      clearTimer()
      document.documentElement.removeAttribute('data-over-disabled')
      const c = current
      if (!c) return
      current = null
      // Put back what was taken off (unless the page has set a new title in the meantime)
      if (c.title !== null && !c.el.hasAttribute('title')) c.el.setAttribute('title', c.title)
      if (c.label) c.el.removeAttribute('aria-label')
      lastHide = Date.now()
      setShown(null)
    }
    const show = (el: Element, pointerX: number | null): void => {
      if (!el.isConnected) return
      const text = textOf(el)
      if (!text) return
      let title: string | null = null
      let label = false
      // A disabled control keeps its title: the pointer passes through it (index.html), so the browser shows no tip of its own, and the title is how it is found
      if (!el.hasAttribute('data-tip') && !el.hasAttribute('disabled')) {
        title = el.getAttribute('title')
        el.removeAttribute('title')
        // A control named only by its title (an icon button) keeps its name for screen readers while the title is off it
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !(el.textContent ?? '').trim()) { el.setAttribute('aria-label', text); label = true }
      }
      current = { el, title, label }
      const anchorEl = el.querySelector('[data-tip-anchor]') ?? el
      setShown({ anchorEl, text, pointerX })
    }

    // Start the card for a control: straight away when moving on from another card, after a short pause otherwise
    const begin = (el: Element, x: number): void => {
      hide()
      if (!textOf(el)) return
      if (el.hasAttribute('disabled')) document.documentElement.setAttribute('data-over-disabled', '')
      if (Date.now() - lastHide < CHAIN_MS) { show(el, x); return }
      pending = el
      timer = window.setTimeout(() => { timer = null; pending = null; show(el, x) }, DELAY_MS)
    }
    const over = (e: MouseEvent): void => {
      const el = disabledAt(e.clientX, e.clientY) ?? tipOf(e.target)
      if (el && (el === current?.el || el === pending)) return
      if (!el) { hide(); return }
      begin(el, e.clientX)
    }
    // Leaving a disabled control sends no event, so it is noticed as the pointer moves
    const move = (e: MouseEvent): void => {
      if (frame) return
      const { clientX: x, clientY: y } = e
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const d = disabledAt(x, y)
        if (d) { if (d !== current?.el && d !== pending) begin(d, x) }
        else if (current?.el.hasAttribute('disabled') || pending?.hasAttribute('disabled')) hide()
      })
    }
    const out = (e: MouseEvent): void => {
      const to = e.relatedTarget
      const from = tipOf(e.target)
      if (!from) return
      if (to instanceof Node && from.contains(to)) return   // still on the same control (moving onto something inside it)
      hide()
    }
    const focusIn = (e: FocusEvent): void => {
      const el = tipOf(e.target)
      hide()
      // Only for keyboard focus; clicking a button also focuses it, and that should not leave a card behind
      if (el && e.target instanceof Element && e.target.matches(':focus-visible')) show(el, null)
    }
    const key = (e: KeyboardEvent): void => { if (!KEEP_KEYS.has(e.key)) hide() }

    // A disabled control lets the pointer through, so a click on it must not reach what is underneath (a row or tile that opens when clicked)
    const swallow = (e: MouseEvent): void => {
      if (disabledAt(e.clientX, e.clientY)) { e.stopPropagation(); e.preventDefault(); hide() }
    }
    const SWALLOWED = ['click', 'dblclick', 'auxclick', 'contextmenu', 'mousedown', 'mouseup'] as const
    for (const n of SWALLOWED) document.addEventListener(n, swallow, true)
    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', out)
    document.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mousedown', hide)
    document.addEventListener('focusin', focusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('keydown', key)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('wheel', hide, { passive: true })
    window.addEventListener('blur', hide)
    window.addEventListener('resize', hide)
    return () => {
      hide()
      for (const n of SWALLOWED) document.removeEventListener(n, swallow, true)
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mouseout', out)
      document.removeEventListener('mousemove', move)
      window.cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', hide)
      document.removeEventListener('focusin', focusIn)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('keydown', key)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('wheel', hide)
      window.removeEventListener('blur', hide)
      window.removeEventListener('resize', hide)
    }
  }, [])

  return shown ? <HoverCard anchorEl={shown.anchorEl} pointerX={shown.pointerX} text={shown.text} /> : null
}
