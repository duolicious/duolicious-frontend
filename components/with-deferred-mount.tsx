import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type RandomDelay = {
  min: number;
  max: number;
};

type WithDeferredMountProps = {
  children: ReactNode | (() => ReactNode);
  /**
   * Fixed delay in milliseconds before mounting children.
   * Ignored if randomDelay is provided.
   */
  delay?: number;
  /**
   * Randomized delay range (inclusive of min, exclusive of max).
   * Takes precedence over delay when provided.
   */
  randomDelay?: RandomDelay;
};

const WithDeferredMount = ({
  children,
  delay,
  randomDelay,
}: WithDeferredMountProps) => {
  const computeDelay = (): number => {
    if (randomDelay) {
      const min = Math.max(0, Math.trunc(randomDelay.min));
      const max = Math.max(min, Math.trunc(randomDelay.max));
      return Math.floor(min + Math.random() * (max - min));
    } else {
      return Math.max(0, Math.trunc(delay ?? 0));
    }
  };

  // Compute once per mount so the delay doesn't change on re-renders
  const delayRef = useRef<number>(-1);
  if (delayRef.current < 0) delayRef.current = computeDelay();

  const [ready, setReady] = useState(delayRef.current === 0);

  useEffect(() => {
    if (ready) {
      return;
    }

    const id = setTimeout(() => setReady(true), delayRef.current);

    return () => clearTimeout(id);
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <>
      {
        typeof children === 'function'
          ? (children as () => ReactNode)()
          : children
      }
    </>
  );
};

export { WithDeferredMount };
