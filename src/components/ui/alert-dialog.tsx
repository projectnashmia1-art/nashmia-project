import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useVerticalSwipeGesture } from "@/hooks/use-vertical-swipe-gesture";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs transition-all duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

export interface AlertDialogContentProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Content
> {
  hideDragHandle?: boolean;
  onlyHandleDismiss?: boolean;
}

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, children, hideDragHandle = false, onlyHandleDismiss = false, ...props }, ref) => {
  const cancelBtnRef = React.useRef<HTMLButtonElement>(null);
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
      // Find and trigger the cancel button if available
      const cancelBtn = elementRef.current?.querySelector<HTMLButtonElement>(
        '[data-alert-cancel="true"]',
      );
      if (cancelBtn) {
        cancelBtn.click();
      } else {
        cancelBtnRef.current?.click();
      }
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
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={setCombinedRef}
        className={cn(
          "fixed z-50 grid w-full gap-4 bg-background shadow-2xl transition-all box-border outline-none focus:outline-none focus-visible:outline-none antialiased [backface-visibility:hidden]",
          // Mobile: Bottom Sheet
          "inset-x-0 bottom-0 top-auto max-h-[92vh] overflow-y-auto overflow-x-hidden translate-x-0 translate-y-0 rounded-t-[28px] rounded-b-none border-t border-x-0 border-b-0 p-5 pb-[max(2rem,env(safe-area-inset-bottom))]",
          "duration-240 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          // Desktop: Centered Dialog
          "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:max-h-[92vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border sm:p-6 sm:pb-6",
          "sm:duration-150 sm:ease-out",
          "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
          className,
          // Mobile Invariant Overrides:
          "max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto max-sm:!w-full max-sm:!max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!rounded-t-[28px] max-sm:!rounded-b-none max-sm:!border-t max-sm:!border-x-0 max-sm:!border-b-0 max-sm:!max-h-[92vh]",
        )}
        {...props}
      >
        {/* Mobile Drag Handle */}
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
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
