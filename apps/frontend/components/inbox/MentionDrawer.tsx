'use client'

export default function MentionDrawer({ mention }: { mention: any }) {
  if (!mention) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-500">
        Select mention
      </div>
    )
  }

  return (
    <div className="p-6 h-full overflow-auto border-l border-zinc-800">
      <div className="text-xs text-zinc-500 mb-2">
        {mention.platform} • {mention.type}
      </div>

      <div className="text-lg font-semibold mb-4">
        {mention.content}
      </div>

      <div className="flex gap-2 mb-6">
        <span className="px-2 py-1 text-xs rounded bg-zinc-700">
          {mention.sentiment}
        </span>

        <span className="px-2 py-1 text-xs rounded bg-zinc-700">
          {mention.status}
        </span>
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-2 bg-blue-600 rounded text-sm">
          Reply (AI)
        </button>

        <button className="px-3 py-2 bg-zinc-700 rounded text-sm">
          Open source
        </button>
      </div>
    </div>
  )
}
