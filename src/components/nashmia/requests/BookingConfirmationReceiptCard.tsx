import { memo, useState, useEffect, useCallback, useRef } from "react";
import { Check, Download, Copy, FileText } from "lucide-react";
import { CountryFlagSvg } from "@/components/nashmia/common/CountryFlagSvg";
import { getPortCountryMeta } from "@/lib/port-flags";
import { showPillToast } from "@/lib/pill-toast";
import { BookingDocumentsModal } from "@/components/nashmia/requests/BookingDocumentsModal";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  BookingRequestRecord,
  ForwarderQuoteRequestRecord,
  BookingConfirmationPayload,
} from "@/types/requests";

interface BookingConfirmationReceiptCardProps {
  request: BookingRequestRecord;
  forwarderRequests?: ForwarderQuoteRequestRecord[];
  onSelectRequest: (req: BookingRequestRecord) => void;
  onConfirmBooking?: (req: BookingRequestRecord) => void;
  onViewDocuments?: (req: BookingRequestRecord) => void;
  className?: string;
}

export const BookingConfirmationReceiptCard = memo(function BookingConfirmationReceiptCard({
  request,
  onSelectRequest,
  onViewDocuments,
  className,
}: BookingConfirmationReceiptCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  // Direct Supabase Live Record state to ensure immediate update & persistent freshness after refresh
  const [dbBooking, setDbBooking] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchBookingFromSupabase() {
      if (!isSupabaseConfigured) return;
      const targetId = request.id;
      const targetMov = request.movementNumber || request.bookingReference || request.reference;
      if (!targetId && !targetMov) return;

      try {
        let query = supabase
          .from("bookings")
          .select("*, forwarder:forwarders(*), buyer:buyers(*), supplier:suppliers(*)");

        if (targetId) {
          query = query.eq("id", targetId);
        } else if (targetMov) {
          query = query.or(`movement_number.eq.${targetMov},booking_reference.eq.${targetMov}`);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data && isMounted) {
          setDbBooking(data as Record<string, unknown>);
        }
      } catch (err) {
        console.warn(
          "[BookingConfirmationReceiptCard] Error fetching live booking from Supabase:",
          err,
        );
      }
    }

    fetchBookingFromSupabase();

    // Listen for real-time confirmation events dispatched by ConfirmBookingModal
    const handleMovementConfirmed = (e: Event) => {
      const evt = e as CustomEvent<{
        bookingId?: string;
        movementNumber?: string;
        updatedBooking?: Record<string, unknown>;
      }>;
      const detail = evt.detail;
      if (!detail) return;

      const isMatch =
        (detail.bookingId && detail.bookingId === request.id) ||
        (detail.movementNumber &&
          (detail.movementNumber === request.movementNumber ||
            detail.movementNumber === request.bookingReference ||
            detail.movementNumber === request.reference));

      if (isMatch) {
        if (detail.updatedBooking) {
          setDbBooking(detail.updatedBooking);
        } else {
          void fetchBookingFromSupabase();
        }
      }
    };

    window.addEventListener("nashmia_movement_confirmed", handleMovementConfirmed);

    return () => {
      isMounted = false;
      window.removeEventListener("nashmia_movement_confirmed", handleMovementConfirmed);
    };
  }, [request.id, request.movementNumber, request.bookingReference, request.reference]);

  // Merge Supabase database live record with props (DB record takes precedence for latest confirmed state)
  const confDetails = ((dbBooking?.confirmation_details as BookingConfirmationPayload) ||
    request.confirmationDetails ||
    {}) as Record<string, unknown>;

  const movementNumber =
    (confDetails.movement_number as string) ||
    (dbBooking?.movement_number as string) ||
    request.movementNumber ||
    request.bookingReference ||
    request.reference ||
    "";

  const bookingRef =
    (dbBooking?.booking_reference as string) ||
    request.bookingReference ||
    request.reference ||
    movementNumber;

  // Formatted Confirmation Date & Time (calculated strictly from real timestamps, no dummy dates)
  const rawConfirmedAt =
    (confDetails.confirmed_at as string) ||
    (dbBooking?.confirmed_at as string) ||
    request.confirmedAt ||
    (dbBooking?.updated_at as string) ||
    request.updatedAt ||
    (dbBooking?.created_at as string) ||
    request.createdAt;

  const { formattedConfirmedDate, formattedConfirmedTime } = (() => {
    if (!rawConfirmedAt) return { formattedConfirmedDate: "", formattedConfirmedTime: "" };
    try {
      const d = new Date(rawConfirmedAt);
      if (isNaN(d.getTime())) return { formattedConfirmedDate: "", formattedConfirmedTime: "" };
      return {
        formattedConfirmedDate: d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        formattedConfirmedTime: d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      };
    } catch {
      return { formattedConfirmedDate: "", formattedConfirmedTime: "" };
    }
  })();

  // 1. Forwarder
  const forwarderName =
    (confDetails.confirmed_forwarder_name as string) ||
    (dbBooking?.forwarder as { name?: string; company_name?: string })?.name ||
    (dbBooking?.forwarder as { company_name?: string })?.company_name ||
    (dbBooking?.forwarder_name as string) ||
    request.forwarderName ||
    "";

  // 2. Rate & Currency
  const finalAgreedRate: number | null = (() => {
    const candidate =
      (confDetails.agreed_rate as number) ??
      (confDetails.finalRate as number) ??
      (dbBooking?.rate_amount as number) ??
      request.finalAgreedRate ??
      request.rateAmount ??
      request.ratePerContainer;
    return typeof candidate === "number" && !isNaN(candidate) && candidate > 0 ? candidate : null;
  })();

  const currency =
    (confDetails.currency as string) ||
    (dbBooking?.currency as string) ||
    request.finalRateCurrency ||
    request.currency ||
    "USD";

  const containerCount: number | null = (() => {
    const c =
      (confDetails.container_count as number) ??
      (dbBooking?.container_count as number) ??
      request.containerCount;
    return typeof c === "number" && c > 0 ? c : null;
  })();

  const totalFreight: number | null = (() => {
    const tf = (confDetails.total_freight as number) ?? (dbBooking?.total_freight as number);
    if (typeof tf === "number" && tf > 0) return tf;
    if (finalAgreedRate && containerCount) return finalAgreedRate * containerCount;
    return finalAgreedRate || null;
  })();

  // 3. Shipping Line & Vessel
  const shippingLine =
    (confDetails.shipping_line as string) ||
    (confDetails.carrier as string) ||
    (dbBooking?.carrier as string) ||
    request.shippingLine ||
    request.assignedCarrier ||
    request.preferredCarrier ||
    "";

  const vesselName =
    (confDetails.vessel_name as string) ||
    (dbBooking?.vessel_name as string) ||
    request.vesselName ||
    "";

  const voyageNumber =
    (confDetails.voyage_number as string) ||
    (dbBooking?.voyage_number as string) ||
    request.voyageNumber ||
    "";

  // 4. ETD & ETA
  const etd =
    (confDetails.etd as string) ||
    (dbBooking?.etd as string) ||
    request.requestedEtd ||
    request.etd ||
    "";

  const eta =
    (confDetails.eta as string) ||
    (dbBooking?.eta as string) ||
    request.estimatedEta ||
    request.eta ||
    "";

  // 5. Pickup Date & Pickup Address
  const pickupDate =
    (confDetails.pickup_date as string) ||
    (confDetails.pickupDate as string) ||
    (dbBooking?.loading_date as string) ||
    request.pickupDate ||
    "";

  const pickupAddress =
    (confDetails.pickup_address as string) ||
    (confDetails.pickupAddress as string) ||
    request.pickupAddress ||
    (dbBooking?.supplier as { load_point?: string })?.load_point ||
    request.supplierLoadPoint ||
    "";

  // 6. Cargo Details
  const cargoDetails =
    (confDetails.special_instructions as string) ||
    (dbBooking?.special_instructions as string) ||
    request.specialInstructions ||
    (dbBooking?.product_description as string) ||
    request.cargo?.description ||
    "";

  // 7. Equipment specs
  const containerSize =
    (confDetails.container_size as string) ||
    (dbBooking?.container_size as string) ||
    request.containerSize ||
    "";

  const containerType =
    (confDetails.container_type as string) ||
    (dbBooking?.container_type as string) ||
    request.containerType ||
    "";

  // 8. Ports & Routing
  const polName =
    (confDetails.pol_name as string) ||
    (dbBooking?.pol_name as string) ||
    request.polName ||
    request.origin ||
    "";
  const polCode =
    (confDetails.pol_code as string) || (dbBooking?.pol_code as string) || request.polCode || "";

  const podName =
    (confDetails.pod_name as string) ||
    (dbBooking?.pod_name as string) ||
    request.podName ||
    request.destination ||
    "";
  const podCode =
    (confDetails.pod_code as string) || (dbBooking?.pod_code as string) || request.podCode || "";

  const polMeta = polCode ? getPortCountryMeta(polCode, polName) : null;
  const podMeta = podCode ? getPortCountryMeta(podCode, podName) : null;

  // 9. Buyer & Supplier
  const buyerName =
    (dbBooking?.buyer as { name?: string; company_name?: string })?.name ||
    (dbBooking?.buyer as { company_name?: string })?.company_name ||
    (dbBooking?.buyer_name as string) ||
    request.buyerName ||
    "";

  const supplierName =
    (dbBooking?.supplier as { name?: string; company_name?: string })?.name ||
    (dbBooking?.supplier as { company_name?: string })?.company_name ||
    (dbBooking?.supplier_name as string) ||
    request.supplierName ||
    "";

  const supplierCity =
    (dbBooking?.supplier as { city?: string })?.city || request.supplierCity || "";

  // Copy Reference
  const handleCopyReference = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!movementNumber) return;
      void navigator.clipboard.writeText(movementNumber);
      setIsCopied(true);
      showPillToast.success(`Copied: ${movementNumber}`, "Reference Copied");
      setTimeout(() => setIsCopied(false), 2000);
    },
    [movementNumber],
  );

  // Print / Download PDF Receipt (Builds dynamic HTML omitting any empty fields)
  const handlePrint = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      const printWindow = window.open("", "_blank", "width=800,height=880");
      if (!printWindow) {
        window.print();
        return;
      }

      // Generate dynamic tiles for filled fields only
      const tilesHtml: string[] = [];

      if (movementNumber) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Movement Number</div>
            <div class="tile-value">${movementNumber}</div>
          </div>
        `);
      }

      if (formattedConfirmedDate) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Confirmation Time</div>
            <div class="tile-value">${formattedConfirmedDate}${formattedConfirmedTime ? `, ${formattedConfirmedTime}` : ""}</div>
          </div>
        `);
      }

      if (forwarderName) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Selected Forwarder</div>
            <div class="tile-value">${forwarderName}</div>
          </div>
        `);
      }

      if (finalAgreedRate !== null) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Agreed Rate</div>
            <div class="tile-value">$${finalAgreedRate.toLocaleString()} ${currency} / container</div>
          </div>
        `);
      }

      if (shippingLine) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Shipping Line</div>
            <div class="tile-value">${shippingLine}</div>
          </div>
        `);
      }

      if (vesselName) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Vessel / Voyage</div>
            <div class="tile-value">${vesselName}${voyageNumber ? ` · ${voyageNumber}` : ""}</div>
          </div>
        `);
      }

      if (etd || eta) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Departure / Arrival (ETD / ETA)</div>
            <div class="tile-value">${etd ? etd : "TBD"} &rarr; ${eta ? eta : "TBD"}</div>
          </div>
        `);
      }

      if (pickupDate) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Cargo Pickup Date</div>
            <div class="tile-value">${pickupDate}</div>
          </div>
        `);
      }

      if (pickupAddress) {
        tilesHtml.push(`
          <div class="tile" style="grid-column: span 2;">
            <div class="tile-label">Pickup Address / Facility</div>
            <div class="tile-value">${pickupAddress}</div>
          </div>
        `);
      }

      if (cargoDetails) {
        tilesHtml.push(`
          <div class="tile" style="grid-column: span 2;">
            <div class="tile-label">Cargo Details & Instructions</div>
            <div class="tile-value">${cargoDetails}</div>
          </div>
        `);
      }

      if (polCode || polName || podCode || podName) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Routing Ports</div>
            <div class="tile-value">${polCode || polName} &rarr; ${podCode || podName}</div>
          </div>
        `);
      }

      if (containerCount || containerSize) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Equipment</div>
            <div class="tile-value">${containerCount ? `${containerCount}x ` : ""}${containerSize}${containerType ? ` (${containerType})` : ""}</div>
          </div>
        `);
      }

      if (buyerName) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Buyer</div>
            <div class="tile-value">${buyerName}</div>
          </div>
        `);
      }

      if (supplierName) {
        tilesHtml.push(`
          <div class="tile">
            <div class="tile-label">Supplier / Load Point</div>
            <div class="tile-value">${supplierName}${supplierCity ? ` (${supplierCity})` : ""}</div>
          </div>
        `);
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Booking Confirmation Receipt - ${movementNumber || "Official"}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 40px; margin: 0; background: #f8fafc; }
            .receipt-card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
            .top-icon { width: 44px; height: 44px; background: #10B981; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 14px; font-weight: bold; }
            .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; margin-bottom: 18px; }
            .divider { border-top: 1px solid #f1f5f9; margin-bottom: 16px; }
            .hero-label { font-size: 11px; color: #64748b; font-weight: 500; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
            .hero-value { font-size: 24px; font-weight: 900; color: #0f172a; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: left; margin-bottom: 20px; }
            .tile { background: #f8fafc; border-radius: 8px; padding: 8px 10px; }
            .tile-label { font-size: 10px; color: #64748b; font-weight: 500; margin-bottom: 2px; text-transform: uppercase; }
            .tile-value { font-size: 12px; font-weight: 700; color: #0f172a; word-break: break-word; }
            .footer-action { font-size: 11.5px; font-weight: 600; color: #64748b; border-top: 1px solid #f1f5f9; pt: 12px; }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="top-icon">&#10003;</div>
            <h1 class="title">Booking Confirmed!</h1>
            <p class="subtitle">Your booking has been successfully confirmed.</p>
            <div class="divider"></div>

            ${
              totalFreight
                ? `
              <div class="hero-label">Total Agreed Freight</div>
              <div class="hero-value">${currency} ${totalFreight.toLocaleString()}</div>
            `
                : finalAgreedRate
                  ? `
              <div class="hero-label">Agreed Rate</div>
              <div class="hero-value">${currency} ${finalAgreedRate.toLocaleString()}</div>
            `
                  : ""
            }

            <div class="grid">
              ${tilesHtml.join("")}
            </div>

            <div class="footer-action">
              Official Movement Receipt &bull; Nashmia Logistics &bull; Ref: ${bookingRef}
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    },
    [
      movementNumber,
      formattedConfirmedDate,
      formattedConfirmedTime,
      forwarderName,
      finalAgreedRate,
      currency,
      shippingLine,
      vesselName,
      voyageNumber,
      etd,
      eta,
      pickupDate,
      pickupAddress,
      cargoDetails,
      polCode,
      polName,
      podCode,
      podName,
      containerCount,
      containerSize,
      containerType,
      buyerName,
      supplierName,
      supplierCity,
      totalFreight,
      bookingRef,
    ],
  );

  return (
    <>
      <div
        ref={receiptPrintRef}
        className={cn(
          "group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_6px_20px_-3px_rgba(0,0,0,0.07)]",
          className,
        )}
      >
        <div>
          {/* Top Green Icon Button - Centered at top, ring-4 white */}
          <div className="flex justify-center -mt-7 mb-1.5">
            <div className="size-10 rounded-full bg-[#10B981] text-white flex items-center justify-center shadow-sm ring-4 ring-white">
              <Check className="size-5 stroke-[3]" />
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="text-center">
            <h3 className="text-[17.5px] font-bold tracking-tight text-slate-900 leading-tight">
              Booking Confirmed!
            </h3>
            <p className="mt-0.5 text-[11.5px] text-slate-500 font-normal">
              Your booking has been successfully confirmed.
            </p>
          </div>

          {/* Subtle Horizontal Divider */}
          <div className="w-full border-t border-slate-100 my-2.5" />

          {/* Hero Section: Total Agreed Freight / Agreed Rate */}
          {(totalFreight || finalAgreedRate) && (
            <div className="text-center">
              <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400 block">
                {totalFreight ? "Total Agreed Freight" : "Agreed Rate"}
              </span>
              <div className="text-[22px] font-extrabold tracking-tight text-slate-900">
                {currency} {(totalFreight || finalAgreedRate)?.toLocaleString()}
              </div>
            </div>
          )}

          {/* All Details in Small Words - BORDERLESS COMPACT CARD */}
          <div className="mt-2.5 rounded-xl bg-slate-50/70 p-2.5 space-y-2 text-left">
            {/* Row 1: Ref Number & Confirmed Time */}
            <div className="grid grid-cols-2 gap-2">
              {movementNumber && (
                <div>
                  <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                    Ref Number
                  </span>
                  <div className="flex items-center gap-1 font-bold text-[11.5px] text-slate-900">
                    <span className="font-mono truncate">{movementNumber}</span>
                    <button
                      type="button"
                      onClick={handleCopyReference}
                      className="size-3.5 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                      title="Copy reference"
                    >
                      {isCopied ? (
                        <Check className="size-2.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-2.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {formattedConfirmedDate && (
                <div>
                  <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                    Confirmed Time
                  </span>
                  <div className="font-semibold text-[11px] text-slate-800 truncate">
                    {formattedConfirmedDate}
                    {formattedConfirmedTime ? `, ${formattedConfirmedTime}` : ""}
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Forwarder & Agreed Rate */}
            {(forwarderName || finalAgreedRate !== null) && (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/50 pt-1.5">
                {forwarderName && (
                  <div>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Forwarder
                    </span>
                    <div
                      className="font-semibold text-[11.5px] text-slate-900 truncate"
                      title={forwarderName}
                    >
                      {forwarderName}
                    </div>
                  </div>
                )}

                {finalAgreedRate !== null && (
                  <div>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Agreed Rate
                    </span>
                    <div className="font-bold text-[11.5px] text-[#009EE2] truncate">
                      ${finalAgreedRate.toLocaleString()} {currency}
                      <span className="text-[9.5px] text-slate-500 font-normal ml-0.5">/cntr</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Shipping Line & Vessel */}
            {(shippingLine || vesselName) && (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/50 pt-1.5">
                {shippingLine && (
                  <div>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Shipping Line
                    </span>
                    <div
                      className="font-semibold text-[11px] text-slate-900 truncate"
                      title={shippingLine}
                    >
                      {shippingLine}
                    </div>
                  </div>
                )}

                {vesselName && (
                  <div>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Vessel
                    </span>
                    <div
                      className="font-semibold text-[11px] text-slate-800 truncate"
                      title={vesselName}
                    >
                      {vesselName}
                      {voyageNumber && (
                        <span className="text-slate-400 font-normal"> · {voyageNumber}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 4: ETD & ETA */}
            {(etd || eta) && (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/50 pt-1.5">
                <div>
                  <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                    ETD & ETA
                  </span>
                  <div className="font-semibold text-[11px] text-slate-800 truncate">
                    {etd && eta ? (
                      <>
                        {etd} <span className="text-slate-400">→</span> {eta}
                      </>
                    ) : etd ? (
                      `ETD: ${etd}`
                    ) : (
                      `ETA: ${eta}`
                    )}
                  </div>
                </div>

                {(polCode || podCode || polName || podName) && (
                  <div>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Load & Dest Ports
                    </span>
                    <div className="flex items-center gap-1 font-semibold text-[11px] text-slate-900 truncate">
                      {polMeta?.countryCode && (
                        <CountryFlagSvg countryCode={polMeta.countryCode} size="xs" />
                      )}
                      <span>{polCode || polName}</span>
                      <span className="text-slate-400">→</span>
                      {podMeta?.countryCode && (
                        <CountryFlagSvg countryCode={podMeta.countryCode} size="xs" />
                      )}
                      <span>{podCode || podName}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 5: Pickup Date & Pickup Address */}
            {(pickupDate || pickupAddress) && (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/50 pt-1.5">
                {pickupDate && (
                  <div>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Pickup Date
                    </span>
                    <div className="font-semibold text-[11px] text-slate-800 truncate">
                      {pickupDate}
                    </div>
                  </div>
                )}

                {pickupAddress && (
                  <div className={cn(!pickupDate && "col-span-2")}>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Pickup Address
                    </span>
                    <div
                      className="font-semibold text-[11px] text-slate-800 truncate"
                      title={pickupAddress}
                    >
                      {pickupAddress}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 6: Equipment (Container & Qty) */}
            {(containerCount || containerSize) && (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/50 pt-1.5">
                <div>
                  <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                    Container & Qty
                  </span>
                  <div className="font-semibold text-[11px] text-slate-900 truncate">
                    {containerCount ? `${containerCount}x ` : ""}
                    {containerSize}{" "}
                    {containerType && (
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({containerType})
                      </span>
                    )}
                  </div>
                </div>

                {buyerName && (
                  <div>
                    <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                      Buyer
                    </span>
                    <div
                      className="font-semibold text-[11.5px] text-slate-900 truncate"
                      title={buyerName}
                    >
                      {buyerName}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 7: Cargo Details (Special instructions & cargo specification) */}
            {cargoDetails && (
              <div className="border-t border-slate-200/50 pt-1.5">
                <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                  Cargo Details
                </span>
                <div
                  className="font-medium text-[11px] text-slate-800 line-clamp-2 leading-relaxed"
                  title={cargoDetails}
                >
                  {cargoDetails}
                </div>
              </div>
            )}

            {/* Row 8: Supplier / Load Point (Only if filled) */}
            {supplierName && (
              <div className="border-t border-slate-200/50 pt-1.5">
                <span className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wide block">
                  Supplier / Load Point
                </span>
                <div
                  className="font-semibold text-[11px] text-slate-800 truncate"
                  title={`${supplierName}${supplierCity ? ` (${supplierCity})` : ""}`}
                >
                  {supplierName}
                  {supplierCity && (
                    <span className="text-slate-400 font-normal"> ({supplierCity})</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Link: Get PDF Receipt */}
        <div className="mt-2.5 flex flex-col items-center">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 text-slate-900 hover:text-[#009EE2] font-semibold text-[12.5px] py-0.5 cursor-pointer transition-colors active:scale-95"
          >
            <Download className="size-3.5 stroke-[2.2]" />
            <span>Get PDF Receipt</span>
          </button>

          {/* Compact Sub-links: View Details & View Documents */}
          <div className="mt-1.5 flex items-center justify-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 w-full">
            <button
              type="button"
              onClick={() => onSelectRequest(request)}
              className="hover:text-slate-900 font-medium cursor-pointer transition-colors"
            >
              View Details
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => {
                if (onViewDocuments) {
                  onViewDocuments(request);
                } else {
                  setIsDocsOpen(true);
                }
              }}
              className="hover:text-[#0FA3B1] font-medium cursor-pointer transition-colors flex items-center gap-1"
            >
              <FileText className="size-3" />
              <span>View Documents</span>
            </button>
          </div>
        </div>

        {/* Subtle Perforated Receipt Bottom Edge */}
        <div className="relative -mx-4.5 -mb-4.5 mt-2.5 overflow-hidden h-2.5 bg-transparent flex justify-between items-end px-0.5 pointer-events-none">
          {Array.from({ length: 22 }).map((_, i) => (
            <div key={i} className="size-2 rounded-full bg-slate-100 -mb-1 shrink-0" />
          ))}
        </div>
      </div>

      {/* Verified Movement Documents Modal */}
      <BookingDocumentsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        request={request}
        onDownloadPdf={handlePrint}
      />
    </>
  );
});
