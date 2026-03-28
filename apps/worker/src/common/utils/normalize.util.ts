export function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
