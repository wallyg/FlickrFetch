// Reads every page of something Flickr hands out in pages (albums, photos), one page after another. `max` is a safety stop.
export async function allPages<T>(read: (page: number) => Promise<{ items: T[]; pages: number }>, max = 200): Promise<T[]> {
  const out: T[] = []
  let page = 1
  let pages = 1
  do {
    const r = await read(page)
    out.push(...r.items)
    pages = r.pages
    page++
  } while (page <= pages && page <= max)
  return out
}
