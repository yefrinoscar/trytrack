/**
 * Colour classes for expense/recurring category tags.
 *
 * Tailwind needs the class names to exist statically, so each category maps to
 * a fixed string rather than a computed one. Unknown categories fall back to a
 * stable colour derived from the text, so a custom category still gets a tag
 * that looks intentional and never changes between renders.
 */

const CATEGORY_TAG_CLASSES: Record<string, string> = {
  food: 'border-emerald-400/30 bg-emerald-400/12 text-emerald-300',
  groceries: 'border-lime-400/30 bg-lime-400/12 text-lime-300',
  transport: 'border-sky-400/30 bg-sky-400/12 text-sky-300',
  health: 'border-violet-400/30 bg-violet-400/12 text-violet-300',
  utilities: 'border-amber-400/30 bg-amber-400/12 text-amber-300',
  shopping: 'border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-300',
  entertainment: 'border-pink-400/30 bg-pink-400/12 text-pink-300',
  software: 'border-cyan-400/30 bg-cyan-400/12 text-cyan-300',
  education: 'border-indigo-400/30 bg-indigo-400/12 text-indigo-300',
  home: 'border-orange-400/30 bg-orange-400/12 text-orange-300',
  gifts: 'border-rose-400/30 bg-rose-400/12 text-rose-300',
  transfer: 'border-blue-400/30 bg-blue-400/12 text-blue-300',
  subscription: 'border-teal-400/30 bg-teal-400/12 text-teal-300',
  other: 'border-border bg-muted text-muted-foreground',
}

/** Used when a category is not in the list above. */
const FALLBACK_TAG_CLASSES = [
  'border-sky-400/30 bg-sky-400/12 text-sky-300',
  'border-emerald-400/30 bg-emerald-400/12 text-emerald-300',
  'border-amber-400/30 bg-amber-400/12 text-amber-300',
  'border-violet-400/30 bg-violet-400/12 text-violet-300',
  'border-rose-400/30 bg-rose-400/12 text-rose-300',
  'border-cyan-400/30 bg-cyan-400/12 text-cyan-300',
  'border-orange-400/30 bg-orange-400/12 text-orange-300',
  'border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-300',
] as const

export function categoryTagClass(category: string | null | undefined) {
  const key = (category ?? '').trim().toLowerCase()
  const exact = CATEGORY_TAG_CLASSES[key]
  if (exact) {
    return exact
  }

  if (!key) {
    return FALLBACK_TAG_CLASSES[0]
  }

  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  }

  return FALLBACK_TAG_CLASSES[hash % FALLBACK_TAG_CLASSES.length]!
}
