import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import { DocumentsPage } from "@/components/nashmia/documents/DocumentsPage";

const title = "My Drive & Documents | Nashmia Logistics Platform";
const description =
  "Access, manage, and collaborate on drive documents, spreadsheets, certificates, and quick access folders.";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: DocumentsRoute,
});

function DocumentsRoute() {
  return (
    <AppLayout bg="bg-[#F4F6FA]">
      {({ onOpenMobileMenu }) => <DocumentsPage onOpenMobileMenu={onOpenMobileMenu} />}
    </AppLayout>
  );
}
