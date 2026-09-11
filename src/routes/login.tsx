import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";

const title = "Sign In | Nashmia Industries Logistics Platform";
const description =
  "Sign in to your Nashmia Industries container logistics workspace — manage shipments, bookings, rate cards, and consignments.";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  return (
    <AuthLayout>
      <SignInForm />
    </AuthLayout>
  );
}
