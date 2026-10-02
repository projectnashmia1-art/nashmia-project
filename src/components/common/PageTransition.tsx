import { type ReactNode } from "react";

/**
 * Linear-style Instant Page Transition
 * - Fast, subtle crossfade (180ms)
 * - Minimal 4-6px upward movement on entry
 * - Smooth ease-out easing (0.16, 1, 0.3, 1)
 * - Zero delay: starts immediately with component mount
 * - No full-screen white overlay or center text
 * - Zero flickering, zero layout shifts
 * - Non-blocking: avoids freezing the navbar/sidebar
 * - Respects prefers-reduced-motion accessibility
 */
export function PageTransition({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`linear-page-transition w-full min-w-0 max-w-full ${className}`.trim()}>
      {children}
    </div>
  );
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
