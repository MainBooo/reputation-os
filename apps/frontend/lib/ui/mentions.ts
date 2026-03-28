export function mentionStatusLabel(value?: string | null) {
  switch (value) {
    case 'NEW':
      return 'Новое'
    case 'REVIEWED':
      return 'Просмотрено'
    case 'HIDDEN':
      return 'Скрыто'
    case 'ARCHIVED':
      return 'В архиве'
    default:
      return value || 'Неизвестно'
  }
}

export function mentionSentimentLabel(value?: string | null) {
  switch (value) {
    case 'POSITIVE':
      return 'Позитив'
    case 'NEGATIVE':
      return 'Негатив'
    case 'NEUTRAL':
      return 'Нейтрально'
    case 'MIXED':
      return 'Смешанно'
    default:
      return 'Неизвестно'
  }
}

export function mentionTypeLabel(value?: string | null) {
  switch (value) {
    case 'REVIEW':
      return 'Отзыв'
    case 'ARTICLE':
      return 'Статья'
    case 'WEB_MENTION':
      return 'Упоминание'
    case 'SOCIAL_MENTION':
      return 'Соцсети'
    case 'COMMENT':
      return 'Комментарий'
    case 'VK_POST':
      return 'Пост VK'
    case 'VK_COMMENT':
      return 'Комментарий VK'
    default:
      return value || 'Неизвестно'
  }
}

export function mentionStatusClass(value?: string | null) {
  switch (value) {
    case 'NEW':
      return 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
    case 'REVIEWED':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    case 'HIDDEN':
      return 'border-slate-400/20 bg-slate-400/10 text-slate-200'
    case 'ARCHIVED':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-100'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-200'
  }
}

export function mentionSentimentClass(value?: string | null) {
  switch (value) {
    case 'POSITIVE':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    case 'NEGATIVE':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-100'
    case 'NEUTRAL':
      return 'border-slate-400/20 bg-slate-400/10 text-slate-200'
    case 'MIXED':
      return 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-200'
  }
}
