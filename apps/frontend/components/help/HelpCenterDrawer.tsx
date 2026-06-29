'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, ArrowLeft, Search, Rocket, Bot, Bell, CreditCard,
  HelpCircle, MessageCircle, ChevronRight, Lightbulb, Info,
} from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

// ─── Data model ────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text';  value: string }
  | { type: 'steps'; items: string[] }
  | { type: 'tip';   value: string }
  | { type: 'note';  value: string }
  | { type: 'link';  label: string; href: string; articleId?: string }

export type HelpArticle = {
  id: string
  title: string
  category: 'quickstart' | 'ai' | 'notifications' | 'billing' | 'faq'
  content: ContentBlock[]
}

// ─── All articles ───────────────────────────────────────────────────────────────

const ARTICLES: HelpArticle[] = [
  // ── Быстрый старт ────────────────────────────────────────────────────────────
  {
    id: 'add-company',
    title: 'Как добавить компанию',
    category: 'quickstart',
    content: [
      { type: 'text', value: 'Компания — основной объект мониторинга. Для начала работы нужно добавить хотя бы одну.' },
      { type: 'steps', items: [
        'Перейдите в раздел «Компании» в боковом меню.',
        'Нажмите кнопку «Добавить компанию».',
        'Укажите название и, при желании, сайт и отрасль.',
        'Сохраните карточку.',
        'Подключите хотя бы один источник — Яндекс Карты или 2ГИС.',
      ]},
      { type: 'tip', value: 'После добавления компании мониторинг начнётся автоматически, как только источники будут подключены.' },
      { type: 'link', label: 'Перейти в Компании', href: '/companies' },
    ],
  },
  {
    id: 'connect-yandex',
    title: 'Как подключить Яндекс Карты',
    category: 'quickstart',
    content: [
      { type: 'text', value: 'Яндекс Карты — один из основных источников отзывов для большинства компаний в России.' },
      { type: 'steps', items: [
        'Откройте карточку компании в разделе «Компании».',
        'Перейдите на вкладку «Источники».',
        'Нажмите «Добавить источник» и выберите «Яндекс Карты».',
        'Введите URL вашей организации на Яндекс Картах или внешний ID.',
        'Нажмите «Подключить» — синхронизация начнётся автоматически.',
      ]},
      { type: 'note', value: 'Первые отзывы обычно появляются в течение нескольких минут после подключения.' },
      { type: 'link', label: 'Перейти в Компании', href: '/companies' },
    ],
  },
  {
    id: 'connect-2gis',
    title: 'Как подключить 2ГИС',
    category: 'quickstart',
    content: [
      { type: 'text', value: '2ГИС — популярный картографический сервис, особенно актуальный для региональных компаний.' },
      { type: 'steps', items: [
        'Откройте карточку компании → вкладка «Источники».',
        'Нажмите «Добавить источник» → выберите «2ГИС».',
        'Найдите вашу организацию через поиск или введите прямую ссылку.',
        'Подтвердите подключение.',
      ]},
      { type: 'tip', value: 'Можно подключить несколько филиалов одной компании как отдельные источники — ReputationOS объединит отзывы в одном Inbox.' },
      { type: 'link', label: 'Перейти в Компании', href: '/companies' },
    ],
  },
  {
    id: 'web-monitoring',
    title: 'Как работает веб-поиск',
    category: 'quickstart',
    content: [
      { type: 'text', value: 'Веб-мониторинг отслеживает упоминания вашего бренда на сторонних сайтах, форумах и в СМИ.' },
      { type: 'steps', items: [
        'Добавьте страницы для мониторинга через вкладку «Веб» в карточке компании.',
        'Введите URL страницы, которую нужно отслеживать.',
        'ReputationOS будет периодически проверять страницу на новые упоминания.',
        'Новые упоминания появятся в Inbox компании.',
      ]},
      { type: 'note', value: 'Веб-мониторинг доступен на тарифах START, PRO и AGENCY. На тарифе FREE он недоступен.' },
      { type: 'tip', value: 'Добавляйте страницы агрегаторов и отзовиков, где упоминается ваша компания.' },
    ],
  },

  // ── AI-ответы ────────────────────────────────────────────────────────────────
  {
    id: 'ai-replies',
    title: 'Как генерировать AI-ответы на отзывы',
    category: 'ai',
    content: [
      { type: 'text', value: 'ReputationOS может автоматически предлагать ответы на отзывы с учётом тональности и контекста.' },
      { type: 'steps', items: [
        'Откройте любое упоминание или отзыв в Inbox.',
        'Нажмите кнопку «Сгенерировать ответ» (иконка AI).',
        'Дождитесь генерации — обычно занимает 2–4 секунды.',
        'Отредактируйте черновик при необходимости.',
        'Скопируйте и разместите ответ на платформе.',
      ]},
      { type: 'tip', value: 'Перед публикацией всегда проверяйте AI-ответ: он предлагается как черновик, а не финальный текст.' },
      { type: 'note', value: 'AI-ответы расходуют ежемесячный лимит, который зависит от вашего тарифа.' },
    ],
  },
  {
    id: 'ai-limits',
    title: 'Лимиты AI-ответов',
    category: 'ai',
    content: [
      { type: 'text', value: 'Количество AI-ответов ограничено ежемесячным лимитом, который обнуляется в начале каждого расчётного периода.' },
      { type: 'steps', items: [
        'FREE — 5 AI-ответов в месяц.',
        'START — 50 AI-ответов в месяц.',
        'PRO — 200 AI-ответов в месяц.',
        'AGENCY — без ограничений.',
      ]},
      { type: 'note', value: 'Текущий остаток лимита отображается на странице выбора тарифа.' },
      { type: 'tip', value: 'При достижении лимита вы получите уведомление. Перейдите на более высокий тариф, чтобы получить больше ответов.' },
      { type: 'link', label: 'Выбрать тариф', href: '/billing/checkout' },
    ],
  },

  // ── Уведомления ─────────────────────────────────────────────────────────────
  {
    id: 'push-notifications',
    title: 'Push-уведомления в браузере',
    category: 'notifications',
    content: [
      { type: 'text', value: 'Push-уведомления позволяют получать оповещения о новых отзывах прямо в браузере — даже когда вкладка ReputationOS закрыта.' },
      { type: 'steps', items: [
        'Перейдите в раздел «Настройки».',
        'Найдите блок «Push-уведомления».',
        'Нажмите «Включить уведомления» и подтвердите запрос браузера.',
        'Выберите, о каких событиях вы хотите получать уведомления.',
      ]},
      { type: 'note', value: 'Если браузер заблокировал уведомления, разблокируйте их в настройках браузера вручную.' },
      { type: 'tip', value: 'Push-уведомления работают только при активной подписке и не требуют установки приложения.' },
      { type: 'link', label: 'Настройки уведомлений', href: '/settings' },
    ],
  },
  {
    id: 'telegram-notifications',
    title: 'Telegram-уведомления',
    category: 'notifications',
    content: [
      { type: 'text', value: 'ReputationOS может присылать уведомления о новых отзывах прямо в ваш Telegram.' },
      { type: 'steps', items: [
        'Перейдите в раздел «Настройки».',
        'Найдите блок «Telegram».',
        'Нажмите «Подключить Telegram» — будет сгенерирована одноразовая ссылка.',
        'Перейдите по ссылке и отправьте команду боту.',
        'Бот подтвердит подключение.',
      ]},
      { type: 'note', value: 'Ссылка для подключения действует 15 минут. Если она истекла — создайте новую.' },
      { type: 'tip', value: 'Telegram-уведомления доступны на тарифах START, PRO и AGENCY.' },
      { type: 'link', label: 'Настройки уведомлений', href: '/settings' },
    ],
  },

  // ── Подписки и оплата ────────────────────────────────────────────────────────
  {
    id: 'trial',
    title: 'Как работает пробный период',
    category: 'billing',
    content: [
      { type: 'text', value: 'После регистрации вы автоматически получаете 7-дневный Business Trial с полным доступом к функциям тарифа PRO.' },
      { type: 'steps', items: [
        'Trial активируется сразу после регистрации — без ввода карты.',
        'Вы получаете доступ ко всем функциям PRO: источники, AI-ответы, Telegram.',
        'За 1–2 дня до окончания придёт напоминание.',
        'После окончания Trial аккаунт переходит на бесплатный тариф FREE.',
      ]},
      { type: 'tip', value: 'Чтобы сохранить все функции PRO, оформите подписку до окончания пробного периода.' },
      { type: 'link', label: 'Выбрать тариф', href: '/billing/checkout' },
    ],
  },
  {
    id: 'change-plan',
    title: 'Как сменить тариф',
    category: 'billing',
    content: [
      { type: 'text', value: 'Сменить тариф можно в любой момент — повышение вступает в силу сразу, понижение — со следующего расчётного периода.' },
      { type: 'steps', items: [
        'Перейдите в раздел «Тарифы» или нажмите на текущий тариф в шапке.',
        'Выберите нужный тариф.',
        'Нажмите «Оформить подписку».',
        'Введите данные карты или выберите ЮKassa.',
        'После оплаты новый тариф активируется немедленно.',
      ]},
      { type: 'link', label: 'Выбрать тариф', href: '/billing/checkout' },
    ],
  },
  {
    id: 'after-trial',
    title: 'Что будет после окончания Trial',
    category: 'billing',
    content: [
      { type: 'text', value: 'Когда 7-дневный Trial заканчивается, аккаунт автоматически переходит на тариф FREE.' },
      { type: 'steps', items: [
        'Доступ к источникам и данным сохраняется.',
        'Ограничиваются: количество компаний, AI-ответы, уведомления.',
        'Все собранные данные и история остаются на месте.',
        'В любой момент можно оформить платную подписку и вернуть полный доступ.',
      ]},
      { type: 'note', value: 'Данные не удаляются — переход на FREE просто ограничивает новые функции.' },
      { type: 'link', label: 'Оформить подписку', href: '/billing/checkout' },
    ],
  },
  {
    id: 'yookassa',
    title: 'Оплата через ЮKassa',
    category: 'billing',
    content: [
      { type: 'text', value: 'ReputationOS принимает оплату через ЮKassa — один из ведущих платёжных сервисов России.' },
      { type: 'steps', items: [
        'Выберите тариф и нажмите «Оформить подписку».',
        'Вы будете перенаправлены на страницу оплаты ЮKassa.',
        'Введите данные банковской карты или выберите другой способ оплаты.',
        'После успешной оплаты подписка активируется автоматически.',
      ]},
      { type: 'note', value: 'Все платёжные данные обрабатываются ЮKassa напрямую — ReputationOS не хранит данные карт.' },
      { type: 'tip', value: 'При возникновении проблем с оплатой свяжитесь с поддержкой — мы поможем разобраться.' },
    ],
  },

  // ── FAQ ──────────────────────────────────────────────────────────────────────
  {
    id: 'first-reviews',
    title: 'Когда появятся первые отзывы?',
    category: 'faq',
    content: [
      { type: 'text', value: 'Скорость появления данных зависит от источника и нагрузки на систему.' },
      { type: 'steps', items: [
        'Яндекс Карты: первые отзывы обычно появляются в течение 1–5 минут.',
        '2ГИС: первичная синхронизация занимает до 10–15 минут.',
        'Веб-страницы: первая проверка происходит в течение 30 минут после добавления.',
      ]},
      { type: 'note', value: 'Если данные не появились через 30 минут — проверьте правильность URL источника или напишите в поддержку.' },
      { type: 'tip', value: 'Новые отзывы проверяются автоматически по расписанию — вам не нужно ничего делать вручную.' },
    ],
  },
  {
    id: 'multiple-companies',
    title: 'Можно ли добавить несколько компаний?',
    category: 'faq',
    content: [
      { type: 'text', value: 'Да, ReputationOS поддерживает несколько компаний в одном аккаунте. Лимит зависит от тарифа.' },
      { type: 'steps', items: [
        'FREE: 1 компания.',
        'START: до 3 компаний.',
        'PRO: до 10 компаний.',
        'AGENCY: без ограничений.',
      ]},
      { type: 'tip', value: 'Все компании управляются из единого Workspace — переключайтесь между ними через боковое меню.' },
      { type: 'link', label: 'Выбрать тариф', href: '/billing/checkout' },
    ],
  },
  {
    id: 'source-not-connecting',
    title: 'Что делать, если источник не подключается?',
    category: 'faq',
    content: [
      { type: 'text', value: 'Если источник не удаётся подключить, попробуйте следующее:' },
      { type: 'steps', items: [
        'Убедитесь, что URL скопирован корректно — без лишних символов.',
        'Проверьте, что страница публично доступна (не требует авторизации).',
        'Для Яндекс Карт используйте ссылку на организацию, а не на карту.',
        'Попробуйте обновить страницу и добавить источник заново.',
        'Если проблема не решается — напишите в поддержку с примером URL.',
      ]},
      { type: 'tip', value: 'В большинстве случаев проблема решается правильным форматом ссылки.' },
    ],
  },
  {
    id: 'cancel-subscription',
    title: 'Можно ли отменить подписку?',
    category: 'faq',
    content: [
      { type: 'text', value: 'Да, подписку можно отменить в любой момент без штрафов.' },
      { type: 'steps', items: [
        'Перейдите на страницу тарифов.',
        'Нажмите «Управление подпиской».',
        'Выберите «Отменить подписку».',
        'Подтвердите отмену.',
      ]},
      { type: 'note', value: 'После отмены подписка остаётся активной до конца оплаченного периода. Данные сохраняются.' },
      { type: 'tip', value: 'Если вы передумаете — подписку можно возобновить в любой момент.' },
      { type: 'link', label: 'Управление тарифом', href: '/billing/checkout' },
    ],
  },
]

// ─── Sections config ────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'quickstart' as const,
    icon: <Rocket className="h-4 w-4" />,
    title: 'Быстрый старт',
  },
  {
    id: 'ai' as const,
    icon: <Bot className="h-4 w-4" />,
    title: 'AI-ответы',
  },
  {
    id: 'notifications' as const,
    icon: <Bell className="h-4 w-4" />,
    title: 'Уведомления',
  },
  {
    id: 'billing' as const,
    icon: <CreditCard className="h-4 w-4" />,
    title: 'Подписки и оплата',
  },
  {
    id: 'faq' as const,
    icon: <HelpCircle className="h-4 w-4" />,
    title: 'Частые вопросы',
  },
]

// ─── Content block renderer ─────────────────────────────────────────────────────

function renderBlock(block: ContentBlock, idx: number) {
  switch (block.type) {
    case 'text':
      return (
        <p key={idx} className="text-sm leading-6 text-slate-300">
          {block.value}
        </p>
      )
    case 'steps':
      return (
        <ol key={idx} className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-300">
                {i + 1}
              </span>
              <span className="leading-6 text-slate-300">{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'tip':
      return (
        <div key={idx} className="flex gap-3 rounded-[14px] border border-emerald-400/20 bg-emerald-500/[0.08] px-4 py-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-sm leading-6 text-emerald-200">{block.value}</p>
        </div>
      )
    case 'note':
      return (
        <div key={idx} className="flex gap-3 rounded-[14px] border border-amber-400/20 bg-amber-500/[0.07] px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm leading-6 text-amber-200">{block.value}</p>
        </div>
      )
    case 'link':
      return (
        <Link
          key={idx}
          href={block.href}
          className="inline-flex items-center gap-2 rounded-[14px] border border-cyan-400/25 bg-cyan-500/[0.09] px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/[0.16] active:scale-[0.97]"
        >
          {block.label}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )
  }
}

// ─── Props ──────────────────────────────────────────────────────────────────────

interface HelpCenterDrawerProps {
  open: boolean
  onClose: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function HelpCenterDrawer({ open, onClose }: HelpCenterDrawerProps) {
  const [activeArticle, setActiveArticle] = useState<HelpArticle | null>(null)
  const [search, setSearch] = useState('')
  const listScrollRef = useRef<HTMLDivElement>(null)
  const articleScrollRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const goBack = useCallback(() => {
    setActiveArticle(null)
    // Reset scroll position on list
    requestAnimationFrame(() => { listScrollRef.current?.scrollTo({ top: 0 }) })
  }, [])

  const openArticle = useCallback((article: HelpArticle) => {
    setActiveArticle(article)
    setSearch('')
    requestAnimationFrame(() => { articleScrollRef.current?.scrollTo({ top: 0 }) })
  }, [])

  // Keyboard: Esc closes article first, then drawer
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (activeArticle) goBack()
        else onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, activeArticle, goBack, onClose])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setActiveArticle(null)
      setSearch('')
    }
  }, [open])

  // Swipe right to go back
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (!activeArticle) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (dx > 64 && dy < 48) goBack()
  }

  if (!open) return null

  const searchLower = search.toLowerCase()
  const filtered = search
    ? ARTICLES.filter(a =>
        a.title.toLowerCase().includes(searchLower) ||
        a.content.some(b =>
          (b.type === 'text' || b.type === 'tip' || b.type === 'note')
            ? b.value.toLowerCase().includes(searchLower)
            : b.type === 'steps'
              ? b.items.some(i => i.toLowerCase().includes(searchLower))
              : false
        )
      )
    : null

  const isArticleOpen = Boolean(activeArticle)

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer shell */}
      <div
        className="animate-drawer-in absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-white/10 bg-[#060d18] shadow-[-20px_0_80px_rgba(0,0,0,0.6)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Fixed header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {isArticleOpen && (
              <button
                type="button"
                onClick={goBack}
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 transition hover:border-white/20 hover:text-white active:scale-[0.95]"
                aria-label="Назад"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">
                ReputationOS
              </div>
              <div className="mt-0.5 text-[15px] font-semibold tracking-[-0.025em] text-white">
                {isArticleOpen ? activeArticle!.title : 'Помощь и руководство'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white active:scale-[0.95]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sliding panels container */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-[200ms] ease-out"
            style={{
              width: '200%',
              transform: isArticleOpen ? 'translateX(-50%)' : 'translateX(0)',
            }}
          >
            {/* ── List panel ── */}
            <div
              ref={listScrollRef}
              className="h-full w-1/2 overflow-y-auto px-4 py-4"
              aria-hidden={isArticleOpen}
            >
              {/* Search */}
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  placeholder="Что вы хотите найти?"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-[16px] border border-white/10 bg-white/[0.05] py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/30 focus:bg-white/[0.08]"
                />
              </div>

              {/* Search results */}
              {filtered ? (
                <div>
                  {filtered.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Ничего не найдено. Попробуйте другой запрос.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Результаты ({filtered.length})
                      </div>
                      {filtered.map(article => (
                        <ArticleRow
                          key={article.id}
                          article={article}
                          onOpen={openArticle}
                          categoryLabel={SECTIONS.find(s => s.id === article.category)?.title}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Sections list */
                <div className="space-y-5">
                  {SECTIONS.map(section => {
                    const sectionArticles = ARTICLES.filter(a => a.category === section.id)
                    return (
                      <div key={section.id}>
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          <span className="text-slate-400">{section.icon}</span>
                          {section.title}
                        </div>
                        <div className="space-y-1">
                          {sectionArticles.map(article => (
                            <ArticleRow
                              key={article.id}
                              article={article}
                              onOpen={openArticle}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {/* Support block */}
                  <div className="mt-2 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                      <MessageCircle className="h-4 w-4 text-cyan-300" />
                      Поддержка
                    </div>
                    <p className="mb-3 text-sm leading-5 text-slate-400">
                      Не нашли ответ? Напишите нам — ответим быстро.
                    </p>
                    <a
                      href="https://t.me/reputationos_support"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-[14px] border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 active:scale-[0.97]"
                    >
                      Написать в Telegram
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* ── Article panel ── */}
            <div
              ref={articleScrollRef}
              className="h-full w-1/2 overflow-y-auto px-5 py-5"
              aria-hidden={!isArticleOpen}
            >
              {activeArticle && (
                <div className="space-y-4">
                  {/* Category badge */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {SECTIONS.find(s => s.id === activeArticle.category)?.icon}
                    {SECTIONS.find(s => s.id === activeArticle.category)?.title}
                  </span>

                  <h2 className="text-xl font-semibold leading-tight tracking-[-0.03em] text-white">
                    {activeArticle.title}
                  </h2>

                  <div className="h-px bg-white/[0.07]" />

                  {/* Content blocks */}
                  <div className="space-y-4">
                    {activeArticle.content.map((block, i) => renderBlock(block, i))}
                  </div>

                  {/* Back link at bottom */}
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-300"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Вернуться к списку
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ArticleRow sub-component ───────────────────────────────────────────────────

function ArticleRow({
  article,
  onOpen,
  categoryLabel,
}: {
  article: HelpArticle
  onOpen: (a: HelpArticle) => void
  categoryLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(article)}
      className="group flex w-full items-center justify-between rounded-[16px] border border-transparent px-3.5 py-2.5 text-left transition-all duration-150 hover:border-white/10 hover:bg-white/[0.055]"
    >
      <div className="min-w-0">
        <span className="block truncate text-sm text-slate-300 transition group-hover:text-white">
          {article.title}
        </span>
        {categoryLabel && (
          <span className="mt-0.5 block text-[11px] text-slate-600">{categoryLabel}</span>
        )}
      </div>
      <ChevronRight className="ml-3 h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-400" />
    </button>
  )
}
