"use client";

import { useEffect } from "react";

// This component suppresses linkifyjs re-initialization warnings
// that occur when multiple BlockNote editors are created
export default function LinkifyWarningSuppress() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const originalWarn = console.warn;
    console.warn = function(...args: any[]) {
      // Check if any of the arguments contain the linkifyjs warning
      const isLinkifyWarning = args.some(arg =>
        typeof arg === 'string' && arg.includes('linkifyjs: already initialized')
      );
      if (isLinkifyWarning) {
        return; // Suppress this specific warning
      }
      originalWarn.apply(console, args);
    };

    // Cleanup: restore original console.warn on unmount
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  return null;
}
