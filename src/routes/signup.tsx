import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";

const title = "Create Account | Nashmia Industries Logistics Platform";
const description =
  "Create your Nashmia Industries logistics operations account to manage container bookings, voyage intelligence, and forwarder directories.";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    return {
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    };
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: SignupRoute,
});

function SignupRoute() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}
