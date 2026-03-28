export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}
