import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import { ForwardersDirectoryPage } from "@/components/nashmia/forwarders/ForwardersDirectoryPage";

const title = "Forwarders Directory | Nashmia Industries Logistics Platform";
const description =
  "Manage booking agents, contacts, communication details, and agreed rate cards inside the Nashmia Industries operating system.";

export const Route = createFileRoute("/forwarders")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ForwardersRoute,
});

function ForwardersRoute() {
  return (
    <AppLayout bg="bg-white">
      {({ onOpenMobileMenu }) => <ForwardersDirectoryPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
