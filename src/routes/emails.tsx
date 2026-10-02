import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
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
  return (
    <AppLayout>
      {({ onOpenMobileMenu }) => <EmailsManagementPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
