"use client";

import { useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";

/**
 * Returns Framer Motion transition/variant config respecting
 * prefers-reduced-motion and RTL direction.
 */
export function useMotionConfig() {
  const shouldReduce = useReducedMotion();
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const dir = isRtl ? -1 : 1; // flip x-based animations for RTL

  return { shouldReduce, dir };
}

/** Stagger container variant */
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/** Child variant for spring-mount (stat cards, list items) */
export const springItem = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
};

/** Child variant for smooth fade-up (hero text, feature cards) */
export const fadeUpItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/** Tight stagger for calendar rows (0.03s between rows) */
export const calendarRowContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

export const calendarRowItem = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/** Page transition (used in AnimatePresence) */
export const pageVariants = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.2, ease: [0.42, 0, 1, 1] as const } },
};
