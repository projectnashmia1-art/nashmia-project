import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import { RateCardsPage } from "@/components/nashmia/rate-cards/RateCardsPage";

const title = "Commercial Rate Cards | Nashmia Industries Logistics Platform";
const description =
  "Manage agreed freight contracts, ocean container rate benchmarks, and validity windows across global trade corridors.";

export const Route = createFileRoute("/rate-cards")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: RateCardsRoute,
});

function RateCardsRoute() {
  return (
    <AppLayout bg="bg-white">
      {({ onOpenMobileMenu }) => <RateCardsPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}

export default RateCardsRoute;
