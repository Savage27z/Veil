import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const HEX = '0123456789abcdef';
const randHex = (n: number) =>
  Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('');

/**
 * The signature motion of the product: a value that looks like an on-chain
 * handle, churning as ciphertext, then resolving into a readable number for
 * the one wallet allowed to see it.
 *
 * Deliberately *not* a generic text scramble — it holds the hex long enough to
 * read as encrypted data, then resolves left-to-right so the reveal feels like
 * decryption rather than a slot machine.
 */
export function Decrypt({
  value,
  /** ms of ciphertext churn before the reveal begins */
  hold = 900,
  /** ms for the reveal itself */
  reveal = 700,
  className,
  onDone,
}: {
  value: string;
  hold?: number;
  reveal?: number;
  className?: string;
  onDone?: () => void;
}) {
  const reduced = useReducedMotion();
  const [text, setText] = useState(() => (reduced ? value : randHex(value.length)));
  const doneRef = useRef(false);

  // `onDone` is routinely a fresh inline closure on every render of whatever
  // renders this component. It must never sit in the effect's dependency
  // array below: doing so tears down and restarts the whole animation on
  // any unrelated ancestor re-render, and if those re-renders ever land
  // faster than one animation frame apart, every scheduled frame gets
  // cancelled before it can paint and the reveal never completes at all —
  // this exact failure was caught live (the effect restarted 7+ times in
  // 3 seconds with zero rendered frames). A ref sidesteps the identity
  // check entirely: the animation's timing is driven only by real prop
  // changes, while the callback it fires always reads as "latest".
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (reduced) {
      setText(value);
      onDoneRef.current?.();
      return;
    }

    doneRef.current = false;
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;

      if (elapsed < hold) {
        // Pure ciphertext. Churn at ~20fps so it reads as data, not noise.
        if (Math.floor(elapsed / 50) !== Math.floor((elapsed - 16) / 50)) {
          setText(randHex(value.length));
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const p = Math.min(1, (elapsed - hold) / reveal);
      const settled = Math.floor(p * value.length);
      setText(
        value.slice(0, settled) +
          randHex(Math.max(0, value.length - settled)),
      );

      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setText(value);
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current?.();
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, hold, reveal, reduced]);

  return (
    <span className={className} aria-label={value}>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

/**
 * A number that counts up in real time, the way a live stream actually accrues.
 * Used on the landing hero and mirrored by the real contract in the app.
 */
export function LiveCounter({
  ratePerSecond,
  startValue,
  decimals = 2,
  className,
}: {
  ratePerSecond: number;
  startValue: number;
  decimals?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(startValue);

  useEffect(() => {
    if (reduced) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setValue(startValue + ((now - t0) / 1000) * ratePerSecond);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ratePerSecond, startValue, reduced]);

  return (
    <span className={className}>
      {value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
