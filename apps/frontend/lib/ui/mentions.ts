export function platformLabel(value?: string | null) {
  switch (value) {
    case 'YANDEX':
      return 'Яндекс'
    case 'TWOGIS':
      return '2GIS'
    case 'WEB':
      return 'Сеть'
    case 'TELEGRAM':
      return 'Telegram'
    default:
      return value || null
  }
}

export function platformClass(value?: string | null) {
  switch (value) {
    case 'YANDEX':
      return 'border-red-400/20 bg-red-400/10 text-red-100'
    case 'TWOGIS':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    case 'WEB':
      return 'border-slate-400/20 bg-slate-400/10 text-slate-200'
    case 'TELEGRAM':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-100'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-200'
  }
}

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

export function messageClassificationLabel(value?: string | null) {
  switch (value) {
    case 'OWNED_PROMO':
      return 'Реклама (свой канал)'
    case 'CUSTOMER_REVIEW':
      return 'Отзыв клиента'
    case 'CUSTOMER_COMPLAINT':
      return 'Жалоба'
    case 'CUSTOMER_QUESTION':
      return 'Вопрос клиента'
    case 'CHAT_DISCUSSION':
      return 'Обсуждение в чате'
    case 'NEWS_MENTION':
      return 'Упоминание в новости'
    case 'IRRELEVANT':
      return 'Не по теме'
    case 'SPAM':
      return 'Спам'
    default:
      return value || null
  }
}

export function messageClassificationClass(value?: string | null) {
  switch (value) {
    case 'OWNED_PROMO':
      return 'border-amber-300/25 bg-amber-400/10 text-amber-200'
    case 'CUSTOMER_REVIEW':
      return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
    case 'CUSTOMER_COMPLAINT':
      return 'border-rose-300/25 bg-rose-500/10 text-rose-200'
    case 'CUSTOMER_QUESTION':
      return 'border-blue-300/25 bg-blue-500/10 text-blue-200'
    case 'CHAT_DISCUSSION':
      return 'border-white/10 bg-white/[0.04] text-slate-300'
    case 'NEWS_MENTION':
      return 'border-violet-300/25 bg-violet-500/10 text-violet-200'
    case 'IRRELEVANT':
      return 'border-white/10 bg-white/[0.04] text-slate-400'
    case 'SPAM':
      return 'border-red-400/25 bg-red-500/15 text-red-300'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-200'
  }
}

export function messageUrgencyLabel(value?: string | null) {
  switch (value) {
    case 'LOW':
      return 'Низкая срочность'
    case 'MEDIUM':
      return 'Средняя срочность'
    case 'HIGH':
      return 'Срочно'
    default:
      return value || null
  }
}

export function messageUrgencyClass(value?: string | null) {
  switch (value) {
    case 'LOW':
      return 'border-white/10 bg-white/[0.04] text-slate-300'
    case 'MEDIUM':
      return 'border-amber-300/25 bg-amber-400/10 text-amber-200'
    case 'HIGH':
      return 'border-red-400/25 bg-red-500/15 text-red-300'
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-200'
  }
}
