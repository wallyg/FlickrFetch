import type { FlickrCollection } from './types'

export interface CollectionAlbum {
  id: string
  title: string
  /** Folder names from the collection that was downloaded down to the one holding this album, so sub-collections keep their own folders */
  path: string[]
}

/** Every album in a collection and in the collections inside it (and so on). A collection is a tree; an album is listed once however it is reached. */
export function collectionAlbums(col: FlickrCollection, parents: string[] = [], seen = new Set<string>()): CollectionAlbum[] {
  const path = [...parents, col.title]
  const out: CollectionAlbum[] = []
  for (const set of col.sets) {
    if (seen.has(set.id)) continue
    seen.add(set.id)
    out.push({ id: set.id, title: set.title, path })
  }
  for (const sub of col.collections) out.push(...collectionAlbums(sub, path, seen))
  return out
}
