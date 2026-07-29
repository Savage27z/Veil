import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/* ─────────────────────────────────────────────────────────
 * Shared motion primitives.
 *
 * Every animation in VEIL routes through here so that
 * reduced-motion is handled in exactly one place, and so the
 * timing vocabulary stays consistent across landing + app.
 * ───────────────────────────────────────────────────────── */

export const SPRING = {
  /** Crisp, settles fast. Headers and top content. */
  stiff: { type: 'spring' as const, stiffness: 350, damping: 28 },
  /** Smooth, slightly softer. Panels and cards. */
  smooth: { type: 'spring' as const, stiffness: 300, damping: 30 },
  /** A little overshoot. Hero elements only. */
  bouncy: { type: 'spring' as const, stiffness: 280, damping: 26 },
};

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Drives a multi-section entrance from a single integer.
 * Sections check `stage >= n`, so once something appears it stays.
 */
export function useStage(steps: number[]): number {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(reduced ? steps.length : 0);

  useEffect(() => {
    if (reduced) {
      setStage(steps.length);
      return;
    }
    const timers = steps.map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return stage;
}

type RevealProps = {
  children: ReactNode;
  show: boolean;
  /** Positive slides up into place, negative slides down. */
  offsetY?: number;
  offsetX?: number;
  spring?: typeof SPRING.stiff;
  delay?: number;
  className?: string;
};

/** A section that fades and slides into place once `show` flips true. */
export function Reveal({
  children,
  show,
  offsetY = 16,
  offsetX = 0,
  spring = SPRING.stiff,
  delay = 0,
  className,
}: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: offsetY, x: offsetX }}
      animate={{
        opacity: show ? 1 : 0,
        y: show ? 0 : offsetY,
        x: show ? 0 : offsetX,
      }}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Reveals on scroll into view. Used below the fold only. */
export function RevealOnScroll({
  children,
  offsetY = 20,
  delay = 0,
  className,
}: Omit<RevealProps, 'show'>) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: offsetY }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...SPRING.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered list. Uses explicit per-index delays rather than
 * staggerChildren, which is unreliable alongside AnimatePresence.
 */
export function Stagger({
  children,
  show,
  stagger = 0.06,
  className,
}: {
  children: ReactNode[];
  show: boolean;
  stagger?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: show ? 1 : 0, y: show ? 0 : 12 }}
          transition={{ ...SPRING.smooth, delay: show ? i * stagger : 0 }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
