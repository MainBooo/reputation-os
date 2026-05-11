import Image from 'next/image'

type ScreenshotFrameProps = {
  src: string
  alt: string
  label: string
  caption: string
  priority?: boolean
}

export function ScreenshotFrame({
  src,
  alt,
  label,
  caption,
  priority = false
}: ScreenshotFrameProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-4 md:p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
          <span className="h-3 w-3 rounded-full bg-green-400/80" />
        </div>

        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-medium text-slate-200 md:text-sm">
          {label}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#07101f] p-2 md:p-3">
        <Image
          src={src}
          alt={alt}
          width={1600}
          height={1000}
          priority={priority}
          className="h-auto w-full rounded-xl object-contain"
        />
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
        {caption}
      </p>
    </div>
  )
}
