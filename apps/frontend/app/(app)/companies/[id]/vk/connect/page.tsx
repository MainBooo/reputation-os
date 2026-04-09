'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { completeVkConnect, getVkConnectStatus } from '@/lib/api/vk'

type Props = {
  params: {
    id: string
  }
}

export default function VkConnectPage({ params }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const attemptToken = searchParams.get('attemptToken') || ''

  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [browserUrl, setBrowserUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const iframeId = useMemo(() => 'vk-connect-frame', [])

  const loadStatus = useCallback(
    async (silent = false) => {
      if (!attemptToken) {
        setError('Не найден attemptToken для VK connect')
        return
      }

      if (!silent) {
        setRefreshing(true)
      }

      try {
        const res = await getVkConnectStatus(params.id, attemptToken)
        setStatus(res?.status || '')
        setConnected(res?.connected === true)
        setBrowserUrl(res?.browserUrl || null)
        setError(res?.errorMessage || '')

        if (res?.connected === true) {
          setMessage('VK уже подключён')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось получить статус VK connect')
      } finally {
        if (!silent) {
          setRefreshing(false)
        }
      }
    },
    [attemptToken, params.id]
  )

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body

    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlHeight = html.style.height
    const prevBodyHeight = body.style.height
    const prevHtmlOverscroll = html.style.overscrollBehavior
    const prevBodyOverscroll = body.style.overscrollBehavior

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.height = '100%'
    body.style.height = '100%'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'

    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      html.style.height = prevHtmlHeight
      body.style.height = prevBodyHeight
      html.style.overscrollBehavior = prevHtmlOverscroll
      body.style.overscrollBehavior = prevBodyOverscroll
    }
  }, [])

  function withIframeDocument<T>(callback: (doc: Document, win: Window) => T) {
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement | null
    const win = iframe?.contentWindow || null
    const doc = iframe?.contentDocument || win?.document || null

    if (!iframe || !win || !doc) {
      throw new Error('Окно VK ещё не готово')
    }

    return callback(doc, win)
  }

  function openKeyboard() {
    setError('')
    setMessage('')

    try {
      withIframeDocument((doc) => {
        const openers = [
          '#noVNC_keyboard_button',
          '.noVNC_keyboard_button',
          '[title*="keyboard" i]',
          '[aria-label*="keyboard" i]'
        ]

        for (const selector of openers) {
          const el = doc.querySelector(selector) as HTMLElement | null
          if (el) {
            el.click()
            break
          }
        }

        const focusTargets = [
          '#noVNC_keyboardinput',
          '#noVNC_hidden_keyboard_input',
          'textarea',
          'input[type="text"]'
        ]

        for (const selector of focusTargets) {
          const el = doc.querySelector(selector) as HTMLElement | null
          if (el && typeof el.focus === 'function') {
            el.focus()
            break
          }
        }
      })

      setMessage('Клавиатура активирована. Если iPhone не показал её сразу, нажмите кнопку ещё раз.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось открыть клавиатуру')
    }
  }

  async function onComplete() {
    if (!attemptToken) {
      setError('Не найден attemptToken для завершения VK connect')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      await completeVkConnect(params.id, attemptToken)
      setMessage('VK успешно подключён')
      router.push(`/companies/${params.id}/vk`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось завершить подключение VK')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-28">
      <Card className="p-4">
        <div className="text-lg font-semibold text-brand">Авторизация VK</div>
        <div className="mt-2 text-sm text-muted">
          На iPhone клавиатура не всегда появляется от обычного тапа по удалённому окну.
          Сначала нажмите в поле телефона внутри VK, потом нажмите большую кнопку «Открыть клавиатуру» ниже.
        </div>

        <div className="mt-3 text-xs text-muted">
          Статус: {status || '—'} {connected ? '• подключено' : ''}
        </div>

        {error ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}
        {message ? <div className="mt-3 text-sm text-emerald-400">{message}</div> : null}
      </Card>

      <div className="overflow-hidden rounded-2xl border border-line bg-black">
        {browserUrl ? (
          <iframe
            id={iframeId}
            src={browserUrl}
            title="VK Connect"
            className="h-[85vh] w-full bg-black"
          />
        ) : (
          <div className="flex h-[85vh] items-center justify-center text-sm text-muted">
            Загружаем удалённое окно VK...
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row">
          <Button type="button" className="w-full sm:w-auto" onClick={openKeyboard}>
            Открыть клавиатуру
          </Button>

          <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={refreshing} onClick={() => void loadStatus()}>
            {refreshing ? 'Проверка...' : 'Проверить статус'}
          </Button>

          <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={loading} onClick={onComplete}>
            {loading ? 'Сохраняем...' : 'Я авторизовался'}
          </Button>
        </div>
      </div>
    </div>
  )
}
