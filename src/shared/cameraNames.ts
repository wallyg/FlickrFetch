// Names a camera or phone leaves behind, used for photo titles and for tags.
// Titles a camera or phone leaves behind: IMG_1234, DSC_0042, P1000234, 20240315_101500, "Photo on 3-15-24 at 10.15 AM".
// The WHOLE title has to look like that (a copy number or file ending is allowed), so "IMG_1234 sunset at the
// beach" or "Image 2013 recap", which someone typed, are left alone.
const COPY_BITS = String.raw`(?:[ _-]?(?:\(\d+\)|\d{1,3}|copy|edit(?:ed)?|hdr|pano|burst\d*))*`
const CAMERA_TITLES = [
  new RegExp(String.raw`^(?:img|dsc|dscn|dscf|dsci|pict|mvi|mov|vid|gopr|gp|pxl|sam|cimg|dcp|image|p)[_-]?\d{3,}` + COPY_BITS + String.raw`(?:\.[a-z0-9]{2,4})?$`, 'i'),
  new RegExp(String.raw`^\d{8}[_ -]\d{4,9}` + COPY_BITS + '$', 'i'),
  /^\d{4}-\d{2}-\d{2}[ _-]\d{2}[.:]\d{2}(?:[.:]\d{2})?$/,
  /^photo on \d[\d/.-]*(?: at \d{1,2}[.:]\d{2}(?:[.:]\d{2})?(?: ?[ap]m)?)?$/i,
  /^screenshot[ _-]\d{4}-\d{2}-\d{2}(?: at \d{1,2}[.:]\d{2}[.:]\d{2}(?: ?[ap]m)?)?$/i
]
export function isCameraTitle(title: string): boolean {
  const t = title.trim()
  return t !== '' && CAMERA_TITLES.some(re => re.test(t))
}

// For tags, a short prefix glued straight to digits is usually a real word (p900 is a camera model, image2013 a year, mov1080 a video size),
// so those need a separator (p_1000, image-2013). Names such as img1234 and dsc01234 still count.
const AMBIGUOUS_TAG_PREFIX = /^(?:image|vid|mov|mvi|gp|sam|p)\d/i
export function isCameraTag(tag: string): boolean {
  const t = tag.trim()
  return isCameraTitle(t) && !AMBIGUOUS_TAG_PREFIX.test(t)
}

