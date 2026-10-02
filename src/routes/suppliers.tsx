import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import { SuppliersDirectoryPage } from "@/components/nashmia/suppliers/SuppliersDirectoryPage";

const title = "Suppliers Directory | Nashmia Industries Logistics Platform";
const description =
  "Manage pickup vendors and their loading locations inside the Nashmia Industries operating system.";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: SuppliersRoute,
});

function SuppliersRoute() {
  return (
    <AppLayout bg="bg-white">
      {({ onOpenMobileMenu }) => <SuppliersDirectoryPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
