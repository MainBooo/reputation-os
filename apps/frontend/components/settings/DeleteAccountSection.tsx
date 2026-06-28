'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { me, deleteMyAccount, logoutLocal } from '@/lib/api/auth'

export default function DeleteAccountSection() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentEmail, setCurrentEmail] = useState('')

  useEffect(() => {
    me().then((u) => { if (u?.email) setCurrentEmail(u.email) }).catch(() => {})
  }, [])

  function openModal() { setOpen(true); setEmailInput(''); setError('') }
  function closeModal() { setOpen(false); setEmailInput(''); setError('') }

  const canConfirm = Boolean(currentEmail) && emailInput.toLowerCase() === currentEmail.toLowerCase()

  async function handleDelete() {
    if (!canConfirm || loading) return
    setLoading(true)
    setError('')
    try {
      await deleteMyAccount()
      logoutLocal()
      router.push('/login')
    } catch (e: any) {
      setError(e?.message || 'Ошибка удаления аккаунта')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mt-8 overflow-hidden rounded-[24px] border border-red-500/20 bg-[#0b111c] p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-red-300">Опасная зона</span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-white">Удалить аккаунт</div>
            <div className="mt-1 text-xs leading-5 text-zinc-500">
              После удаления вы потеряете доступ к workspace, уведомлениям и настройкам.
              Если вы единственный владелец workspace — сначала передайте роль другому участнику.
            </div>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
          >
            Удалить мой аккаунт
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-[24px] border border-white/10 bg-[#070b16] p-6 shadow-2xl">
            <div className="mb-1 text-lg font-semibold text-white">Удалить аккаунт?</div>
            <div className="mb-4 text-sm text-zinc-400">
              Это действие отключит ваш аккаунт и удалит доступ к сервису. Персональные данные будут скрыты.
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs text-zinc-500">
                Введите ваш email для подтверждения
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                placeholder={currentEmail || 'ваш@email.com'}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-white/20"
              />
            </div>
            {error && (
              <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/[0.05] px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canConfirm || loading}
                className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Удаление...' : 'Удалить аккаунт'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
