"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSwipeToDismiss } from "@/hooks/use-swipe-to-dismiss";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-all duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-2xl transition ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity] box-border outline-none focus:outline-none focus-visible:outline-none data-[state=closed]:duration-200 data-[state=open]:duration-240 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b overflow-x-hidden data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t rounded-t-[28px] max-h-[90vh] overflow-y-auto overflow-x-hidden w-full data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r overflow-x-hidden data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          // Mobile: slides up from bottom as bottom sheet with rounded top corners
          "inset-x-0 bottom-0 top-auto h-auto max-h-[90vh] w-full rounded-t-[28px] rounded-b-none border-t border-l-0 overflow-y-auto overflow-x-hidden p-5 pb-8 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom " +
          // Desktop & Tablet: standard right side drawer
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0 sm:h-full sm:w-3/4 sm:rounded-none sm:border-l sm:border-t-0 sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right sm:max-w-xl sm:p-6",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
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

  const swipeDirection = isMobile ? "down" : side === "left" ? "left" : "right";

  const { elementRef, handleRef } = useSwipeToDismiss<HTMLDivElement>({
    direction: swipeDirection,
    onDismiss: () => {
      closeBtnRef.current?.click();
    },
    enabled: true,
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
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={setCombinedRef}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {/* Mobile Drag Handle with touch target and active feedback */}
        <div
          ref={handleRef}
          data-swipe-handle="true"
          className="group mx-auto -mt-2 mb-1 flex h-8 w-full max-w-[200px] cursor-grab touch-none items-center justify-center sm:hidden active:cursor-grabbing select-none"
          aria-label="Drag down to dismiss"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300 transition-all duration-150 group-hover:bg-slate-400 group-active:scale-x-110 group-active:bg-slate-500" />
        </div>
        <SheetPrimitive.Close
          ref={closeBtnRef}
          className="absolute right-4 top-4 rounded-full p-1.5 opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
