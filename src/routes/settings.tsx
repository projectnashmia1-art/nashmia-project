import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import { ProfileSettingsPage } from "@/components/nashmia/profile/ProfileSettingsPage";

const title = "Profile & Account Settings | Nashmia Industries Logistics Platform";
const description =
  "Manage authenticated user credentials, organizational details, security preferences, and Supabase backend status.";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <AppLayout>
      {({ onOpenMobileMenu }) => <ProfileSettingsPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
