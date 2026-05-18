'use client'

export default function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
    >
      Скачать PDF
    </button>
  )
}
