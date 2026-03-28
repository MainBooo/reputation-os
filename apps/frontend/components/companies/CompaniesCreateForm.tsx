'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { createCompany, getWorkspaces } from '@/lib/api/companies'

type Workspace = {
  id: string
  name: string
}

type CreatedCompany = {
  id: string
}

export default function CompaniesCreateForm() {
  const router = useRouter()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [city, setCity] = useState('')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getWorkspaces()
      .then((data: Workspace[]) => {
        if (!active) return
        setWorkspaces(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaceId(data[0].id)
        }
      })
      .catch((e: Error) => {
        if (!active) return
        setError(e.message || 'Не удалось загрузить рабочие пространства')
      })

    return () => {
      active = false
    }
  }, [])

  const canSubmit = useMemo(() => {
    return Boolean(workspaceId && name.trim()) && !loading
  }, [workspaceId, name, loading])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!workspaceId) {
      setError('Не найден workspace для создания компании')
      return
    }

    if (!name.trim()) {
      setError('Введите название компании')
      return
    }

    setLoading(true)

    try {
      const company = (await createCompany({
        workspaceId,
        name: name.trim(),
        website: website.trim() || undefined,
        city: city.trim() || undefined,
        industry: industry.trim() || undefined
      })) as CreatedCompany

      router.push(`/companies/${company.id}`)
      router.refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось создать компанию'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4">
        <div className="text-lg font-semibold text-brand">Добавить компанию</div>
        <div className="mt-1 text-sm text-muted">
          Создайте компанию и сразу перейдите в её рабочее пространство.
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название компании"
        />

        <Input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="Сайт (необязательно)"
        />

        <Input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Город (необязательно)"
        />

        <Input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Отрасль (необязательно)"
        />

        {workspaces.length > 1 ? (
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm text-brand"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        ) : null}

        {error ? <div className="text-sm text-red-400">{error}</div> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit}>
            {loading ? 'Создание...' : 'Создать компанию'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
