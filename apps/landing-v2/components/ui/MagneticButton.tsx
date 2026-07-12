'use client';

import { useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { gsap, prefersReducedMotion } from '@/lib/gsap';

export default function MagneticButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (prefersReducedMotion() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(ref.current, { x: x * 0.25, y: y * 0.35, duration: 0.4, ease: 'power3.out' });
  };

  const onLeave = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  };

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={clsx(
        'inline-block rounded-full bg-electric px-8 py-4 font-display text-sm font-semibold text-white',
        'transition-colors hover:bg-electric/90',
        className,
      )}
    >
      {children}
    </a>
  );
}
