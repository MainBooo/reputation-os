'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, LockKeyhole, XCircle } from 'lucide-react'
import { acceptWorkspaceInvite } from '@/lib/api/workspaces'

function formatAcceptInviteError(message: string) {
  if (message.includes('Unauthorized')) {
    return 'Чтобы принять приглашение, сначала войдите в аккаунт с тем email, на который отправили invite.'
  }

  if (message.includes('Invite not found')) return 'Приглашение не найдено. Возможно, ссылка неверная.'
  if (message.includes('Invite already accepted')) return 'Это приглашение уже было принято.'
  if (message.includes('Invite expired')) return 'Срок действия приглашения истёк.'
  if (message.includes('Invite email mismatch')) return 'Email текущего аккаунта не совпадает с email приглашения.'
  if (message.includes('Workspace user limit reached')) return 'Лимит тарифа: максимум 2 пользователя в workspace.'

  return message || 'Не удалось принять приглашение.'
}

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Проверяем приглашение...')

  useEffect(() => {
    let active = true

    async function run() {
      if (!token) {
        setStatus('error')
        setMessage('В ссылке нет token приглашения.')
        return
      }

      try {
        await acceptWorkspaceInvite(token)
        if (!active) return

        setStatus('success')
        setMessage('Приглашение принято. Workspace добавлен к вашему аккаунту.')

        setTimeout(() => {
          router.replace('/team')
          router.refresh()
        }, 1200)
      } catch (e) {
        if (!active) return
        const errorMessage = e instanceof Error ? e.message : 'Не удалось принять приглашение.'
        setStatus('error')
        setMessage(formatAcceptInviteError(errorMessage))
      }
    }

    run()

    return () => {
      active = false
    }
  }, [router, token])

  const Icon = status === 'loading' ? Loader2 : status === 'success' ? CheckCircle2 : XCircle

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 text-white">
      <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[#07111f]/90 shadow-[0_24px_90px_rgba(0,0,0,0.55),0_0_60px_rgba(34,211,238,0.14)]">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] p-7">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
              <Icon className={`h-7 w-7 ${status === 'loading' ? 'animate-spin' : ''}`} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">Приглашение в workspace</h1>
              <p className="mt-1 text-sm text-slate-400">ReputationOS Team Access</p>
            </div>
          </div>
        </div>

        <div className="p-7">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm leading-6 text-slate-200">
            {message}
          </div>

          {status === 'error' ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/login?next=/accept-invite?token=${encodeURIComponent(token)}`}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.14] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/[0.22]"
              >
                <LockKeyhole className="h-4 w-4" />
                Войти
              </Link>

              <Link
                href={`/register?next=/accept-invite?token=${encodeURIComponent(token)}`}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                Зарегистрироваться
              </Link>
            </div>
          ) : null}

          {status === 'success' ? (
            <Link
              href="/team"
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.14] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/[0.22]"
            >
              Перейти в команду
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function AcceptInviteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020617] px-4 py-10 text-white">
      <div className="rounded-[28px] border border-cyan-400/20 bg-[#07111f]/90 p-7 text-sm text-slate-200">
        Проверяем приглашение...
      </div>
    </main>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteFallback />}>
      <AcceptInviteContent />
    </Suspense>
  )
}
