'use client';

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';

interface SmartHeaderProps {
  children: ReactNode;
}

const SHOW_AT_TOP = 24;
const HIDE_AFTER = 120;
const HIDE_DISTANCE = 28;
const SHOW_DISTANCE = 14;

export default function SmartHeader({ children }: SmartHeaderProps) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastYRef = useRef(0);
  const directionRef = useRef<'up' | 'down' | null>(null);
  const distanceRef = useRef(0);

  useEffect(() => {
    lastYRef.current = Math.max(0, window.scrollY);
    setScrolled(lastYRef.current > SHOW_AT_TOP);
    let frame = 0;

    const update = () => {
      frame = 0;
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastYRef.current;
      lastYRef.current = currentY;
      setScrolled(currentY > SHOW_AT_TOP);

      if (currentY <= SHOW_AT_TOP) {
        directionRef.current = null;
        distanceRef.current = 0;
        setHidden(false);
        return;
      }

      if (Math.abs(delta) < 1) return;
      const direction = delta > 0 ? 'down' : 'up';
      if (directionRef.current !== direction) {
        directionRef.current = direction;
        distanceRef.current = 0;
      }
      distanceRef.current += Math.abs(delta);

      if (
        direction === 'down' &&
        currentY > HIDE_AFTER &&
        distanceRef.current >= HIDE_DISTANCE
      ) {
        setHidden(true);
        distanceRef.current = 0;
      } else if (direction === 'up' && distanceRef.current >= SHOW_DISTANCE) {
        setHidden(false);
        distanceRef.current = 0;
      }
    };

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const handleFocus = (_event: FocusEvent<HTMLElement>) => setHidden(false);

  return (
    <header
      className={`site-header smart-header${hidden ? ' is-hidden' : ''}${scrolled ? ' is-scrolled' : ''}`}
      onFocus={handleFocus}
    >
      {children}
    </header>
  );
}
