import { ipcMain, clipboard } from 'electron'
import type { BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import type Database from 'better-sqlite3'
import { getDb } from './database'
import { ownerNsid } from './owner'
import enableWords from './data/enable1.txt?raw'
import { csvCell, saveCsvFile } from './csv'
import { cleanTag, foldLatinAccents, GLUE_BOUNDARY_SOURCE } from '../shared/tags'
import { decodeEntities } from '../shared/description'
import { loadSettings } from './settings'
import { photoCards } from './photoCards'
import { ruleState, DEFAULT_GENERIC_WORDS } from '../shared/cleanupRules'
import { detectMissingTags, missingSettings } from './missingTags'
import { detectPlurals } from './pluralTags'
import { detectPossessives } from './possessiveTags'
import { clearFineReason } from './fineReasons'
import { isCameraTag } from '../shared/cameraNames'
import type {
  AuditCategory, AuditConfidence, AuditExportQuery, AuditFinding, AuditListPage, AuditListQuery, AuditPlanRow,
  AuditOverview, AuditSetRequest, AuditStatus, AuditSummary, MissingTagStats
} from '../shared/types'

// Tag audit: reads the local tag index and lists likely problems by type. Read-only: nothing here
// changes Flickr or any file. The user's choices (add to plan, this one is fine) are kept in the
// local database so they survive scans.

interface TagRecord { id: number; name: string; display: string; count: number; raws: string[] }
type Finding = Omit<AuditFinding, 'flickrUrl'>      // what the detection and the cache hold
type Draft = Omit<Finding, 'status'>

export const AUDIT_CATEGORIES: AuditCategory[] = ['glued', 'typo', 'notwin', 'noaccent', 'junk', 'runon', 'spelling', 'usedonce', 'generic', 'numbers', 'filename', 'missing', 'plural', 'possessive']

// ── Word list (to tell real words from slips) ────────────────────────────────
// The bundled public-domain list, plus the Mac's own list when it exists on this computer.
let wordSet: Set<string> | null = null
function realWords(): Set<string> {
  if (wordSet) return wordSet
  const set = new Set<string>()
  for (const w of enableWords.split('\n')) if (w) set.add(w.trim().toLowerCase())
  try {
    for (const w of readFileSync('/usr/share/dict/words', 'utf-8').split('\n')) if (w) set.add(w.trim().toLowerCase())
  } catch { /* not a Mac, or the file is gone: the bundled list is enough */ }
  wordSet = set
  return set
}

// Characters that are awkward to type in source, built from code points
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd)
const MOJIBAKE = new RegExp(`[${String.fromCharCode(0xc3, 0xc2, 0xe3, 0xe2)}][${String.fromCharCode(0x80)}-${String.fromCharCode(0xbf)}]`)

// ── Detection ────────────────────────────────────────────────────────────────

const isMachine = (t: TagRecord): boolean => t.name.includes(':')
const rawsOf = (t: TagRecord): string[] => (t.raws.length ? t.raws : [t.display])
const lettersOnly = (s: string): boolean => /^\p{L}+$/u.test(s)
const alnumOnly = (s: string): boolean => /^[\p{L}\p{N}]+$/u.test(s)
const sameCase = (orig: string, lower: string): string =>
  orig.length > 1 && orig === orig.toUpperCase() ? lower.toUpperCase()
    : orig[0] !== orig[0].toLowerCase() ? lower[0].toUpperCase() + lower.slice(1) : lower
const order: Record<AuditConfidence, number> = { high: 0, medium: 1, low: 2 }

function dl1(a: string, b: string): boolean {
  if (a === b) return false
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > 1) return false
  if (la === lb) {
    const diff: number[] = []
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff.push(i)
    if (diff.length === 1) return true
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]
  }
  const [shorter, longer] = la < lb ? [a, b] : [b, a]
  for (let i = 0; i < longer.length; i++) if (shorter === longer.slice(0, i) + longer.slice(i + 1)) return true
  return false
}

function deletes(s: string): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i++) out.push(s.slice(0, i) + s.slice(i + 1))
  return out
}

// Names stuck together: a lower-case letter running straight into a capital, with no gap.
const GLUE = new RegExp(GLUE_BOUNDARY_SOURCE, 'g')
const GLUE_PREFIX_OK = new Set(['mc', 'mac', 'de', 'di', 'la', 'le', 'van', 'von', 'o', 'al', 'el'])
function gluePieces(token: string): string[] | null {
  const cuts = [...token.matchAll(GLUE)].map(m => m.index as number)
  if (cuts.length === 0) return null
  const pieces: string[] = []
  let last = 0
  for (const c of [...cuts, token.length]) { pieces.push(token.slice(last, c)); last = c }
  const letters = (x: string): number => [...x].filter(ch => /\p{L}/u.test(ch)).length
  if (pieces.some(p => letters(p) < 3) || GLUE_PREFIX_OK.has(pieces[0].toLowerCase())) return null
  return pieces
}

// A spelling with its stray characters tidied, offered as the starting point for "odd characters"
function tidyJunk(raw: string): string {
  let t = decodeEntities(raw)
  if (MOJIBAKE.test(t)) {
    const repaired = Buffer.from(t, 'latin1').toString('utf8')
    if (!repaired.includes(REPLACEMENT_CHAR)) t = repaired
  }
  t = t.replace(/["“”`]/g, '').replace(/^#+|#+$/g, '').trim()
  t = t.replace(/^[^\p{L}\p{N}([¿¡]+/u, '').replace(/[:;,\-–—/\\]+$/, '').trim()
  return t
}

const GLUE_PIECE_MIN_PHOTOS = 20   // names stuck together: each piece must be a tag used on at least this many photos

export function detectFindings(tags: TagRecord[], genericWords: string[] = DEFAULT_GENERIC_WORDS): Draft[] {
  const out: Draft[] = []
  const add = (t: TagRecord, category: AuditCategory, replacement: string, evidence: string, confidence: AuditConfidence, display?: string): void => {
    out.push({ category, tag: t.name, display: display ?? t.display, count: t.count, confidence, replacement, evidence, spellings: t.raws.slice(0, 6) })
  }
  const byName = new Map(tags.map(t => [t.name, t]))
  const words = realWords()

  // Frequencies of whole words and of letter runs across every spelling
  const tokenFreq = new Map<string, number>()
  const wordFreq = new Map<string, number>()
  const runFreq = new Map<string, number>()
  const bump = (m: Map<string, number>, k: string): void => { m.set(k, (m.get(k) ?? 0) + 1) }
  for (const t of tags) {
    const tokens = new Set<string>(), ws = new Set<string>(), runs = new Set<string>()
    for (const r of rawsOf(t)) {
      for (const w of r.split(/\s+/)) {
        if (!w) continue
        tokens.add(w)
        const c = cleanTag(w)
        if (c) ws.add(c)
        for (const m of w.matchAll(/\p{L}+/gu)) runs.add(m[0].toLowerCase())
      }
    }
    tokens.forEach(k => bump(tokenFreq, k)); ws.forEach(k => bump(wordFreq, k)); runs.forEach(k => bump(runFreq, k))
  }

  // 1. Names stuck together
  for (const t of tags) {
    if (isMachine(t) || t.count > 25) continue   // a tag on many photos was written that way on purpose
    for (const raw of rawsOf(t)) {
      const segments: string[] = []
      let current = ''
      let hit: string | null = null
      let hitPieces: string[] = []
      for (const word of raw.split(/\s+/).filter(Boolean)) {
        // garbled characters ("GeneviÃ¨ve") look like a capital after a letter but belong in Odd characters
        const pieces = word.length >= 8 && (tokenFreq.get(word) ?? 0) <= 2 && !MOJIBAKE.test(word) ? gluePieces(word) : null
        if (!pieces) { current = current ? `${current} ${word}` : word; continue }
        if (!hit) { hit = word; hitPieces = pieces }
        current = current ? `${current} ${pieces[0]}` : pieces[0]
        for (const p of pieces.slice(1)) { segments.push(current); current = p }
      }
      if (!hit) continue
      // A comma was probably lost only if every piece is a tag you also use on its own; and if the tag is also typed with the gap,
      // it is one tag spelled two ways (Typed more than one way), not two tags run together
      if (!hitPieces.every(p => (byName.get(cleanTag(p))?.count ?? 0) >= GLUE_PIECE_MIN_PHOTOS)) continue
      const spaced = hitPieces.join(' ').toLowerCase()
      if (rawsOf(t).some(r => r.toLowerCase().includes(spaced))) continue
      segments.push(current)
      // A name used on several photos was probably written that way on purpose (CubaOcho, DinoLand)
      const longEnough = raw.split(/\s+/).length >= 4 || raw.length >= 30
      add(t, 'glued', segments.join(', '), `no gap in "${hit}"`, longEnough && t.count <= 5 ? 'high' : 'medium')
      break
    }
  }

  // 2. Run-ons: typed with no spaces or punctuation, made of popular tags
  const vocab = new Set(tags.filter(t => t.count >= 30 && t.name.length >= 2 && !isMachine(t)).map(t => t.name))
  const segment = (s: string): string[] | null => {
    const n = s.length
    const best: (string[] | null)[] = new Array(n + 1).fill(null)
    best[0] = []
    for (let i = 1; i <= n; i++) {
      for (let j = Math.max(0, i - 24); j < i; j++) {
        const prev = best[j]
        if (prev && vocab.has(s.slice(j, i)) && !(j === 0 && i === n)) {
          const cand = [...prev, s.slice(j, i)]
          if (!best[i] || cand.length < (best[i] as string[]).length) best[i] = cand
        }
      }
    }
    return best[n]
  }
  for (const t of tags) {
    if (isMachine(t) || t.count > 12 || t.name.length < 10 || !alnumOnly(t.name)) continue
    if (words.has(t.name)) continue   // a real word such as cheesecake or storehouse, not several tags run together
    if (!rawsOf(t).some(alnumOnly)) continue
    const seg = segment(t.name)
    if (seg && seg.length >= 2 && seg.every(x => x.length >= 2)) {
      add(t, 'runon', seg.map(x => byName.get(x)?.display ?? x).join(', '), `${seg.length} popular tags run together`,
        seg.length >= 3 || t.name.length >= 16 ? 'high' : 'medium')
    }
  }

  // 3. Possible typos: a rare tag one letter from a popular one, where the odd word is not a real word
  const pop = tags.filter(t => t.count >= 10 && t.name.length >= 5 && !isMachine(t) && lettersOnly(t.name))
  const delIndex = new Map<string, TagRecord[]>()
  const put = (k: string, t: TagRecord): void => { const a = delIndex.get(k); if (a) a.push(t); else delIndex.set(k, [t]) }
  for (const t of pop) { put(t.name, t); for (const d of deletes(t.name)) put(d, t) }
  const wordsOfTag = (t: TagRecord): string[] => rawsOf(t)[0].split(/\s+/).map(cleanTag).filter(Boolean)
  for (const t of tags) {
    if (t.count > 2 || t.name.length < 6 || !lettersOnly(t.name) || isMachine(t)) continue
    const s = t.name
    const cands = new Map<number, TagRecord>()
    for (const key of [s, ...deletes(s)]) for (const p of delIndex.get(key) ?? []) cands.set(p.id, p)
    const mine = wordsOfTag(t)
    let best: TagRecord | null = null
    let bestBad = ''
    for (const p of cands.values()) {
      if (p.name === s || !dl1(s, p.name)) continue
      if (p.name === s + 's' || p.name === s + 'es' || s === p.name + 's' || s === p.name + 'es') continue
      if (foldLatinAccents(s) === foldLatinAccents(p.name)) continue
      const theirs = wordsOfTag(p)
      if (theirs.length !== mine.length) continue
      const diff = mine.map((w, i) => [w, theirs[i]]).filter(([a, b]) => a !== b)
      if (diff.length !== 1) continue
      const [bad, good] = diff[0]
      if ((wordFreq.get(bad) ?? 0) > 2 || (wordFreq.get(good) ?? 0) < 5 || words.has(bad)) continue
      if (p.count >= Math.max(10, 8 * t.count) && (!best || p.count > best.count)) { best = p; bestBad = bad }
    }
    if (best) {
      add(t, 'typo', best.display, `"${bestBad}" is used in only ${wordFreq.get(bestBad) ?? 0} tag(s) in your library`,
        t.count === 1 && best.count >= 30 ? 'high' : 'medium')
    }
  }

  // 4. Accents: keep both spellings (accented AND plain), and accent every word that needs it
  for (const t of tags) {
    if (isMachine(t)) continue
    const plain = foldLatinAccents(t.name)
    if (plain !== t.name && !byName.has(plain)) {
      const plainDisplay = foldLatinAccents(t.display)
      add(t, 'notwin', `${t.display}, ${plainDisplay}`, `there is no tag "${plain}"; Flickr search cannot find accented tags`, t.count >= 20 ? 'high' : 'medium')
    }
  }
  const variants = new Map<string, Map<string, number>>()   // plain letter run -> { spelling: how many tags use it }
  for (const [run, f] of runFreq) {
    const key = foldLatinAccents(run)
    const m = variants.get(key) ?? new Map<string, number>()
    m.set(run, f)
    variants.set(key, m)
  }
  for (const t of tags) {
    if (isMachine(t) || foldLatinAccents(t.name) !== t.name) continue
    let changed = false, strong = true
    const accented = t.display.replace(/\p{L}+/gu, run => {
      const lower = run.toLowerCase()
      const m = variants.get(lower)
      if (!m) return run
      let bestRun = '', bestF = 0
      for (const [k, f] of m) if (k !== lower && f > bestF) { bestRun = k; bestF = f }
      const plainF = m.get(lower) ?? 0
      if (!bestRun || bestF < 2 || bestF < Math.max(plainF, 1)) return run
      changed = true
      if (!(bestF >= 5 && bestF >= 3 * Math.max(plainF, 1))) strong = false
      return sameCase(run, bestRun)
    })
    if (changed && !byName.has(cleanTag(accented))) {
      add(t, 'noaccent', `${t.display}, ${accented}`, 'your other tags usually spell these words with accents', strong && t.count >= 10 ? 'high' : 'medium')
    }
  }

  // 5. Odd characters
  for (const t of tags) {
    if (isMachine(t)) continue
    for (const r of rawsOf(t)) {
      const s = r.trim()
      let reason: string | null = null
      if (r.includes(REPLACEMENT_CHAR) || MOJIBAKE.test(r)) reason = 'garbled characters'
      else if (/&(quot|amp|lt|gt|#\d+);/.test(r)) reason = 'web code (HTML) instead of a character'
      else if (/["“”`]/.test(r)) reason = 'stray quote mark'
      else if (s.startsWith('#') || s.endsWith('#')) reason = 'hashtag symbol'
      else if (s && !/[\p{L}\p{N}\p{M}]/u.test(s[0]) && !'([¿¡'.includes(s[0])) reason = 'starts with punctuation'
      else if (s && /[:;,\-–—/\\]$/.test(s)) reason = 'ends with punctuation'
      else if (cleanTag(r) === '') reason = 'no letters or digits'
      if (reason) {
        const tidy = tidyJunk(r)
        // shown under the offending spelling itself, so the plan line reads: Replace "MoMA:" with MoMA
        add(t, 'junk', tidy && tidy !== s ? tidy : t.display, reason, 'medium', s)
        break
      }
    }
  }

  // 6. Typed more than one way (cosmetic)
  for (const t of tags) {
    if (t.raws.length < 2 || isMachine(t)) continue
    const lowers = new Set(t.raws.map(r => r.split(/\s+/).filter(Boolean).join(' ').toLowerCase()))
    const kind = lowers.size === 1 ? 'capitalization only' : 'spacing or punctuation differs'
    add(t, 'spelling', t.display, `${t.raws.length} spellings, ${kind}`, lowers.size === 1 ? 'low' : 'medium')
  }

  // 7. Tag use: generic words, numbers that are not years, camera file names, and tags on a single photo
  const exactGeneric = new Set<string>()
  const startsGeneric: string[] = []
  for (const w of genericWords) {
    const c = cleanTag(w.replace(/\*/g, ''))
    if (!c) continue
    if (w.trim().endsWith('*')) startsGeneric.push(c); else exactGeneric.add(c)
  }
  for (const t of tags) {
    if (isMachine(t)) continue
    if (t.count === 1) add(t, 'usedonce', '', 'on a single photo', 'low')
    if (exactGeneric.has(t.name) || startsGeneric.some(g => t.name.startsWith(g))) add(t, 'generic', '', 'a word that says nothing about the photo', 'medium')
    if (/^\d+$/.test(t.name) && !/^(?:19|20)\d\d$/.test(t.name)) add(t, 'numbers', '', 'digits only, not a year', 'medium')
    if (isCameraTag(t.name) || rawsOf(t).some(isCameraTag)) add(t, 'filename', '', 'looks like a camera file name', 'high')
  }

  // Strongest suspicion first; for stuck-together names the rarest come first (a slip is rarely repeated)
  out.sort((a, b) => order[a.confidence] - order[b.confidence] ||
    (a.category === 'glued' && b.category === 'glued' ? a.count - b.count : b.count - a.count))
  return out
}

// ── State kept between runs ──────────────────────────────────────────────────

interface StateRow { tag_name: string; category: AuditCategory; status: 'plan' | 'fine' | 'fixed'; replacement: string | null; display: string | null; photo_count: number | null }

let ready: Database.Database | null = null
function auditDb(): Database.Database {
  const db = getDb()
  if (!db) throw new Error('Database is not open')
  if (ready !== db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tag_audit_state (
        tag_name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        replacement TEXT,
        display TEXT,
        photo_count INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (tag_name, category)
      );
    `)
    ready = db
  }
  return db
}

// Checks whose answer depends on a rule or a list you can edit (or on other tags), so a plan item for one is fixed only when the tag itself is gone
export const RULE_DEPENDENT: ReadonlySet<AuditCategory> = new Set<AuditCategory>(['glued', 'runon', 'plural', 'possessive', 'generic'])

let cache: { builtFor: number; words: string; computedAt: number; findings: Finding[]; ids: Map<string, number>; missingIds: Map<string, string[]>; missingSuggestions: number } | null = null

function loadTagRecords(db: Database.Database): TagRecord[] {
  const byId = new Map<number, TagRecord>()
  for (const r of db.prepare('SELECT id, name, display, photo_count FROM tag_names WHERE photo_count > 0').all() as { id: number; name: string; display: string | null; photo_count: number }[]) {
    byId.set(r.id, { id: r.id, name: r.name, display: r.display ?? r.name, count: r.photo_count, raws: [] })
  }
  for (const r of db.prepare('SELECT tag_id, raw FROM tag_raw').iterate() as IterableIterator<{ tag_id: number; raw: string }>) {
    byId.get(r.tag_id)?.raws.push(r.raw)
  }
  return [...byId.values()]
}

function indexStamp(db: Database.Database): number | null {
  const row = db.prepare("SELECT value FROM tag_index_meta WHERE key = 'last_scan_at'").get() as { value: string } | undefined
  return row ? Number(row.value) : null
}

// Runs the detection when the tag list has changed since the last run, then applies the user's marks.
// The tag-by-tag findings depend only on the tag list and the generic words; the missing-tag findings also depend on albums, titles and
// their own numbers. They are kept apart so changing one number does not rerun every check.
let baseCache: { stamp: number; words: string; drafts: Draft[]; records: TagRecord[] } | null = null
let missingCache: { stamp: number; key: string; result: ReturnType<typeof detectMissingTags> } | null = null

function currentFindings(db: Database.Database): Finding[] | null {
  const stamp = indexStamp(db)
  if (stamp === null) return null
  const genericWords = loadSettings().auditGenericWords ?? DEFAULT_GENERIC_WORDS
  const albumsStamp = (db.prepare("SELECT value FROM tag_index_meta WHERE key = 'albums_scanned_at'").get() as { value: string } | undefined)?.value ?? ''
  const wordsKey = genericWords.join('\n')
  // The missing-tag numbers, the album numbers they share (nearby photos, titles) and the album scan all change the missing-tag answer
  const missingKey = `${missingSettings().key}|${albumsStamp}|${JSON.stringify(loadSettings().albumFit ?? {})}`
  const fullKey = `${wordsKey}|${missingKey}`
  if (cache && cache.builtFor === stamp && cache.words === fullKey) return cache.findings
  const states = new Map<string, StateRow>()
  for (const s of db.prepare('SELECT * FROM tag_audit_state').all() as StateRow[]) states.set(`${s.tag_name}|${s.category}`, s)
  if (!baseCache || baseCache.stamp !== stamp || baseCache.words !== wordsKey) {
    const records = loadTagRecords(db)
    baseCache = { stamp, words: wordsKey, records, drafts: [...detectFindings(records, genericWords), ...detectPlurals(db), ...detectPossessives(db)] }
  }
  if (!missingCache || missingCache.stamp !== stamp || missingCache.key !== missingKey) missingCache = { stamp, key: missingKey, result: detectMissingTags(db) }
  const { records, drafts } = baseCache
  const missing = missingCache.result
  const findings: Finding[] = [...drafts, ...missing.drafts].map(d => {
    const s = states.get(`${d.tag}|${d.category}`)
    return { ...d, status: (s && s.status !== 'fixed' ? s.status : 'open') as AuditStatus, replacement: s?.replacement || d.replacement }
  })
  // A plan item whose problem no longer shows up has been fixed
  const live = new Set(findings.map(f => `${f.tag}|${f.category}`))
  const markFixed = db.prepare("UPDATE tag_audit_state SET status = 'fixed', updated_at = ? WHERE tag_name = ? AND category = ?")
  // These checks depend on rules and on other tags, so they are fixed only when the tag itself is gone; a rule that merely stops flagging a tag is not a fix
  const names = new Set(records.map(r => r.name))
  for (const s of states.values()) {
    if (s.status !== 'plan' || live.has(`${s.tag_name}|${s.category}`)) continue
    if (RULE_DEPENDENT.has(s.category) && names.has(s.tag_name)) continue
    markFixed.run(Date.now(), s.tag_name, s.category)
  }
  cache = { builtFor: stamp, words: fullKey, computedAt: Date.now(), findings, ids: new Map(records.map(r => [r.name, r.id])), missingIds: missing.photoIds, missingSuggestions: missing.suggestions }
  return findings
}

// This tag's page on the user's Flickr account (the owner id is read once from the stored sign-in)
function tagUrl(cleanName: string): string {
  const ownerId = ownerNsid()
  return ownerId ? `https://www.flickr.com/photos/${ownerId}/tags/${encodeURIComponent(cleanName)}` : ''
}

export function auditSummary(): AuditSummary {
  const db = auditDb()
  const findings = currentFindings(db)
  if (!findings) return { computedAt: 0, hasIndex: false, rows: [] }
  const fixed = new Map<string, number>()
  for (const r of db.prepare("SELECT category, COUNT(*) AS n FROM tag_audit_state WHERE status = 'fixed' GROUP BY category").all() as { category: string; n: number }[]) fixed.set(r.category, r.n)
  const rows = AUDIT_CATEGORIES.map(category => {
    const mine = findings.filter(f => f.category === category)
    return {
      category,
      open: mine.filter(f => f.status === 'open').length,
      plan: mine.filter(f => f.status === 'plan').length,
      fine: mine.filter(f => f.status === 'fine').length,
      fixed: fixed.get(category) ?? 0
    }
  })
  return { computedAt: cache?.computedAt ?? 0, hasIndex: true, rows }
}

// Every finding in one list (a type and status, plus any filter text)
function matchingRows(q: AuditExportQuery): Finding[] {
  const db = auditDb()
  const findings = currentFindings(db) ?? []
  const needle = (q.search ?? '').trim().toLowerCase()
  const match = (f: { display: string; replacement: string; evidence?: string }): boolean =>
    !needle || f.display.toLowerCase().includes(needle) || f.replacement.toLowerCase().includes(needle) || (f.evidence ?? '').toLowerCase().includes(needle)
  let rows: Finding[]
  if (q.status === 'fixed') {
    const saved = db.prepare("SELECT * FROM tag_audit_state WHERE category = ? AND status = 'fixed' ORDER BY photo_count DESC").all(q.category) as StateRow[]
    rows = saved.map(s => ({
      category: q.category, tag: s.tag_name, display: s.display ?? s.tag_name, count: s.photo_count ?? 0, confidence: 'medium' as AuditConfidence,
      replacement: s.replacement ?? '', evidence: 'no longer found in your tag list', spellings: [], status: 'fixed' as AuditStatus
    })).filter(match)
  } else {
    rows = findings.filter(f => f.category === q.category && f.status === q.status && match(f))
  }
  if (q.reason && q.category === 'junk') rows = rows.filter(f => f.evidence === q.reason)   // Odd characters, one kind of problem
  // Suggested keeps the order the detection gave (strongest suspicion first); the others reorder the whole list,
  // so paging and the export follow it too. Ties fall back to A to Z.
  if (q.sort && q.sort !== 'suggested') {
    const byName = (a: Finding, b: Finding): number => a.display.localeCompare(b.display, undefined, { sensitivity: 'base' })
    rows = [...rows].sort(q.sort === 'most' ? (a, b) => b.count - a.count || byName(a, b)
      : q.sort === 'fewest' ? (a, b) => a.count - b.count || byName(a, b)
      : q.sort === 'alphaDesc' ? (a, b) => byName(b, a) : byName)
  }
  return rows
}

// Every check can be On, Optional or Off (Tune checks), including the cosmetic spelling check, which is Optional by default
const DASHBOARD_CATEGORIES: AuditCategory[] = ['notwin', 'noaccent', 'typo', 'glued', 'junk', 'runon', 'spelling', 'plural', 'possessive', 'missing', 'generic', 'numbers', 'filename', 'usedonce']

// The numbers behind the dashboard: how many tags and photos are affected, and how the work is going
export function auditOverview(): AuditOverview {
  const db = auditDb()
  const findings = currentFindings(db)
  const empty: AuditOverview = { hasIndex: false, totalTags: 0, totalPhotos: 0, flaggedTags: 0, flaggedPhotos: 0, optionalTags: 0, optionalPhotos: 0, plan: 0, fine: 0, fixed: 0, byType: [], biggest: [], biggestWarnings: [] }
  if (!findings) return empty
  const totalTags = (db.prepare('SELECT COUNT(*) AS n FROM tag_names WHERE photo_count > 0').get() as { n: number }).n
  const totalPhotos = (db.prepare('SELECT COUNT(*) AS n FROM tag_indexed_photo').get() as { n: number }).n
  const ids = cache?.ids ?? new Map<string, number>()
  // How many different photos carry any of these tags. The ids go through a temporary table instead of a
  // huge IN (...) list, which would hit SQLite's limit on bound values in a very large library.
  db.exec('CREATE TEMP TABLE IF NOT EXISTS audit_pick (tag_id INTEGER PRIMARY KEY)')
  const fillPick = db.prepare('INSERT OR IGNORE INTO audit_pick (tag_id) VALUES (?)')
  const photosFor = (tagNames: string[]): number => {
    db.exec('DELETE FROM audit_pick')
    db.transaction(() => { for (const n of tagNames) { const id = ids.get(n); if (id !== undefined) fillPick.run(id) } })()
    return (db.prepare('SELECT COUNT(DISTINCT tp.photo_id) AS n FROM tag_photo tp JOIN audit_pick k ON k.tag_id = tp.tag_id').get() as { n: number }).n
  }
  // Photos missing a tag count the photos that lack it, not the photos that carry it, so they are counted apart from the tag problems
  const photosMissing = (tagNames: string[]): number => new Set(tagNames.flatMap(n => cache?.missingIds.get(n) ?? [])).size
  // Checks that are Off are left out; Optional ones are shown but do not count towards the headline
  const cleanupRules = loadSettings().cleanupRules
  const stateOf = (c: AuditCategory): 'off' | 'optional' | 'on' => ruleState(cleanupRules, `tags:${c}`)
  const shown = DASHBOARD_CATEGORIES.filter(c => stateOf(c) !== 'off')
  const live = findings.filter(f => shown.includes(f.category) && (f.status === 'open' || f.status === 'plan'))
  const liveOn = live.filter(f => stateOf(f.category) === 'on')
  const states = db.prepare('SELECT category, status, COUNT(*) AS n FROM tag_audit_state GROUP BY category, status').all() as { category: AuditCategory; status: string; n: number }[]
  const stateCount = (category: AuditCategory, status: string): number => states.find(s => s.category === category && s.status === status)?.n ?? 0
  const byType = shown.map(category => {
    const mine = live.filter(f => f.category === category)
    return {
      category,
      state: stateOf(category) as 'optional' | 'on',
      open: mine.filter(f => f.status === 'open').length,
      plan: stateCount(category, 'plan'),
      fine: stateCount(category, 'fine'),
      fixed: stateCount(category, 'fixed'),
      photos: category === 'missing' ? photosMissing([...new Set(mine.map(f => f.tag))]) : photosFor([...new Set(mine.map(f => f.tag))])
    }
  })
  // Suggestions of a tag to add are not tag problems, so they stay out of the headline counts of tags and photos with problems
  const flaggedNames = [...new Set(liveOn.filter(f => f.category !== 'missing').map(f => f.tag))]
  const flagged = new Set(flaggedNames)
  const optionalNames = [...new Set(live.filter(f => f.category !== 'missing' && stateOf(f.category) === 'optional' && !flagged.has(f.tag)).map(f => f.tag))]
  return {
    hasIndex: true,
    totalTags, totalPhotos,
    flaggedTags: flaggedNames.length,
    flaggedPhotos: photosFor(flaggedNames),
    optionalTags: optionalNames.length,
    optionalPhotos: photosFor(optionalNames),
    plan: byType.reduce((n, r) => n + r.plan, 0),
    fine: byType.reduce((n, r) => n + r.fine, 0),
    fixed: byType.reduce((n, r) => n + r.fixed, 0),
    byType,
    biggest: [...liveOn].filter(f => f.category !== 'missing').sort((a, b) => b.count - a.count).slice(0, 10).map(f => ({ display: f.display, category: f.category, count: f.count })),
    biggestWarnings: live.filter(f => stateOf(f.category) === 'optional').sort((a, b) => b.count - a.count).slice(0, 10).map(f => ({ display: f.display, category: f.category, count: f.count }))
  }
}

export function auditList(q: AuditListQuery): AuditListPage {
  const all = matchingRows({ ...q, reason: undefined })
  // Odd characters has seven kinds of problem; the menu shows how many rows each has and can show just one
  let reasons: Record<string, number> | undefined
  if (q.category === 'junk') { reasons = {}; for (const f of all) reasons[f.evidence] = (reasons[f.evidence] ?? 0) + 1 }
  const rows = q.reason ? matchingRows(q) : all
  const offset = Math.max(q.offset, 0)
  const page = rows.slice(offset, offset + Math.min(Math.max(q.limit, 1), 500))
  return { rows: page.map(f => ({ ...f, flickrUrl: tagUrl(f.tag) })), total: rows.length, ...(reasons ? { reasons } : {}) }
}

// Every row of the list, with no page limit, for export
function allRows(q: AuditExportQuery): AuditFinding[] {
  return matchingRows(q).map(f => ({ ...f, flickrUrl: tagUrl(f.tag) }))
}

export function auditSet(req: AuditSetRequest): void {
  const db = auditDb()
  const finding = currentFindings(db)?.find(f => f.tag === req.tag && f.category === req.category)
  if (!finding) return
  if (req.status === 'open') {
    db.prepare('DELETE FROM tag_audit_state WHERE tag_name = ? AND category = ?').run(req.tag, req.category)
    clearFineReason(`tags:${req.category}`, `${req.category}|${req.tag}`)
    finding.status = 'open'
    return
  }
  const replacement = (req.replacement ?? finding.replacement).trim() || finding.replacement
  db.prepare(`
    INSERT INTO tag_audit_state (tag_name, category, status, replacement, display, photo_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tag_name, category) DO UPDATE SET status = excluded.status, replacement = excluded.replacement,
      display = excluded.display, photo_count = excluded.photo_count, updated_at = excluded.updated_at
  `).run(req.tag, req.category, req.status, replacement, finding.display, finding.count, Date.now())
  finding.status = req.status
  finding.replacement = replacement
}

const planLine = (display: string, replacement: string, count: number, category: AuditCategory): string =>
  category === 'spelling'
    ? `Use "${replacement}" for every spelling of "${display}" (${count.toLocaleString('en-US')} photo${count === 1 ? '' : 's'})`
    : `Replace "${display}" with ${replacement || 'nothing (delete it)'} (${count.toLocaleString('en-US')} photo${count === 1 ? '' : 's'})`

// Every photo that carries this tag, for the batch editor; for the "missing" check, the photos that should have it but do not
export function auditPhotoIds(tag: string, category?: AuditCategory): string[] {
  const db = auditDb()
  if (category === 'missing') { currentFindings(db); return cache?.missingIds.get(tag) ?? [] }
  return (db.prepare('SELECT tp.photo_id FROM tag_photo tp JOIN tag_names n ON n.id = tp.tag_id WHERE n.name = ? ORDER BY tp.photo_id DESC').all(tag) as { photo_id: string }[]).map(r => r.photo_id)
}

// What the missing-tag check finds with the current numbers, for the live counts in Tune checks
export function missingStats(): MissingTagStats {
  const db = auditDb()
  const f = currentFindings(db)
  return { tags: f ? f.filter(x => x.category === 'missing').length : 0, photos: new Set([...(cache?.missingIds.values() ?? [])].flat()).size, suggestions: cache?.missingSuggestions ?? 0 }
}

export function auditPlan(): AuditPlanRow[] {
  const db = auditDb()
  currentFindings(db)   // makes sure fixed items are noticed
  const rows = db.prepare("SELECT * FROM tag_audit_state WHERE status IN ('plan', 'fixed') ORDER BY CASE status WHEN 'plan' THEN 0 ELSE 1 END, category, photo_count DESC").all() as StateRow[]
  return rows.map(s => ({
    category: s.category, tag: s.tag_name, display: s.display ?? s.tag_name, count: s.photo_count ?? 0,
    replacement: s.replacement ?? '', status: s.status as 'plan' | 'fixed', flickrUrl: tagUrl(s.tag_name),
    line: planLine(s.display ?? s.tag_name, s.replacement ?? '', s.photo_count ?? 0, s.category)
  }))
}

function planText(): string {
  const rows = auditPlan()
  if (rows.length === 0) return 'No tag fixes planned.'
  return ['Tag fixes to make on Flickr', ''].concat(rows.map(r => `${r.status === 'fixed' ? '[x]' : '[ ]'} ${r.line}${r.flickrUrl ? `\n      ${r.flickrUrl}` : ''}`)).join('\n')
}

const PLAN_CSV_HEADER = ['Status', 'Type', 'Tag', 'Photos', 'Replace with', 'Flickr page']
const LIST_CSV_HEADER = ['Confidence', 'Tag', 'Photos', 'Replace with', 'Why flagged', 'Flickr page']

export function planCsvRows(): string[][] {
  return auditPlan().map(r => [r.status === 'fixed' ? 'Fixed' : 'To do', r.category, csvCell(r.display), String(r.count), csvCell(r.replacement), csvCell(r.flickrUrl)])
}

export function listCsvRows(q: AuditExportQuery): string[][] {
  return allRows(q).map(r => [r.confidence, csvCell(r.display), String(r.count), csvCell(r.replacement), csvCell(r.evidence), csvCell(r.flickrUrl)])
}

// ── IPC wiring ───────────────────────────────────────────────────────────────

export function registerAuditIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('audit:summary', () => auditSummary())
  ipcMain.handle('audit:overview', () => auditOverview())
  ipcMain.handle('audit:list', (_event, q: AuditListQuery) => auditList(q))
  ipcMain.handle('audit:set', (_event, req: AuditSetRequest) => auditSet(req))
  ipcMain.handle('audit:photoIds', (_event, tag: string, category?: AuditCategory) => (typeof tag === 'string' ? auditPhotoIds(tag, category === 'missing' ? 'missing' : undefined) : []))
  ipcMain.handle('photos:cards', (_event, ids: string[]) => (Array.isArray(ids) ? photoCards(ids) : []))
  ipcMain.handle('audit:missingStats', () => missingStats())
  ipcMain.handle('audit:plan', () => auditPlan())
  ipcMain.handle('audit:copyPlan', () => { clipboard.writeText(planText()); return true })
  ipcMain.handle('audit:savePlanCsv', () => saveCsvFile(getWindow, 'tag-fix-plan.csv', PLAN_CSV_HEADER, planCsvRows()))
  ipcMain.handle('audit:saveListCsv', (_event, q: AuditExportQuery) => saveCsvFile(getWindow, `tag-audit-${q.category}-${q.status}.csv`, LIST_CSV_HEADER, listCsvRows(q)))
}
