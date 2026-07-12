import { REGISTER_URL } from '@/data/mock';

export default function Header() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 mix-blend-difference">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a href="#" className="pointer-events-auto font-display text-sm font-bold text-white">
          Reputation<span className="opacity-60">OS</span>
        </a>
        <a
          href={REGISTER_URL}
          className="pointer-events-auto rounded-full border border-white/40 px-5 py-2 font-mono text-xs text-white transition-colors hover:bg-white hover:text-black"
        >
          Попробовать бесплатно
        </a>
      </div>
    </header>
  );
}
