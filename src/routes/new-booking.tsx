import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar, MobileSidebar } from "@/components/nashmia/AppSidebar";
import { NewBookingPage } from "@/components/nashmia/booking/NewBookingPage";

const title = "New Booking Request | Nashmia Industries Logistics Platform";
const description =
  "Create an important logistics movement and prepare the booking request for your forwarder inside the Nashmia Industries operating system.";

export const Route = createFileRoute("/new-booking")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: NewBookingRoute,
});

function NewBookingRoute() {
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
          <NewBookingPage onOpenMobileMenu={() => setMobileNavOpen(true)} />
        </div>
      </main>
    </div>
  );
}
