import { useState, useEffect } from "react";

/**
 * checkIsDesktop — pure check whether current viewport >= breakpoint.
 */
export function checkIsDesktop(breakpoint = 768) {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia(`(min-width: ${breakpoint}px)`).matches;
  } catch {
    return false;
  }
}

/**
 * useResponsive — detects whether the current viewport matches or exceeds
 * the desktop breakpoint (default: 768px). Returns { isDesktop, isMobile }.
 *
 * Ensures 100% preservation of mobile phone viewports while enabling
 * responsive desktop shell & multi-column layouts on larger screens.
 */
export function useResponsive(breakpoint = 768) {
  const [isDesktop, setIsDesktop] = useState(() => checkIsDesktop(breakpoint));

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e) => setIsDesktop(e.matches);

    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, [breakpoint]);

  return { isDesktop, isMobile: !isDesktop };
}
