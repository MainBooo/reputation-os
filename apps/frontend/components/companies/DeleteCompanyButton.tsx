'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { deleteCompany } from '@/lib/api/companies'

export default function DeleteCompanyButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onDelete() {
    const ok = window.confirm(`Удалить компанию "${name}"? Это действие нельзя отменить.`)
    if (!ok) return

    setLoading(true)
    try {
      await deleteCompany(id)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить компанию')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onDelete}
      disabled={loading}
      className="text-red-400 hover:text-red-300"
    >
      {loading ? 'Удаление...' : 'Удалить'}
    </Button>
  )
}
