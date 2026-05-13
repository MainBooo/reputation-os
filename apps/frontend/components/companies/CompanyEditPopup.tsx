'use client'

import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import CompanyEditPanel from '@/components/companies/CompanyEditPanel'

export default function CompanyEditPopup({
  company,
  yandexUrl,
  twoGisUrl
}: {
  company: any
  yandexUrl: string
  twoGisUrl: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-[86px] w-full items-center justify-center overflow-hidden rounded-[32px] border border-cyan-300/40 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.26),transparent_36%),radial-gradient(circle_at_100%_0%,rgba(217,70,239,0.32),transparent_36%),rgba(7,13,28,0.94)] px-5 text-lg font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_60px_rgba(34,211,238,0.28),0_0_96px_rgba(217,70,239,0.18)] transition hover:border-fuchsia-300/55 hover:brightness-110"
      >
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.16),rgba(168,85,247,0.18),rgba(217,70,239,0.22))]" />
        <span className="relative inline-flex items-center gap-4">
          <Pencil className="h-6 w-6 text-violet-200 drop-shadow-[0_0_16px_rgba(168,85,247,0.9)]" />
          Редактировать компанию
          <span className="text-3xl text-fuchsia-300 transition group-hover:translate-x-1">›</span>
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-3 py-6 backdrop-blur-xl sm:px-6 sm:py-10">
          <div className="mx-auto w-full max-w-3xl pb-28">
            <div className="relative rounded-[32px] border border-blue-300/20 bg-[#080D24]/95 p-4 shadow-[0_0_90px_rgba(59,130,246,0.26)] sm:p-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-white/[0.08] p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>

              <CompanyEditPanel company={company} yandexUrl={yandexUrl} twoGisUrl={twoGisUrl} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
