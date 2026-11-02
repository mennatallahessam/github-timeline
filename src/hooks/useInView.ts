import { useEffect, useRef, useState, type RefObject } from 'react';

type Listener = (entry: IntersectionObserverEntry) => void;

const listeners = new WeakMap<Element, Listener>();
let sharedObserver: IntersectionObserver | null = null;

/** One observer for all cards: hundreds of entries would otherwise mean hundreds of observers. */
function getObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) listeners.get(entry.target)?.(entry);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
  }
  return sharedObserver;
}

const supportsObserver = (): boolean =>
  typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function';

/**
 * Reports once an element has entered the viewport (it never flips back, so
 * cards don't re-animate while scrolling). Without IntersectionObserver
 * support the element is treated as visible immediately.
 */
export function useInView<T extends Element>(): { ref: RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => !supportsObserver());

  useEffect(() => {
    const element = ref.current;
    if (!element || inView || !supportsObserver()) return undefined;

    const observer = getObserver();
    const stop = () => {
      observer.unobserve(element);
      listeners.delete(element);
    };
    listeners.set(element, (entry) => {
      if (entry.isIntersecting) {
        setInView(true);
        stop();
      }
    });
    observer.observe(element);
    return stop;
  }, [inView]);

  return { ref, inView };
}
