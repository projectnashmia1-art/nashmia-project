"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useVerticalSwipeGesture } from "@/hooks/use-vertical-swipe-gesture";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs transition-all duration-200 ease-out",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  hideDragHandle?: boolean;
  hideCloseButton?: boolean;
  onlyHandleDismiss?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      hideDragHandle = false,
      hideCloseButton = false,
      onlyHandleDismiss = false,
      ...props
    },
    ref,
  ) => {
    const closeBtnRef = React.useRef<HTMLButtonElement>(null);
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
      const checkMobile = () => {
        setIsMobile(typeof window !== "undefined" ? window.innerWidth < 640 : false);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const { elementRef, handleRef } = useVerticalSwipeGesture<HTMLDivElement>({
      onDismiss: () => {
        closeBtnRef.current?.click();
      },
      enabled: isMobile,
      onlyHandle: onlyHandleDismiss,
    });

    const setCombinedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        elementRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref, elementRef],
    );

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={setCombinedRef}
          className={cn(
            // Base structure with crisp rendering and no blur-inducing will-change properties
            "fixed z-50 grid w-full gap-4 bg-background shadow-2xl transition-all box-border outline-none focus:outline-none focus-visible:outline-none antialiased [backface-visibility:hidden]",
            // Mobile: Bottom Sheet smoothly sliding up with spring deceleration curve
            "inset-x-0 bottom-0 top-auto max-h-[92vh] overflow-y-auto overflow-x-hidden translate-x-0 translate-y-0 rounded-t-[28px] rounded-b-none border-t border-x-0 border-b-0 p-5 pb-[max(2rem,env(safe-area-inset-bottom))]",
            "duration-240 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            // Desktop & Tablet (sm: and up): Centered Dialog with crisp fade & subtle scale
            "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:max-h-[92vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border sm:p-6 sm:pb-6",
            "sm:duration-150 sm:ease-out",
            "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
            className,
            // Mobile Invariant Overrides: On screens under 640px, ensure bottom sheet docking and flat bottom corners
            "max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto max-sm:!w-full max-sm:!max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!rounded-t-[28px] max-sm:!rounded-b-none max-sm:!border-t max-sm:!border-x-0 max-sm:!border-b-0 max-sm:!max-h-[92vh]",
          )}
          {...props}
        >
          {/* Mobile Tactile Drag Handle */}
          {!hideDragHandle && (
            <div
              ref={handleRef}
              data-swipe-handle="true"
              className="group mx-auto -mt-2 mb-1 flex h-7 w-full max-w-[180px] cursor-grab touch-none items-center justify-center sm:hidden active:cursor-grabbing select-none shrink-0"
              aria-label="Drag down to dismiss"
            >
              <div className="h-1.5 w-12 rounded-full bg-slate-300 transition-all duration-150 group-hover:bg-slate-400 group-active:scale-x-110 group-active:bg-slate-500" />
            </div>
          )}
          {children}
          {!hideCloseButton && (
            <DialogPrimitive.Close
              ref={closeBtnRef}
              className="absolute right-4 top-4 rounded-full p-1.5 opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-30"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
