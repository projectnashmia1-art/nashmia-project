import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppSidebar, MobileSidebar } from "@/components/nashmia/AppSidebar";
import {
  KpiGrid,
  Lifecycle,
  NeedsAttention,
  PageTitle,
  QuickActions,
  RecentMovements,
  TopHeader,
  UpcomingCutoffs,
} from "@/components/nashmia/DashboardSections";

const title = "Container Operations Dashboard | Nashmia Industries";
const description =
  "Nashmia Industries container logistics command center: track bookings, transits, cut-offs and deliveries in one premium operations dashboard.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-white">
      <div className="env-light" aria-hidden />

      {/* Navigation Sidebars */}
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <MobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <main className="px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-10 lg:pr-8">
        <div
          className="space-y-6 transition-[margin-left] duration-300 ease-glass lg:ml-[var(--offset)]"
          style={{ "--offset": collapsed ? "88px" : "272px" } as React.CSSProperties}
        >
          <div className="mx-auto max-w-[1600px] space-y-6">
            <TopHeader onOpenMobileMenu={() => setMobileNavOpen(true)} />
            <PageTitle />
            <KpiGrid />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <Lifecycle />
              </div>
              <NeedsAttention />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <RecentMovements />
              </div>
              <div className="space-y-5">
                <UpcomingCutoffs />
                <QuickActions />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
