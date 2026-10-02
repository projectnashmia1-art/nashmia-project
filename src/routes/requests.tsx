import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
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
  return (
    <AppLayout>
      {({ onOpenMobileMenu }) => <RequestsPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
