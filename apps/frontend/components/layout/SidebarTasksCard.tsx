'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react'
import clsx from 'clsx'

type Task = {
  id: string
  title: string
  done: boolean
}

const STORAGE_KEY = 'reputation-os-sidebar-tasks'

const defaultTasks: Task[] = [
  {
    id: '1',
    title: 'Проверить новые WEB-упоминания',
    done: false
  },
  {
    id: '2',
    title: 'Ответить на негативные отзывы',
    done: false
  }
]

export default function SidebarTasksCard() {
  const [tasks, setTasks] = useState<Task[]>(defaultTasks)
  const [value, setValue] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setTasks(JSON.parse(saved))
      }
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const completed = useMemo(
    () => tasks.filter((task) => task.done).length,
    [tasks]
  )

  function toggleTask(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, done: !task.done }
          : task
      )
    )
  }

  function addTask() {
    const trimmed = value.trim()

    if (!trimmed) return

    setTasks((prev) => [
      {
        id: crypto.randomUUID(),
        title: trimmed,
        done: false
      },
      ...prev
    ])

    setValue('')
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0

  return (
    <div className="mt-7 rounded-[30px] border border-fuchsia-400/20 bg-gradient-to-br from-cyan-400/[0.10] via-white/[0.035] to-fuchsia-400/[0.10] p-6 shadow-[0_0_44px_rgba(168,85,247,0.16)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Sparkles size={16} className="text-cyan-200" />
          Сегодня
        </div>

        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] font-medium text-cyan-100">
          {completed}/{tasks.length}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 transition hover:border-cyan-300/30 hover:bg-white/[0.04]"
          >
            <button
              type="button"
              onClick={() => toggleTask(task.id)}
              className={clsx(
                'flex h-5 w-5 items-center justify-center rounded-full border transition',
                task.done
                  ? 'border-cyan-300/40 bg-cyan-400/20 text-cyan-100'
                  : 'border-white/15 bg-white/[0.03] text-transparent hover:border-cyan-300/30'
              )}
            >
              <Check size={12} />
            </button>

            <div
              className={clsx(
                'flex-1 text-sm transition',
                task.done
                  ? 'text-slate-500 line-through'
                  : 'text-slate-200'
              )}
            >
              {task.title}
            </div>

            <button
              type="button"
              onClick={() => removeTask(task.id)}
              className="opacity-0 transition group-hover:opacity-100 text-slate-500 hover:text-red-300"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTask()
          }}
          placeholder="Новая задача..."
          className="h-10 flex-1 rounded-2xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30"
        />

        <button
          type="button"
          onClick={addTask}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/20"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-200 to-yellow-200 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 text-xs text-slate-400">
          {tasks.length === 0
            ? 'Все задачи выполнены ✨'
            : `${progress}% выполнено`}
        </div>
      </div>
    </div>
  )
}
