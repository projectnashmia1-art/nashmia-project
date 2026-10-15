import { useState, type ReactNode } from "react";
import { AppSidebar, MobileSidebar } from "@/components/nashmia/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { PageTransition } from "@/components/common/PageTransition";
import { cn } from "@/lib/utils";

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
    </div>
  );
}
