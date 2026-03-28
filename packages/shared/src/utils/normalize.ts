export function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeUrl(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}
