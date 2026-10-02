import { useEffect, useRef, useCallback } from "react";

export interface SwipeToDismissOptions {
  onDismiss: () => void;
  direction?: "down" | "right" | "left";
  threshold?: number; // Minimum px dragged to trigger dismiss (default: 65)
  velocityThreshold?: number; // Minimum velocity in px/ms to trigger dismiss (default: 0.35)
  enabled?: boolean;
  onDragProgress?: (progress: number) => void;
}

export function useSwipeToDismiss<T extends HTMLElement = HTMLElement>({
  onDismiss,
  direction = "down",
  threshold = 65,
  velocityThreshold = 0.35,
  enabled = true,
  onDragProgress,
}: SwipeToDismissOptions) {
  const elementRef = useRef<T | null>(null);
  const handleRef = useRef<HTMLElement | null>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const currentDeltaRef = useRef(0);
  const isDirectHandleTouchRef = useRef(false);
  const isEligibleForDragRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const resetTransform = useCallback(
    (animate = true) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const el = elementRef.current;
      if (!el) return;
      if (animate) {
        el.style.transition =
          "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out";
      } else {
        el.style.transition = "none";
      }
      el.style.transform = "";
      currentDeltaRef.current = 0;
      onDragProgress?.(0);
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
        if (direction === "down") {
          const clampedY = Math.max(0, delta);
          targetEl.style.transform = `translate3d(0, ${clampedY}px, 0)`;
        } else if (direction === "right") {
          const clampedX = Math.max(0, delta);
          targetEl.style.transform = `translate3d(${clampedX}px, 0, 0)`;
        } else if (direction === "left") {
          const clampedX = Math.min(0, delta);
          targetEl.style.transform = `translate3d(${clampedX}px, 0, 0)`;
        }
        currentDeltaRef.current = delta;
        onDragProgress?.(Math.min(1, Math.abs(delta) / 220));
      });
    },
    [direction, onDragProgress],
  );

  const triggerDismissAnimation = useCallback(() => {
    const el = elementRef.current;
    if (!el) {
      onDismiss();
      return;
    }
    el.style.transition = "transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out";
    if (direction === "down") {
      el.style.transform = "translate3d(0, 100%, 0)";
    } else if (direction === "right") {
      el.style.transform = "translate3d(100%, 0, 0)";
    } else if (direction === "left") {
      el.style.transform = "translate3d(-100%, 0, 0)";
    }
    el.style.opacity = "0.6";

    setTimeout(() => {
      onDismiss();
      if (elementRef.current) {
        elementRef.current.style.transform = "";
        elementRef.current.style.transition = "";
        elementRef.current.style.opacity = "";
      }
    }, 190);
  }, [direction, onDismiss]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled) return;

    const onStart = (clientX: number, clientY: number, target: HTMLElement) => {
      const isHandle =
        handleRef.current?.contains(target) ||
        Boolean(target.closest("[data-swipe-handle]")) ||
        Boolean(target.getAttribute("data-swipe-handle"));

      const isScrolledToTop = el.scrollTop <= 2;

      isDirectHandleTouchRef.current = Boolean(isHandle);
      isEligibleForDragRef.current = Boolean(isHandle || isScrolledToTop);
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
      if (!startPosRef.current) return;

      const deltaX = clientX - startPosRef.current.x;
      const deltaY = clientY - startPosRef.current.y;

      lastPosRef.current = { x: clientX, y: clientY, time: Date.now() };

      if (!isDraggingRef.current) {
        if (isDirectHandleTouchRef.current) {
          // If user touches the drag handle directly, start dragging immediately
          if (direction === "down" && deltaY > 1) {
            isDraggingRef.current = true;
          } else if (direction === "right" && deltaX > 1) {
            isDraggingRef.current = true;
          } else if (direction === "left" && deltaX < -1) {
            isDraggingRef.current = true;
          }
        } else if (isEligibleForDragRef.current && el.scrollTop <= 2) {
          // Body touch drag initialization
          if (direction === "down") {
            if (deltaY > 5 && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
              isDraggingRef.current = true;
            }
          } else if (direction === "right") {
            if (deltaX > 5 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
              isDraggingRef.current = true;
            }
          } else if (direction === "left") {
            if (deltaX < -5 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
              isDraggingRef.current = true;
            }
          }
        }
      }

      if (isDraggingRef.current) {
        if (direction === "down" && deltaY > 0) {
          if (cancelable) preventDefault();
          const resistance = deltaY > threshold ? 0.88 : 1;
          applyTransform(deltaY * resistance);
        } else if (direction === "right" && deltaX > 0) {
          if (cancelable) preventDefault();
          applyTransform(deltaX);
        } else if (direction === "left" && deltaX < 0) {
          if (cancelable) preventDefault();
          applyTransform(deltaX);
        }
      }
    };

    const onEnd = () => {
      if (!startPosRef.current || !lastPosRef.current) return;

      const deltaY = lastPosRef.current.y - startPosRef.current.y;
      const deltaX = lastPosRef.current.x - startPosRef.current.x;
      const duration = Math.max(1, lastPosRef.current.time - startPosRef.current.time);

      const velocityY = deltaY / duration;
      const velocityX = deltaX / duration;

      if (isDraggingRef.current) {
        let shouldDismiss = false;

        if (direction === "down") {
          shouldDismiss = deltaY >= threshold || velocityY >= velocityThreshold;
        } else if (direction === "right") {
          shouldDismiss = deltaX >= threshold || velocityX >= velocityThreshold;
        } else if (direction === "left") {
          shouldDismiss = deltaX <= -threshold || velocityX <= -velocityThreshold;
        }

        if (shouldDismiss) {
          triggerDismissAnimation();
        } else {
          resetTransform(true);
        }
      }

      isDraggingRef.current = false;
      startPosRef.current = null;
      lastPosRef.current = null;
      isDirectHandleTouchRef.current = false;
      isEligibleForDragRef.current = false;
    };

    // Touch events for mobile
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

    // Pointer events for mouse/stylus/emulator dragging on handle
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // Touch is handled by touch events
      const target = e.target as HTMLElement;
      const isHandle =
        handleRef.current?.contains(target) || Boolean(target.closest("[data-swipe-handle]"));
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
    direction,
    threshold,
    velocityThreshold,
    applyTransform,
    resetTransform,
    triggerDismissAnimation,
  ]);

  return {
    elementRef,
    handleRef,
  };
}
