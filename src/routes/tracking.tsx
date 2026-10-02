import { lazy, Suspense, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/nashmia/AppLayout";
import { ShipmentTrackingSkeleton } from "@/components/nashmia/tracking/ShipmentTrackingSkeleton";
import { useRealBookings, useRealBookingDetail } from "@/services/data-fetching.service";

// Lazy-load ShipmentTrackingView for optimal code-splitting and rapid initial route paint
const ShipmentTrackingView = lazy(() =>
  import("@/components/nashmia/tracking/ShipmentTrackingView").then((m) => ({
    default: m.ShipmentTrackingView,
  })),
);

const title = "Track Shipment | Nashmia Industries Logistics Command Center";
const description =
  "Real-time visual maritime shipment tracking with interactive route corridors, milestone logs, vessel position, and verified transport documents.";

export const Route = createFileRoute("/tracking")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: (search.id as string) || undefined,
    ref: (search.ref as string) || undefined,
    container: (search.container as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: TrackingPage,
});

function TrackingPage() {
  const { id, ref, container } = Route.useSearch();
  const targetLookup = id || ref || container || "";

  // 1. Direct detail query if targetLookup provided
  const { data: detailBooking, isLoading: isDetailLoading } = useRealBookingDetail(
    id || ref || "",
    undefined,
    { enabled: Boolean(id || ref) },
  );

  // 2. All real bookings from Supabase
  const { data: allBookings = [], isLoading: isAllLoading } = useRealBookings();

  const booking = useMemo(() => {
    if (detailBooking) return detailBooking;
    if (!targetLookup) return allBookings[0] || null;

    const clean = targetLookup.trim().toLowerCase();
    const cleanContainer = (container || "").trim().toLowerCase();

    if (cleanContainer) {
      const match = allBookings.find((b) =>
        b.containers?.some(
          (c) => c.container_number && c.container_number.toLowerCase() === cleanContainer,
        ),
      );
      if (match) return match;
    }

    return (
      allBookings.find(
        (b) =>
          b.id.toLowerCase() === clean ||
          (b.movement_number && b.movement_number.toLowerCase() === clean) ||
          (b.booking_reference && b.booking_reference.toLowerCase() === clean) ||
          ((b as { reference?: string }).reference &&
            (b as { reference?: string }).reference!.toLowerCase() === clean) ||
          b.containers?.some(
            (c) => c.container_number && c.container_number.toLowerCase() === clean,
          ),
      ) || null
    );
  }, [detailBooking, allBookings, targetLookup, container]);

  const loading =
    (Boolean(targetLookup) && isDetailLoading) || (allBookings.length === 0 && isAllLoading);

  return (
    <AppLayout bg="bg-[#F5F7FA]" maxWidth="max-w-[1800px]" mainClassName="p-0">
      {() => (
        <div className="w-full min-w-0 max-w-full min-h-[calc(100vh-60px)] min-h-[calc(100dvh-60px)] flex flex-col">
          {loading ? (
            <ShipmentTrackingSkeleton />
          ) : (
            <Suspense fallback={<ShipmentTrackingSkeleton />}>
              <ShipmentTrackingView
                booking={booking}
                movementId={
                  targetLookup || booking?.movement_number || booking?.booking_reference || null
                }
                selectedContainerNumber={container || null}
                isStandalonePage={true}
                onBack={() => {
                  if (typeof window !== "undefined") {
                    if (window.history.length > 1) {
                      window.history.back();
                    } else {
                      window.location.href = `/?selected=${encodeURIComponent(booking?.id || targetLookup)}`;
                    }
                  }
                }}
              />
            </Suspense>
          )}
        </div>
      )}
    </AppLayout>
  );
}
export default TrackingPage;
