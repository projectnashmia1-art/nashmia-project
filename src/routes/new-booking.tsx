import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
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
  return (
    <AppLayout maxWidth="max-w-[1520px]">
      {({ onOpenMobileMenu }) => <NewBookingPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
