import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Медиа-контексты для хореографии:
 * desktop — полные pin/scrub-сцены, mobile — упрощённые reveal,
 * reduced — статичные состояния без движения.
 */
export const MM = {
  desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 767.98px) and (prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;

export { gsap, ScrollTrigger };
