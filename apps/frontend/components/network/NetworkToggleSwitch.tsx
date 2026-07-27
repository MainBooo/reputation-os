'use client'

import { Lock } from 'lucide-react'

export default function NetworkToggleSwitch({
  enabled,
  locked,
  busy,
  onClick
}: {
  enabled: boolean
  locked: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-300">
        {locked ? 'Недоступно на вашем тарифе' : enabled ? 'Включён' : 'Выключен'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={busy}
        onClick={onClick}
        className={[
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition',
          locked ? 'bg-white/10' : enabled ? 'bg-cyan-500' : 'bg-white/15',
          busy ? 'opacity-60 cursor-not-allowed' : ''
        ].join(' ')}
      >
        <span
          className={[
            'inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-black transition',
            enabled && !locked ? 'translate-x-6' : 'translate-x-1'
          ].join(' ')}
        >
          {locked ? <Lock className="h-3 w-3 text-zinc-400" /> : null}
        </span>
      </button>
    </div>
  )
}
