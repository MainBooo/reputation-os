'use client'

export default function ConfirmModal({
  title,
  description,
  confirmLabel = 'Подтвердить',
  danger = false,
  onConfirm,
  onCancel
}: {
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-[24px] border border-white/10 bg-[#070b16] p-6 shadow-2xl">
        <div className="mb-2 text-lg font-semibold text-white">{title}</div>
        <div className="mb-6 text-sm text-zinc-400">{description}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className={danger
              ? 'rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/25'
              : 'rounded-xl border border-cyan-400/20 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/25'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
