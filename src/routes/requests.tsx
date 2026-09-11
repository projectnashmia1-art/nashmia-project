import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar, MobileSidebar } from "@/components/nashmia/AppSidebar";
import { RequestsPage } from "@/components/nashmia/requests/RequestsPage";

const title = "Booking Requests | Nashmia Industries Logistics Desk";
const description =
  "Review incoming export booking requests, verify ocean carrier rates, allocate equipment, and confirm container schedules with Nashmia Industries.";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: RequestsRoute,
});

function RequestsRoute() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-white">
      <div className="env-light" aria-hidden />

      {/* Navigation Sidebars */}
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <MobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <main className="px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:pb-12 lg:pr-8">
        <div
          className="transition-[margin-left] duration-300 ease-glass lg:ml-[var(--offset)]"
          style={{ "--offset": collapsed ? "88px" : "272px" } as React.CSSProperties}
        >
          <div className="mx-auto max-w-[1520px]">
            <RequestsPage onOpenMobileMenu={() => setMobileNavOpen(true)} />
          </div>
        </div>
      </main>
    </div>
  );
}
