import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar, MobileSidebar } from "@/components/nashmia/AppSidebar";
import { EmailsManagementPage } from "@/components/nashmia/emails/EmailsManagementPage";

const title = "Emails Management | Nashmia Industries Logistics Platform";
const description =
  "Manage booking requests, sent emails, drafts, and email correspondence within the Nashmia Industries operating system.";

export const Route = createFileRoute("/emails")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: EmailsRoute,
});

function EmailsRoute() {
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
          style={
            {
              "--offset": collapsed ? "88px" : "272px",
            } as React.CSSProperties
          }
        >
          <div className="mx-auto max-w-[1520px]">
            <EmailsManagementPage onOpenMobileMenu={() => setMobileNavOpen(true)} />
          </div>
        </div>
      </main>
    </div>
  );
}
