/**
 * Maps a category to the CSS custom property that colours its tag.
 *
 * The actual shade lives in `styles.css` and differs per theme, so a single
 * tag class renders readably on both the dark and the light surface. Unknown
 * categories get a stable colour derived from the text, so a custom category
 * always looks the same.
 */

const CATEGORY_COLOR_VARS: Record<string, string> = {
  food: '--cat-emerald',
  groceries: '--cat-lime',
  transport: '--cat-sky',
  health: '--cat-violet',
  utilities: '--cat-amber',
  shopping: '--cat-fuchsia',
  entertainment: '--cat-pink',
  software: '--cat-cyan',
  education: '--cat-indigo',
  home: '--cat-orange',
  gifts: '--cat-rose',
  transfer: '--cat-blue',
  subscription: '--cat-teal',
  other: '--cat-neutral',
}

/** Used when a category is not in the list above. */
const FALLBACK_COLOR_VARS = [
  '--cat-sky',
  '--cat-emerald',
  '--cat-amber',
  '--cat-violet',
  '--cat-rose',
  '--cat-cyan',
  '--cat-orange',
  '--cat-fuchsia',
] as const

export function categoryColorVar(category: string | null | undefined) {
  const key = (category ?? '').trim().toLowerCase()
  const exact = CATEGORY_COLOR_VARS[key]
  if (exact) {
    return exact
  }

  if (!key) {
    return FALLBACK_COLOR_VARS[0]
  }

  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }

  return FALLBACK_COLOR_VARS[hash % FALLBACK_COLOR_VARS.length]!
}
