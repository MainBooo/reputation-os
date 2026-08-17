'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Building2, ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'
import { apiFetch } from '@/lib/api/client'
import { WORKSPACE_QUERY_KEY, WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'
import { useChatContext } from '@/lib/chat/ChatContext'

type Workspace = { id: string; name: string; slug: string }

export default function WorkspaceSwitcher({ dropdownAlign = 'down' }: { dropdownAlign?: 'up' | 'down' }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { workspaceId, setWorkspaceId } = useChatContext()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch<Workspace[]>('/workspaces', undefined, [])
      .then((data) => { if (Array.isArray(data)) setWorkspaces(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const current = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0]

  function select(w: Workspace) {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, w.id)
    setWorkspaceId(w.id)

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set(WORKSPACE_QUERY_KEY, w.id)
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false })
    setOpen(false)
  }

  if (!current) return null

  const label = current.name || current.slug || 'Workspace'
  const canSwitch = workspaces.length > 1

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white transition shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
          canSwitch
            ? 'hover:border-cyan-400/30 hover:bg-white/[0.07] cursor-pointer'
            : 'cursor-default'
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-cyan-300" />
        <span className="max-w-[160px] truncate font-medium">{label}</span>
        {canSwitch && (
          <ChevronDown
            className={clsx(
              'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        )}
      </button>

      {open && (
        <div
          className={clsx(
            'absolute left-0 z-50 min-w-[200px] rounded-[18px] border border-white/10 bg-[#070b16] py-1.5 shadow-2xl',
            dropdownAlign === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {workspaces.map((w) => {
            const active = w.id === current?.id
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => select(w)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition hover:bg-white/[0.05]"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                <span
                  className={clsx(
                    'flex-1 truncate text-left',
                    active ? 'font-medium text-cyan-200' : 'text-white'
                  )}
                >
                  {w.name || w.slug}
                </span>
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-cyan-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
