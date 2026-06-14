/**
 * Утилита форматирования дат (без внешних зависимостей)
 */
export function formatDistanceToNow(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)

  if (seconds < 60) return 'только что'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} д назад`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} мес назад`
  return `${Math.floor(months / 12)} г назад`
}
