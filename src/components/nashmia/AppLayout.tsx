import { useState, useEffect, lazy, Suspense, type ReactNode } from "react";
import { AppSidebar, MobileSidebar } from "@/components/nashmia/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { PageTransition } from "@/components/common/PageTransition";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const MovementLifecycleDrawer = lazy(() =>
  import("@/components/nashmia/movements/MovementLifecycleDrawer").then((m) => ({
    default: m.MovementLifecycleDrawer,
  })),
);

export interface AppLayoutProps {
  children: ReactNode | ((props: { onOpenMobileMenu: () => void }) => ReactNode);
  bg?: string;
  maxWidth?: string;
  mainClassName?: string;
}

export function AppLayout({
  children,
  bg = "bg-white",
  maxWidth = "max-w-[1520px]",
  mainClassName = "px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:pb-12 lg:pr-8",
}: AppLayoutProps) {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const queryClient = useQueryClient();

  // Global Movement Lifecycle Drawer in-place state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRef, setDrawerRef] = useState<string | null>(null);
  const [drawerBookingId, setDrawerBookingId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenMovement = (e: Event) => {
      const detail = (e as CustomEvent<{
        movementNumber?: string;
        reference?: string;
        bookingReference?: string;
        bookingId?: string;
        defaultTab?: string;
        tab?: string;
        isDocument?: boolean;
      }>).detail;

      if (!detail) return;
      const ref =
        detail.movementNumber ||
        detail.reference ||
        detail.bookingReference ||
        detail.bookingId;

      if (ref && ref.trim()) {
        const cleanRef = ref.trim().toUpperCase();
        setDrawerRef(cleanRef);
        setDrawerBookingId(detail.bookingId || null);
        setDrawerTab(detail.defaultTab || detail.tab || (detail.isDocument ? "documents" : null));
        setDrawerOpen(true);
      }
    };

    window.addEventListener("nashmia_open_movement_drawer", handleOpenMovement);
    return () => window.removeEventListener("nashmia_open_movement_drawer", handleOpenMovement);
  }, []);

  return (
    <div
      className={cn(
        "relative w-full min-w-full max-w-full min-h-screen min-h-[100dvh] m-0 p-0 overflow-x-hidden",
        bg,
      )}
    >
      <div className="env-light" aria-hidden />

      {/* Navigation Sidebars - isolated stacking context, fixed, stable & instant */}
      <AppSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <MobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <main
        className={cn(
          "relative z-0 min-h-screen min-h-[100dvh] w-full min-w-0 max-w-full overflow-x-hidden transition-[padding-left] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] lg:pl-[var(--offset)]",
          mainClassName,
        )}
        style={
          {
            "--offset": collapsed ? "72px" : "260px",
            willChange: "padding-left",
          } as React.CSSProperties
        }
      >
        <div className={cn("mx-auto w-full min-w-0 max-w-full", maxWidth)}>
          <PageTransition>
            {typeof children === "function"
              ? children({ onOpenMobileMenu: () => setMobileNavOpen(true) })
              : children}
          </PageTransition>
        </div>
      </main>

      {/* Global In-Place Movement Drawer: opens seamlessly across all pages without navigation */}
      {drawerOpen && drawerRef && (
        <Suspense fallback={null}>
          <MovementLifecycleDrawer
            isOpen={drawerOpen}
            onClose={() => {
              setDrawerOpen(false);
              setDrawerRef(null);
              setDrawerTab(null);
            }}
            initialReference={drawerRef}
            bookingId={drawerBookingId}
            defaultTab={drawerTab as any}
            onMovementUpdated={() => {
              void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
              void queryClient.invalidateQueries({ queryKey: ["movements"] });
              void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
