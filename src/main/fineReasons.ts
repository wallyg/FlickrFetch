import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from './database'
import { csvCell, saveCsvFile } from './csv'
import { ruleById } from '../shared/cleanupRules'
import type { FineReasonRequest, FineReasonSummaryRow } from '../shared/types'

// Why you marked something "This one is fine" (#189). Kept on this computer next to the decision, never sent anywhere.
// A reason is optional: the mark itself is saved first and the reason is added a moment later, or never.

let ready: Database.Database | null = null
function fineDb(): Database.Database {
  const db = getDb()
  if (!db) throw new Error('Database is not open')
  if (ready !== db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fine_reason (
        check_id TEXT NOT NULL,     -- 'tags:glued', 'photos:location', 'albums:misfit' ...
        item_key TEXT NOT NULL,     -- the same key the check uses for its 'fine' decision
        label TEXT,                 -- the item as it was shown (a tag, a photo title, an album title), for the spreadsheet
        reason TEXT NOT NULL,
        note TEXT,                  -- anything typed under "Other"
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (check_id, item_key)
      );
    `)
    ready = db
  }
  return db
}

export function setFineReason(req: FineReasonRequest): void {
  const reason = String(req.reason ?? '').trim().slice(0, 120)
  if (!reason || typeof req.checkId !== 'string' || typeof req.key !== 'string') return
  fineDb().prepare(`
    INSERT INTO fine_reason (check_id, item_key, label, reason, note, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(check_id, item_key) DO UPDATE SET label = excluded.label, reason = excluded.reason, note = excluded.note, updated_at = excluded.updated_at
  `).run(req.checkId, req.key, String(req.label ?? '').slice(0, 300), reason, req.note ? String(req.note).trim().slice(0, 500) : null, Date.now())
}

// Undo on a "fine" mark takes its reason away with it
export function clearFineReason(checkId: string, key: string): void {
  try { fineDb().prepare('DELETE FROM fine_reason WHERE check_id = ? AND item_key = ?').run(checkId, key) } catch { /* the reason is only a note; the decision already changed */ }
}

export function fineSummary(): FineReasonSummaryRow[] {
  return fineDb().prepare('SELECT check_id AS checkId, reason, COUNT(*) AS count FROM fine_reason GROUP BY check_id, reason ORDER BY check_id, COUNT(*) DESC').all() as FineReasonSummaryRow[]
}

function csvRows(): string[][] {
  const rows = fineDb().prepare('SELECT check_id, item_key, label, reason, note, updated_at FROM fine_reason ORDER BY check_id, updated_at DESC').all() as { check_id: string; item_key: string; label: string | null; reason: string; note: string | null; updated_at: number }[]
  return rows.map(r => [csvCell(ruleById(r.check_id)?.name ?? r.check_id), csvCell(r.label || r.item_key), csvCell(r.reason), csvCell(r.note ?? ''), new Date(r.updated_at).toISOString().slice(0, 10), csvCell(r.check_id), csvCell(r.item_key)])
}

export function registerFineIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('fine:setReason', (_event, req: FineReasonRequest) => setFineReason(req))
  ipcMain.handle('fine:summary', () => fineSummary())
  ipcMain.handle('fine:saveCsv', () => saveCsvFile(getWindow, 'marked-fine-with-reasons.csv', ['Check', 'Item', 'Reason', 'Note', 'Date', 'Check id', 'Key (photo, tag or album id)'], csvRows()))
}
