/**
 * ScrollToTop — Scrolls to top on route change
 * 
 * Critical UX fix: Without this, navigating between routes
 * leaves the user scrolled mid-page. This component resets
 * scroll position to the top on every navigation.
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Don't scroll if navigating to a hash anchor
    if (window.location.hash) return;

    // Use instant scroll for route changes (not smooth — avoids disorienting long scrolls)
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

export default ScrollToTop;
