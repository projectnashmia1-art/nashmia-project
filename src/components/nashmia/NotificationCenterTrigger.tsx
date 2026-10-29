import { useState, lazy, Suspense } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNotifications } from "@/lib/notifications-context";
import { NotificationsListSkeleton } from "@/components/nashmia/skeletons/NotificationSkeletons";
import { cn } from "@/lib/utils";

const AINotificationCenter = lazy(() =>
  import("./AINotificationCenter").then((m) => ({
    default: m.AINotificationCenter,
  })),
);

interface NotificationCenterTriggerProps {
  className?: string;
  id?: string;
  iconClassName?: string;
}

export function NotificationCenterTrigger({
  className,
  id,
  iconClassName = "size-4",
}: NotificationCenterTriggerProps) {
  const { unreadCount, isMounted } = useNotifications();
  const [isDesktopOpen, setIsDesktopOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop & Tablet Popover (Visible on sm and up) */}
      <div className="hidden sm:block">
        <Popover open={isDesktopOpen} onOpenChange={setIsDesktopOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              aria-label="Notifications"
              className={cn("relative cursor-pointer focus:outline-none", className)}
            >
              <Bell className={iconClassName} />
              {isMounted && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#0FA3B1] px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(15,163,177,0.4)] ring-2 ring-white animate-in zoom-in-50">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-auto max-w-[calc(100vw-24px)] p-0 border-0 bg-transparent shadow-none"
          >
            {isDesktopOpen && (
              <Suspense
                fallback={
                  <div className="w-[380px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <NotificationsListSkeleton />
                  </div>
                }
              >
                <AINotificationCenter onClose={() => setIsDesktopOpen(false)} />
              </Suspense>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile Bottom Sheet (Visible below sm) */}
      <div className="block sm:hidden">
        <button
          type="button"
          id={id ? `${id}-mobile` : "mobile-notifications-button"}
          onClick={() => setIsMobileOpen(true)}
          aria-label="Notifications"
          className={cn("relative cursor-pointer focus:outline-none", className)}
        >
          <Bell className={iconClassName} />
          {isMounted && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#0FA3B1] px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(15,163,177,0.4)] ring-2 ring-white animate-in zoom-in-50">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetContent
            side="bottom"
            onDismiss={() => setIsMobileOpen(false)}
            className="p-3.5 pb-6 sm:hidden rounded-t-[28px] border-t border-slate-200/80 bg-white max-h-[88vh] overflow-y-auto overflow-x-hidden w-full max-w-full"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Notification Center</SheetTitle>
            </SheetHeader>
            {isMobileOpen && (
              <Suspense
                fallback={
                  <div className="p-2">
                    <NotificationsListSkeleton />
                  </div>
                }
              >
                <AINotificationCenter isBottomSheet onClose={() => setIsMobileOpen(false)} />
              </Suspense>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
