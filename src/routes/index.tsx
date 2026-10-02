import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import {
  DashboardDataProvider,
  KpiGrid,
  Lifecycle,
  NeedsAttention,
  PageTitle,
  QuickActions,
  RecentMovements,
  TopHeader,
  UpcomingCutoffs,
} from "@/components/nashmia/DashboardSections";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const title = "Container Operations Dashboard | Nashmia Industries";
const description =
  "Nashmia Industries container logistics command center: track bookings, transits, cut-offs and deliveries in one premium operations dashboard.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppLayout
      maxWidth="max-w-[1600px]"
      mainClassName="px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-10 lg:pr-8"
    >
      {({ onOpenMobileMenu }) => (
        <DashboardDataProvider>
          <div className="space-y-6">
            <TopHeader onOpenMobileMenu={onOpenMobileMenu} />
            <PageTitle />

            <ErrorBoundary moduleName="KPI Metrics">
              <KpiGrid />
            </ErrorBoundary>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ErrorBoundary moduleName="Lifecycle Tracker">
                  <Lifecycle />
                </ErrorBoundary>
              </div>
              <ErrorBoundary moduleName="Action Items">
                <NeedsAttention />
              </ErrorBoundary>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ErrorBoundary moduleName="Recent Movements Table">
                  <RecentMovements />
                </ErrorBoundary>
              </div>
              <div className="space-y-5">
                <ErrorBoundary moduleName="Upcoming Cut-offs">
                  <UpcomingCutoffs />
                </ErrorBoundary>
                <ErrorBoundary moduleName="Quick Actions">
                  <QuickActions />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </DashboardDataProvider>
      )}
    </AppLayout>
  );
}
