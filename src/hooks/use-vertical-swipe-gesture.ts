import { useEffect, useRef, useState, useCallback } from "react";

export interface VerticalSwipeGestureOptions {
  /**
   * Callback invoked when a downward swipe gesture meets the threshold or velocity to dismiss.
   */
  onDismiss: () => void;
  /**
   * Minimum distance in pixels dragged downward to trigger dismissal.
   * Default: 75
   */
  threshold?: number;
  /**
   * Minimum velocity in px/ms downward to trigger dismissal on flick gestures.
   * Default: 0.38
   */
  velocityThreshold?: number;
  /**
   * Whether the swipe gesture detection is enabled. Typically true on mobile viewports (< 640px).
   * Default: true
   */
  enabled?: boolean;
  /**
   * When true, only touch gestures originating directly on the drag handle will initiate dismissal.
   * Ideal for dense form modals with heavy scrollable areas.
   * Default: false
   */
  onlyHandle?: boolean;
  /**
   * Callback providing normalized drag progress (0 to 1) for fading backdrops or dynamic transforms.
   */
  onDragProgress?: (progress: number) => void;
  /**
   * Callback fired when dragging begins.
   */
  onDragStart?: () => void;
  /**
   * Callback fired when dragging ends, indicating whether dismissal was triggered.
   */
  onDragEnd?: (dismissed: boolean) => void;
}

export interface VerticalSwipeGestureResult<T extends HTMLElement = HTMLElement> {
  elementRef: React.MutableRefObject<T | null>;
  handleRef: React.MutableRefObject<HTMLElement | null>;
  isDragging: boolean;
  resetPosition: (animate?: boolean) => void;
  triggerDismiss: () => void;
}

/**
 * Checks if an element is a vertically scrollable container.
 */
function isScrollableContainer(node: HTMLElement): boolean {
  if (!node || node === document.body || node === document.documentElement) {
    return false;
  }
  try {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const isScrollableType =
      overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    return isScrollableType && node.scrollHeight > node.clientHeight + 1;
  } catch {
    return false;
  }
}

/**
 * Traverses from target up to the boundary element.
 * Returns true if ANY ancestor has scrolled down (scrollTop > 1), meaning downward touch
 * is intended to scroll the content upward, NOT drag the sheet down.
 */
function hasScrolledAncestor(target: HTMLElement, boundary: HTMLElement): boolean {
  let curr: HTMLElement | null = target;
  while (curr && curr !== boundary && curr !== document.body) {
    if (isScrollableContainer(curr) && curr.scrollTop > 1) {
      return true;
    }
    curr = curr.parentElement;
  }
  if (boundary && isScrollableContainer(boundary) && boundary.scrollTop > 1) {
    return true;
  }
  return false;
}

/**
 * Checks whether an element is an interactive form element that should take priority
 * over bottom sheet dismissal dragging.
 */
function isInteractiveFormElement(target: HTMLElement): boolean {
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='combobox'], [role='slider'], [role='spinbutton'], [role='listbox'], button, a, [data-prevent-swipe]",
    ),
  );
}

/**
 * Custom hook for detecting vertical swipe-down gestures on mobile bottom sheets.
 * Provides intuitive, fluid dismissal with natural resistance and spring physics,
 * while strictly avoiding conflicts with nested scrollable forms and inputs.
 */
export function useVerticalSwipeGesture<T extends HTMLElement = HTMLElement>({
  onDismiss,
  threshold = 75,
  velocityThreshold = 0.38,
  enabled = true,
  onlyHandle = false,
  onDragProgress,
  onDragStart,
  onDragEnd,
}: VerticalSwipeGestureOptions): VerticalSwipeGestureResult<T> {
  const elementRef = useRef<T | null>(null);
  const handleRef = useRef<HTMLElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const startPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const currentDeltaRef = useRef(0);
  const isDirectHandleTouchRef = useRef(false);
  const isEligibleForDragRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const resetPosition = useCallback(
    (animate = true) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const el = elementRef.current;
      if (!el) return;

      if (animate) {
        el.style.transition =
          "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease-out";
      } else {
        el.style.transition = "none";
      }
      el.style.transform = "";
      currentDeltaRef.current = 0;
      onDragProgress?.(0);

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    },
    [onDragProgress],
  );

  const applyTransform = useCallback(
    (delta: number) => {
      const el = elementRef.current;
      if (!el) return;

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const targetEl = elementRef.current;
        if (!targetEl) return;

        targetEl.style.transition = "none";
        const clampedY = Math.max(0, delta);
        targetEl.style.transform = `translate3d(0, ${clampedY}px, 0)`;

        currentDeltaRef.current = delta;
        const normalized = Math.min(1, Math.max(0, delta / 240));
        onDragProgress?.(normalized);
      });
    },
    [onDragProgress],
  );

  const triggerDismiss = useCallback(() => {
    const el = elementRef.current;
    if (!el) {
      onDismiss();
      return;
    }

    el.style.transition = "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out";
    el.style.transform = "translate3d(0, 100%, 0)";
    el.style.opacity = "0.5";

    setTimeout(() => {
      onDismiss();
      if (elementRef.current) {
        elementRef.current.style.transform = "";
        elementRef.current.style.transition = "";
        elementRef.current.style.opacity = "";
      }
    }, 190);
  }, [onDismiss]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled) return;

    const onStart = (clientX: number, clientY: number, target: HTMLElement) => {
      const isHandle =
        handleRef.current?.contains(target) ||
        Boolean(target.closest("[data-swipe-handle='true']")) ||
        Boolean(target.closest("[data-swipe-handle]")) ||
        Boolean(target.getAttribute("data-swipe-handle"));

      isDirectHandleTouchRef.current = isHandle;

      // Check for interactive form elements (inputs, textareas, selects, buttons)
      const isInteractive = isInteractiveFormElement(target);

      // If user touches an input and didn't touch the drag handle, forbid sheet dragging
      if (isInteractive && !isHandle) {
        isEligibleForDragRef.current = false;
        return;
      }

      // If onlyHandle mode is enabled, only dedicated handle touches may initiate dragging
      if (onlyHandle && !isHandle) {
        isEligibleForDragRef.current = false;
        return;
      }

      // Check if any scrollable container from target up to the modal root is scrolled down
      const isScrolledDown = hasScrolledAncestor(target, el);
      if (isScrolledDown && !isHandle) {
        isEligibleForDragRef.current = false;
        return;
      }

      // Eligible: direct handle touch OR touch at top of scroll boundary
      isEligibleForDragRef.current = true;
      startPosRef.current = { x: clientX, y: clientY, time: Date.now() };
      lastPosRef.current = { x: clientX, y: clientY, time: Date.now() };
      isDraggingRef.current = false;
    };

    const onMove = (
      clientX: number,
      clientY: number,
      cancelable: boolean,
      preventDefault: () => void,
    ) => {
      if (!startPosRef.current || !isEligibleForDragRef.current) return;

      const deltaX = clientX - startPosRef.current.x;
      const deltaY = clientY - startPosRef.current.y;

      lastPosRef.current = { x: clientX, y: clientY, time: Date.now() };

      if (!isDraggingRef.current) {
        if (isDirectHandleTouchRef.current) {
          // Direct handle touch starts downward drag with 1px sensitivity
          if (deltaY > 1) {
            isDraggingRef.current = true;
            setIsDragging(true);
            onDragStart?.();
          }
        } else {
          // Body touch requires clear vertical downward intent (deltaY > 8 and 1.3x dominant over deltaX)
          if (deltaY > 8 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3) {
            // Final check: confirm no inner container was scrolled in the meantime
            const targetEl = elementRef.current;
            if (targetEl && targetEl.scrollTop <= 1) {
              isDraggingRef.current = true;
              setIsDragging(true);
              onDragStart?.();
            } else {
              isEligibleForDragRef.current = false;
              return;
            }
          }
        }
      }

      if (isDraggingRef.current && deltaY > 0) {
        if (cancelable) preventDefault();

        // Apply natural fluid resistance formula
        const resistance = deltaY > threshold ? 1 - Math.min(0.45, (deltaY - threshold) / 500) : 1;
        applyTransform(deltaY * resistance);
      }
    };

    const onEnd = () => {
      if (!startPosRef.current || !lastPosRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }

      const deltaY = lastPosRef.current.y - startPosRef.current.y;
      const deltaX = lastPosRef.current.x - startPosRef.current.x;
      const duration = Math.max(1, lastPosRef.current.time - startPosRef.current.time);

      const velocityY = deltaY / duration;

      if (isDraggingRef.current) {
        // Dismiss if dragged beyond threshold OR flicked down with sufficient velocity and minimum displacement
        const isPastThreshold = deltaY >= threshold;
        const isFastFlick = velocityY >= velocityThreshold && deltaY > 30;
        const isDominantVertical = Math.abs(deltaY) > Math.abs(deltaX) * 1.1;

        const shouldDismiss = (isPastThreshold || isFastFlick) && isDominantVertical;

        onDragEnd?.(shouldDismiss);

        if (shouldDismiss) {
          triggerDismiss();
        } else {
          resetPosition(true);
        }
      }

      isDraggingRef.current = false;
      setIsDragging(false);
      startPosRef.current = null;
      lastPosRef.current = null;
      isDirectHandleTouchRef.current = false;
      isEligibleForDragRef.current = false;
    };

    // Touch listeners
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY, e.target as HTMLElement);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY, e.cancelable, () => e.preventDefault());
    };

    const handleTouchEnd = () => {
      onEnd();
    };

    // Pointer events (for desktop emulator drag handle interaction)
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // Touch handled by touch events
      const target = e.target as HTMLElement;
      const isHandle =
        handleRef.current?.contains(target) ||
        Boolean(target.closest("[data-swipe-handle='true']")) ||
        Boolean(target.closest("[data-swipe-handle]"));

      if (isHandle) {
        onStart(e.clientX, e.clientY, target);
        const onPointerMove = (pe: PointerEvent) => {
          onMove(pe.clientX, pe.clientY, pe.cancelable, () => pe.preventDefault());
        };
        const onPointerUp = () => {
          onEnd();
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerUp);
        };
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    el.addEventListener("pointerdown", handlePointerDown);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
      el.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [
    enabled,
    threshold,
    velocityThreshold,
    onlyHandle,
    applyTransform,
    resetPosition,
    triggerDismiss,
    onDragStart,
    onDragEnd,
  ]);

  return {
    elementRef,
    handleRef,
    isDragging,
    resetPosition,
    triggerDismiss,
  };
}
