// "52 photos", "50 photos and 2 videos" or "3 videos": a count of mixed items worded the way people say it.
export function itemsLabel(total: number, videos: number): string {
  const v = Math.max(0, Math.min(videos || 0, total))
  const p = total - v
  const photos = `${p.toLocaleString()} photo${p === 1 ? '' : 's'}`
  const vids = `${v.toLocaleString()} video${v === 1 ? '' : 's'}`
  return v === 0 ? photos : p === 0 ? vids : `${photos} and ${vids}`
}
