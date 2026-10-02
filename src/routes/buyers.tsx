import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import { BuyersDirectoryPage } from "@/components/nashmia/buyers/BuyersDirectoryPage";

const title = "Buyers Directory | Nashmia Industries Logistics Platform";
const description =
  "Manage the accounts and buyers associated with your container movements inside the Nashmia Industries operating system.";

export const Route = createFileRoute("/buyers")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: BuyersRoute,
});

function BuyersRoute() {
  return (
    <AppLayout bg="bg-white">
      {({ onOpenMobileMenu }) => <BuyersDirectoryPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
