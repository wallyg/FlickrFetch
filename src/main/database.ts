import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { BatchLogEntry, PhotoDownloadRecord } from '../shared/types'

let db: Database.Database | null = null

export function openDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'flickrfetch.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS batch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      downloaded INTEGER NOT NULL DEFAULT 0,
      skipped_collision INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'complete'
    );

    CREATE TABLE IF NOT EXISTS photo_download_record (
      photo_id TEXT PRIMARY KEY,
      last_downloaded_at INTEGER NOT NULL,
      flickr_last_update INTEGER NOT NULL DEFAULT 0
    );
  `)
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

export function writeBatchLog(entry: Omit<BatchLogEntry, 'id'>): number {
  if (!db) return -1
  const result = db.prepare(`
    INSERT INTO batch_log
      (created_at, source, source_type, total, downloaded, skipped_collision, failed, status)
    VALUES
      (@createdAt, @source, @sourceType, @total, @downloaded, @skippedCollision, @failed, @status)
  `).run({
    createdAt: entry.createdAt,
    source: entry.source,
    sourceType: entry.sourceType,
    total: entry.total,
    downloaded: entry.downloaded,
    skippedCollision: entry.skippedCollision,
    failed: entry.failed,
    status: entry.status,
  })
  return result.lastInsertRowid as number
}

export function writePhotoRecord(photoId: string, flickrLastUpdate: number): void {
  if (!db) return
  db.prepare(`
    INSERT INTO photo_download_record (photo_id, last_downloaded_at, flickr_last_update)
    VALUES (@photoId, @now, @flickrLastUpdate)
    ON CONFLICT(photo_id) DO UPDATE SET
      last_downloaded_at = excluded.last_downloaded_at,
      flickr_last_update = excluded.flickr_last_update
  `).run({ photoId, now: Date.now(), flickrLastUpdate })
}

export function getPhotoRecord(photoId: string): PhotoDownloadRecord | null {
  if (!db) return null
  const row = db.prepare('SELECT * FROM photo_download_record WHERE photo_id = ?').get(photoId) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    photoId: row['photo_id'] as string,
    lastDownloadedAt: row['last_downloaded_at'] as number,
    flickrLastUpdate: row['flickr_last_update'] as number,
  }
}

export function getPhotoRecordsBatch(photoIds: string[]): Map<string, PhotoDownloadRecord> {
  const map = new Map<string, PhotoDownloadRecord>()
  if (!db || photoIds.length === 0) return map
  const placeholders = photoIds.map(() => '?').join(',')
  const rows = (db.prepare(`SELECT * FROM photo_download_record WHERE photo_id IN (${placeholders})`).all(...photoIds)) as Record<string, unknown>[]
  for (const row of rows) {
    const photoId = row['photo_id'] as string
    map.set(photoId, {
      photoId,
      lastDownloadedAt: row['last_downloaded_at'] as number,
      flickrLastUpdate: row['flickr_last_update'] as number,
    })
  }
  return map
}

export function getBatchLog(limit = 200): BatchLogEntry[] {
  if (!db) return []
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  db.prepare('DELETE FROM batch_log WHERE created_at < ?').run(cutoff)
  const rows = db.prepare('SELECT * FROM batch_log ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[]
  return rows.map(row => ({
    id: row['id'] as number,
    createdAt: row['created_at'] as number,
    source: row['source'] as string,
    sourceType: row['source_type'] as BatchLogEntry['sourceType'],
    total: row['total'] as number,
    downloaded: row['downloaded'] as number,
    skippedCollision: row['skipped_collision'] as number,
    failed: row['failed'] as number,
    status: row['status'] as BatchLogEntry['status'],
  }))
}

export function clearBatchLog(): void {
  db?.prepare('DELETE FROM batch_log').run()
}

export function clearAllHistory(): void {
  db?.prepare('DELETE FROM batch_log').run()
  db?.prepare('DELETE FROM photo_download_record').run()
}
