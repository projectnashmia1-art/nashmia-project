import { useState, useEffect, useMemo, memo, FormEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Check,
  Copy,
  DollarSign,
  Loader2,
  Mail,
  Ship,
  X,
  ChevronDown,
  MapPin,
  Building2,
  FileText,
} from "lucide-react";
import { fetchForwarderRequestsFromDatabase } from "@/lib/quotation-database-service";
import { confirmBookingAndMovementInDatabase } from "@/lib/booking-confirmation-service";
import { showPillToast } from "@/lib/pill-toast";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BookingRequestRecord, ForwarderQuoteRequestRecord } from "@/types/requests";

interface ConfirmBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingRequest: BookingRequestRecord | null;
  forwarderRequests?: ForwarderQuoteRequestRecord[];
  onConfirmed?: (updatedBooking?: Record<string, unknown>) => void;
}

const KNOWN_VESSELS = [
  "MSC Oscar",
  "CMA CGM Antoine de Saint Exupéry",
  "Maersk Mc-Kinney Møller",
  "Ever Given",
  "ONE Integrity",
  "COSCO Shipping Gemini",
  "Hapag-Lloyd Al Dahna Express",
  "OOCL Hong Kong",
  "Yang Ming Witness",
  "Ever Ace",
];

const KNOWN_SHIPPING_LINES = [
  "MSC (Mediterranean Shipping Company)",
  "Maersk Line",
  "CMA CGM Group",
  "Hapag-Lloyd",
  "COSCO Shipping Lines",
  "ONE (Ocean Network Express)",
  "Evergreen Marine",
  "Yang Ming Marine Transport",
  "ZIM Integrated Shipping",
  "Wan Hai Lines",
];

export const ConfirmBookingModal = memo(function ConfirmBookingModal({
  isOpen,
  onClose,
  bookingRequest,
  forwarderRequests,
  onConfirmed,
}: ConfirmBookingModalProps) {
  const { userId } = useAuth();

  // Forwarders State
  const [loadingForwarders, setLoadingForwarders] = useState(false);
  const [availableForwarders, setAvailableForwarders] = useState<ForwarderQuoteRequestRecord[]>([]);
  const [selectedForwarderId, setSelectedForwarderId] = useState<string>("");
  const [selectedForwarderReq, setSelectedForwarderReq] =
    useState<ForwarderQuoteRequestRecord | null>(null);

  // Existing Inputs
  const [vesselName, setVesselName] = useState<string>("");
  const [etd, setEtd] = useState<string>("");
  const [eta, setEta] = useState<string>("");
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState<boolean>(true);

  // Exactly 5 New Input Fields
  const [rate, setRate] = useState<string>("");
  const [pickupDate, setPickupDate] = useState<string>("");
  const [shippingLine, setShippingLine] = useState<string>("");
  const [cargoDetails, setCargoDetails] = useState<string>("");
  const [pickupAddress, setPickupAddress] = useState<string>("");

  // Select vs Custom Text entry toggles
  const [isCustomShippingLine, setIsCustomShippingLine] = useState<boolean>(false);
  const [isCustomVessel, setIsCustomVessel] = useState<boolean>(false);

  // Track currency for display
  const [currency, setCurrency] = useState<string>("USD");

  // Validation & Submission State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success Screen State
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedEntity, setSavedEntity] = useState<{
    movementNumber: string;
    forwarderName: string;
    vesselName: string;
    shippingLine: string;
    rate: number;
    currency: string;
    etd: string;
    eta: string;
    pickupDate: string;
    pickupAddress: string;
    emailSent: boolean;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Helper to populate values from request or forwarder quote
  const applyValuesFromSources = (
    req: BookingRequestRecord,
    fwd?: ForwarderQuoteRequestRecord | null,
  ) => {
    // 1. Rate & Currency
    const quotedRate =
      fwd?.offerData?.ratePerContainer ??
      fwd?.ratePerContainer ??
      req.finalAgreedRate ??
      req.rateAmount ??
      req.ratePerContainer ??
      req.totalFreight ??
      2400;
    setRate(String(quotedRate));

    const selectedCurr =
      fwd?.offerData?.currency || fwd?.currency || req.finalRateCurrency || req.currency || "USD";
    setCurrency(selectedCurr);

    // 2. ETD & ETA
    const resolvedEtd = fwd?.offerData?.etd || fwd?.etd || req.requestedEtd || req.etd || "";
    setEtd(resolvedEtd);

    const resolvedEta = fwd?.offerData?.eta || fwd?.eta || req.estimatedEta || req.eta || "";
    setEta(resolvedEta);

    // 3. Vessel & Shipping Line
    const resolvedVessel =
      ((fwd?.offerData as Record<string, unknown>)?.vesselName as string) || req.vesselName || "";
    setVesselName(resolvedVessel);

    const resolvedCarrier =
      fwd?.offerData?.carrier ||
      req.shippingLine ||
      req.preferredCarrier ||
      req.assignedCarrier ||
      "MSC (Mediterranean Shipping Company)";
    setShippingLine(resolvedCarrier);

    // 4. Pickup Date & Pickup Address
    const resolvedPickupDate =
      req.pickupDate ||
      (req as unknown as { loadingDate?: string }).loadingDate ||
      resolvedEtd ||
      "";
    setPickupDate(resolvedPickupDate);

    const resolvedPickupAddress =
      req.pickupAddress ||
      req.supplierLoadPoint ||
      (req.supplierCity ? `${req.supplierCity}, Logistics Facility` : "") ||
      (req.polName ? `Port Facility, ${req.polName}` : "Designated CFS / Loading Facility");
    setPickupAddress(resolvedPickupAddress);

    // 5. Cargo Details
    const resolvedCargo = req.cargo?.description || req.specialInstructions || "";
    setCargoDetails(resolvedCargo);

    setIsCustomShippingLine(false);
    setIsCustomVessel(false);
  };

  // Load forwarders and initialize values when modal opens
  useEffect(() => {
    if (!isOpen || !bookingRequest) {
      return;
    }

    setErrorMessage(null);
    setErrors({});
    setIsSuccess(false);
    setSavedEntity(null);
    setCopiedCode(false);
    let isCancelled = false;

    // Fast-path: Synchronously resolve available forwarders from already-cached props
    const matchingFromProps = (forwarderRequests || []).filter((r) => {
      if (!r?.id) return false;
      const bId = bookingRequest.id;
      const bMov = bookingRequest.movementNumber;
      const bRef = bookingRequest.bookingReference || bookingRequest.reference;
      return (
        (bId && r.bookingId === bId) ||
        (bMov && r.movementNumber === bMov) ||
        (bRef && r.movementNumber === bRef) ||
        (bRef && r.bookingReference === bRef)
      );
    });

    if (matchingFromProps.length > 0) {
      setAvailableForwarders(matchingFromProps);
      setLoadingForwarders(false);

      let candidate = matchingFromProps.find(
        (f) => f.awardStatus === "AWARDED" || f.status === "CONFIRMED",
      );
      if (!candidate && matchingFromProps.length > 0) {
        candidate = [...matchingFromProps].sort((a, b) => {
          const rateA = a.offerData?.ratePerContainer || a.ratePerContainer || 999999;
          const rateB = b.offerData?.ratePerContainer || b.ratePerContainer || 999999;
          return rateA - rateB;
        })[0];
      }

      if (candidate) {
        setSelectedForwarderId(candidate.id);
        setSelectedForwarderReq(candidate);
        applyValuesFromSources(bookingRequest, candidate);
      } else {
        applyValuesFromSources(bookingRequest, null);
      }
    } else {
      setLoadingForwarders(true);
      applyValuesFromSources(bookingRequest, null);
    }

    async function loadBookingForwarders() {
      try {
        const targetKeys = [
          bookingRequest?.id,
          bookingRequest?.movementNumber,
          bookingRequest?.bookingReference,
          bookingRequest?.reference,
        ].filter(Boolean) as string[];

        // Fetch real forwarders from Supabase in background (or fallback if props were empty)
        const dbRecords = await fetchForwarderRequestsFromDatabase(targetKeys);

        // Merge with props
        const mergedMap = new Map<string, ForwarderQuoteRequestRecord>();
        for (const r of matchingFromProps) {
          if (r?.id) mergedMap.set(r.id, r);
        }
        for (const r of dbRecords) {
          if (r?.id) mergedMap.set(r.id, r);
        }

        let list = Array.from(mergedMap.values());

        // Fallback card from booking assigned forwarder if list is empty
        if (
          list.length === 0 &&
          (bookingRequest?.forwarderName || bookingRequest?.preferredCarrier)
        ) {
          const fallbackFwd: ForwarderQuoteRequestRecord = {
            id: bookingRequest.forwarderId || "fwd-assigned",
            forwarderId: bookingRequest.forwarderId || "fwd-assigned",
            forwarderName:
              bookingRequest.forwarderName ||
              bookingRequest.preferredCarrier ||
              "Assigned Forwarder",
            forwarderEmail: bookingRequest.forwarderEmail || "operations@forwarder.com",
            ratePerContainer: bookingRequest.rateAmount || bookingRequest.totalFreight || 2400,
            currency: bookingRequest.currency || "USD",
            status: "QUOTED",
            createdAt: new Date().toISOString(),
          };
          list = [fallbackFwd];
        }

        if (!isCancelled && list.length > 0) {
          setAvailableForwarders(list);

          // Find candidate forwarder to preselect if not already selected
          let candidate = list.find((f) => f.awardStatus === "AWARDED" || f.status === "CONFIRMED");
          if (!candidate && list.length > 0) {
            candidate = [...list].sort((a, b) => {
              const rateA = a.offerData?.ratePerContainer || a.ratePerContainer || 999999;
              const rateB = b.offerData?.ratePerContainer || b.ratePerContainer || 999999;
              return rateA - rateB;
            })[0];
          }

          if (candidate) {
            setSelectedForwarderId((curr) => curr || candidate.id);
            setSelectedForwarderReq((curr) => curr || candidate);
            applyValuesFromSources(bookingRequest, candidate);
          }
        }
      } catch (err) {
        console.warn("[ConfirmBookingModal] Notice loading forwarders:", err);
      } finally {
        if (!isCancelled) {
          setLoadingForwarders(false);
        }
      }
    }

    loadBookingForwarders();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, bookingRequest, forwarderRequests]);

  // When a forwarder card is selected
  const handleSelectForwarder = (fwd: ForwarderQuoteRequestRecord) => {
    setSelectedForwarderId(fwd.id);
    setSelectedForwarderReq(fwd);
    if (errors.forwarder) {
      setErrors((prev) => ({ ...prev, forwarder: "" }));
    }

    const newRate = fwd.offerData?.ratePerContainer ?? fwd.ratePerContainer;
    if (newRate) setRate(String(newRate));

    const newCurrency = fwd.offerData?.currency || fwd.currency;
    if (newCurrency) setCurrency(newCurrency);

    const newEtd = fwd.offerData?.etd || fwd.etd;
    if (newEtd) setEtd(newEtd);

    const newEta = fwd.offerData?.eta || fwd.eta;
    if (newEta) setEta(newEta);

    const newVessel = (fwd.offerData as Record<string, unknown>)?.vesselName as string;
    if (newVessel) {
      setVesselName(newVessel);
      setIsCustomVessel(false);
    }

    const newCarrier = fwd.offerData?.carrier;
    if (newCarrier) {
      setShippingLine(newCarrier);
      setIsCustomShippingLine(false);
    }
  };

  const handleDismiss = () => {
    onClose();
    setTimeout(() => {
      setIsSuccess(false);
      setSavedEntity(null);
    }, 200);
  };

  // Combine unique vessel list from constants + existing booking vessel
  const vesselOptions = useMemo(() => {
    const list = [...KNOWN_VESSELS];
    if (bookingRequest?.vesselName && !list.includes(bookingRequest.vesselName)) {
      list.unshift(bookingRequest.vesselName);
    }
    if (vesselName && !list.includes(vesselName) && !isCustomVessel) {
      list.unshift(vesselName);
    }
    return list;
  }, [bookingRequest?.vesselName, vesselName, isCustomVessel]);

  const shippingLineOptions = useMemo(() => {
    const list = [...KNOWN_SHIPPING_LINES];
    if (bookingRequest?.preferredCarrier && !list.includes(bookingRequest.preferredCarrier)) {
      list.unshift(bookingRequest.preferredCarrier);
    }
    if (shippingLine && !list.includes(shippingLine) && !isCustomShippingLine) {
      list.unshift(shippingLine);
    }
    return list;
  }, [bookingRequest?.preferredCarrier, shippingLine, isCustomShippingLine]);

  // Submit Handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!bookingRequest) return;

    const newErrors: Record<string, string> = {};

    if (!selectedForwarderReq && !selectedForwarderId && availableForwarders.length > 0) {
      newErrors.forwarder = "Please select a forwarder";
    }

    const numericRate = parseFloat(rate);
    if (!rate || isNaN(numericRate) || numericRate <= 0) {
      newErrors.rate = "Please enter a valid rate greater than zero";
    }

    if (!vesselName.trim()) {
      newErrors.vesselName = "Vessel name is required";
    }

    if (!shippingLine.trim()) {
      newErrors.shippingLine = "Shipping line is required";
    }

    if (!etd) {
      newErrors.etd = "Departure date (ETD) is required";
    }

    if (!eta) {
      newErrors.eta = "Arrival date (ETA) is required";
    }

    if (etd && eta && new Date(eta) < new Date(etd)) {
      newErrors.eta = "ETA must be on or after departure date (ETD)";
    }

    if (!pickupDate) {
      newErrors.pickupDate = "Pickup date is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const fwd =
        selectedForwarderReq ||
        availableForwarders.find((f) => f.id === selectedForwarderId) ||
        null;
      const forwarderName =
        fwd?.forwarderName ||
        (fwd as unknown as { name?: string })?.name ||
        bookingRequest.forwarderName ||
        "Awarded Forwarder";
      const forwarderEmail =
        fwd?.forwarderEmail ||
        (fwd as unknown as { email?: string })?.email ||
        bookingRequest.forwarderEmail ||
        "operations@forwarder.com";
      const forwarderId =
        fwd?.forwarderId ||
        (fwd as unknown as { forwarder_id?: string })?.forwarder_id ||
        fwd?.id ||
        selectedForwarderId ||
        "";

      const movementRef =
        bookingRequest.movementNumber ||
        bookingRequest.bookingReference ||
        bookingRequest.reference ||
        "NASH-BK-2026";

      // Save confirmation directly to Supabase with the 5 new fields
      const result = await confirmBookingAndMovementInDatabase({
        bookingId: bookingRequest.id,
        movementNumber: movementRef,
        forwarderId,
        forwarderName,
        forwarderEmail,
        finalRate: numericRate,
        currency: currency.trim() || "USD",
        etd,
        eta,
        pickupDate: pickupDate.trim(),
        pickupAddress: pickupAddress.trim(),
        polName: bookingRequest.polName || bookingRequest.origin || "Origin Port",
        polCode: bookingRequest.polCode || "POL",
        podName: bookingRequest.podName || bookingRequest.destination || "Destination Port",
        podCode: bookingRequest.podCode || "POD",
        shippingLine: shippingLine.trim(),
        vesselName: vesselName.trim(),
        voyageNumber: bookingRequest.voyageNumber || "",
        containerCount: bookingRequest.containerCount || 1,
        containerSize: bookingRequest.containerSize || "40HC",
        containerType: bookingRequest.containerType || "Standard Dry",
        specialInstructions: cargoDetails.trim(),
        sendConfirmationEmail,
        userId,
        forwarderRequestId: fwd?.id || null,
        quotationId: fwd?.quotationId || null,
      });

      const emailNote =
        result.emailStatus === "SENT" ? ` Confirmation email sent to ${forwarderEmail}.` : "";

      showPillToast.success(
        `Movement ${result.movementNumber} successfully confirmed with ${forwarderName}.${emailNote}`,
        "Booking Confirmed",
        result.movementNumber,
      );

      // Transition smoothly to the in-modal success animation screen
      setSavedEntity({
        movementNumber: result.movementNumber || movementRef,
        forwarderName,
        vesselName: vesselName.trim(),
        shippingLine: shippingLine.trim(),
        rate: numericRate,
        currency,
        etd,
        eta,
        pickupDate,
        pickupAddress: pickupAddress.trim(),
        emailSent: result.emailStatus === "SENT",
      });
      setIsSuccess(true);

      // Dispatch global window events for instant UI synchronization across Movement Lifecycle table
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nashmia_movement_confirmed", {
            detail: {
              bookingId: bookingRequest.id,
              movementNumber: result.movementNumber || movementRef,
              forwarderId,
              forwarderName,
              forwarderEmail,
              status: "Confirmed",
              confirmationStatus: "CONFIRMED",
              movement_status: "CONFIRMED",
              isConfirmed: true,
              confirmedBy: userId || "Operations Desk",
              confirmedAt: new Date().toISOString(),
              vesselName: vesselName.trim(),
              shippingLine: shippingLine.trim(),
              rate: numericRate,
              currency,
              etd,
              eta,
              pickupDate: pickupDate.trim(),
              pickupAddress: pickupAddress.trim(),
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("nashmia_booking_status_updated", {
            detail: {
              bookingId: bookingRequest.id,
              movementNumber: result.movementNumber || movementRef,
              forwarderId,
              forwarderName,
              status: "Confirmed",
              confirmationStatus: "CONFIRMED",
              movement_status: "CONFIRMED",
              isConfirmed: true,
            },
          }),
        );
      }

      // Trigger instant callback so Request cards and Movement tables update without page refresh
      if (onConfirmed) {
        onConfirmed({
          status: "Approved",
          confirmationStatus: "CONFIRMED",
          isConfirmed: true,
          isMovementConfirmed: true,
          confirmedAt: new Date().toISOString(),
          forwarderName,
          forwarderEmail,
          forwarderId,
          finalAgreedRate: numericRate,
          currency,
          vesselName: vesselName.trim(),
          shippingLine: shippingLine.trim(),
          requestedEtd: etd,
          estimatedEta: eta,
          pickupDate: pickupDate.trim(),
          pickupAddress: pickupAddress.trim(),
          specialInstructions: cargoDetails.trim(),
          confirmationDetails: {
            is_confirmed: true,
            status: "CONFIRMED",
            confirmed_at: new Date().toISOString(),
            movement_number: result.movementNumber || movementRef,
            agreed_rate: numericRate,
            currency,
            confirmed_forwarder_id: forwarderId,
            confirmed_forwarder_name: forwarderName,
            confirmed_forwarder_email: forwarderEmail,
            vessel_name: vesselName.trim(),
            shipping_line: shippingLine.trim(),
            etd,
            eta,
            pickup_date: pickupDate.trim(),
            pickup_address: pickupAddress.trim(),
            special_instructions: cargoDetails.trim(),
          },
        });
      }
    } catch (err: unknown) {
      console.error("[ConfirmBookingModal] Error submitting confirmation:", err);
      const msg =
        err instanceof Error ? err.message : "Unable to confirm booking. Please try again.";
      setErrorMessage(msg);
      showPillToast.error(msg, "Confirmation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !bookingRequest) return null;

  const movementNo =
    bookingRequest.movementNumber ||
    bookingRequest.reference ||
    bookingRequest.bookingReference ||
    "NASH-BK";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && handleDismiss()}>
      {/* Blurred background overlay & clean white modal card matching detail popup width */}
      <DialogContent
        hideCloseButton
        className={cn(
          "w-full sm:max-w-5xl xl:max-w-6xl !p-0 sm:!p-0 !border-0 sm:!border-0 overflow-hidden rounded-[24px] sm:rounded-[32px] bg-white shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18)] text-slate-900 focus:outline-none",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        {isSuccess && savedEntity ? (
          /* ================= SUCCESS STATE WITH ANIMATED GREEN CHECKMARK ================= */
          <div className="p-7 sm:p-8 flex flex-col items-center text-center space-y-5 animate-in fade-in-50 zoom-in-95 duration-300">
            {/* Animated green checkmark circle */}
            <div className="relative size-18 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm animate-in zoom-in-75 duration-300">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping opacity-75" />
              <Check className="size-9 stroke-[3] text-emerald-600 relative z-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Booking Confirmed!
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-500 max-w-sm">
                Movement has been updated in Supabase and assigned to{" "}
                <span className="font-semibold text-slate-800">{savedEntity.forwarderName}</span>.
              </p>
            </div>

            {/* Movement Number Badge with Copy */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-mono font-bold text-slate-800">
              <span>{savedEntity.movementNumber}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(savedEntity.movementNumber);
                  setCopiedCode(true);
                  toast.success("Movement number copied");
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Copy movement number"
              >
                {copiedCode ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>

            {/* Confirmation Summary Card */}
            <div className="w-full rounded-2xl bg-white border border-slate-200/90 shadow-2xs p-4.5 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Forwarder</span>
                <span className="font-semibold text-slate-800">{savedEntity.forwarderName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Agreed Rate</span>
                <span className="font-semibold text-emerald-600">
                  {savedEntity.currency} {savedEntity.rate.toLocaleString()} / container
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Vessel / Shipping Line</span>
                <span className="font-semibold text-slate-800">
                  {savedEntity.vesselName} ({savedEntity.shippingLine})
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Departure / Arrival (ETD / ETA)</span>
                <span className="font-semibold text-slate-800">
                  {savedEntity.etd} → {savedEntity.eta}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Cargo Pickup Date</span>
                <span className="font-semibold text-slate-800">{savedEntity.pickupDate}</span>
              </div>
              {savedEntity.pickupAddress && (
                <div className="flex justify-between items-center text-slate-500">
                  <span>Pickup Facility</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                    {savedEntity.pickupAddress}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-500 pt-1.5 border-t border-slate-200/50">
                <span>Confirmation Email</span>
                <span
                  className={cn(
                    "font-semibold inline-flex items-center gap-1",
                    savedEntity.emailSent ? "text-emerald-600" : "text-slate-500",
                  )}
                >
                  {savedEntity.emailSent ? (
                    <>
                      <Mail className="size-3" /> Transmitted to Forwarder
                    </>
                  ) : (
                    "No email requested"
                  )}
                </span>
              </div>
            </div>

            {/* Done Button */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-full shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ================= MAIN FORM ================= */
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[88vh]">
            {/* Header: Title + Close Button */}
            <div className="px-6 py-5 sm:px-8 sm:py-5 flex items-center justify-between border-b border-slate-100/90 shrink-0 bg-white">
              <div>
                <h2 className="text-lg sm:text-[20px] font-bold tracking-tight text-slate-900">
                  Confirm Booking
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Movement #{movementNo}</p>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close"
                className="size-8.5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="px-6 sm:px-8 py-5 overflow-y-auto space-y-4.5 [scrollbar-width:thin] max-h-[calc(88vh-140px)]">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {errorMessage}
                </div>
              )}

              {/* 1. FORWARDER (Selectable White Cards in Responsive Grid) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Select Forwarder
                  </label>
                  {availableForwarders.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      {availableForwarders.length} available
                    </span>
                  )}
                </div>

                {loadingForwarders ? (
                  <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="size-4 animate-spin text-[#0FA3B1]" />
                    <span>Loading available forwarders...</span>
                  </div>
                ) : availableForwarders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-center text-xs text-slate-500">
                    No forwarders currently registered for this request.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[175px] overflow-y-auto [scrollbar-width:thin] pr-0.5">
                    {availableForwarders.map((fwd) => {
                      const isSelected = selectedForwarderId === fwd.id;
                      const quotedRate =
                        fwd.offerData?.ratePerContainer ||
                        fwd.ratePerContainer ||
                        (fwd.offerData?.totalFreight
                          ? fwd.offerData.totalFreight / (fwd.containerCount || 1)
                          : 0);

                      return (
                        <div
                          key={fwd.id}
                          onClick={() => handleSelectForwarder(fwd)}
                          className={cn(
                            "relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left bg-white",
                            isSelected
                              ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                              : "border-slate-200/90 hover:border-slate-300 hover:shadow-xs shadow-2xs",
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <span
                                className="font-semibold text-xs text-slate-900 block truncate"
                                title={fwd.forwarderName}
                              >
                                {fwd.forwarderName}
                              </span>
                              <span
                                className="text-[11px] text-slate-400 block truncate"
                                title={fwd.forwarderEmail}
                              >
                                {fwd.forwarderEmail}
                              </span>
                            </div>

                            <div
                              className={cn(
                                "size-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                isSelected
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-slate-300 bg-white",
                              )}
                            >
                              {isSelected && <Check className="size-2.5 stroke-[3]" />}
                            </div>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Quoted Rate</span>
                            <span className="font-semibold text-slate-800">
                              {quotedRate ? `$${quotedRate.toLocaleString()}` : "Pending"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {errors.forwarder && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.forwarder}</p>
                )}
              </div>

              {/* 2 & 3. RATE & CURRENCY (Split Row) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* FIELD: RATE */}
                <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Agreed Rate (per container)
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <DollarSign className="size-4" />
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={rate}
                      onChange={(e) => {
                        setRate(e.target.value);
                        if (errors.rate) setErrors((prev) => ({ ...prev, rate: "" }));
                      }}
                      placeholder="e.g. 2400"
                      className={cn(
                        "w-full h-10 pl-8 pr-3 rounded-xl border text-xs sm:text-[13px] font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs",
                        errors.rate
                          ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          : "border-slate-200 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20",
                      )}
                    />
                  </div>
                  {errors.rate && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.rate}</p>
                  )}
                </div>

                {/* FIELD: CURRENCY (Option Select) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Currency</label>
                  <div className="relative">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-200 bg-white text-xs sm:text-[13px] font-bold text-slate-800 transition-all appearance-none cursor-pointer focus:outline-none focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 shadow-2xs"
                    >
                      {["USD", "EUR", "GBP", "AED", "SAR", "CNY", "PKR", "INR"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <ChevronDown className="size-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 & 5. SHIPPING LINE & VESSEL (2-Column Grid with Option Select Dropdowns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* FIELD: SHIPPING LINE (Option Select with Custom Fallback) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Shipping Line / Carrier
                    </label>
                    {isCustomShippingLine && (
                      <button
                        type="button"
                        onClick={() => setIsCustomShippingLine(false)}
                        className="text-[11px] text-[#0FA3B1] hover:underline font-medium cursor-pointer"
                      >
                        Choose from list
                      </button>
                    )}
                  </div>
                  {isCustomShippingLine ? (
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Building2 className="size-4" />
                      </div>
                      <input
                        type="text"
                        value={shippingLine}
                        onChange={(e) => {
                          setShippingLine(e.target.value);
                          if (errors.shippingLine)
                            setErrors((prev) => ({ ...prev, shippingLine: "" }));
                        }}
                        placeholder="Enter shipping line name"
                        className={cn(
                          "w-full h-10 pl-9 pr-3 rounded-xl border bg-white text-xs sm:text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs",
                          errors.shippingLine
                            ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            : "border-slate-200 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20",
                        )}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Building2 className="size-4" />
                      </div>
                      <select
                        value={shippingLine}
                        onChange={(e) => {
                          if (e.target.value === "__CUSTOM__") {
                            setIsCustomShippingLine(true);
                            setShippingLine("");
                          } else {
                            setShippingLine(e.target.value);
                            if (errors.shippingLine)
                              setErrors((prev) => ({ ...prev, shippingLine: "" }));
                          }
                        }}
                        className={cn(
                          "w-full h-10 pl-9 pr-8 rounded-xl border bg-white text-xs sm:text-[13px] font-medium text-slate-800 transition-all appearance-none cursor-pointer focus:outline-none focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 shadow-2xs",
                          errors.shippingLine
                            ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            : "border-slate-200",
                        )}
                      >
                        <option value="" disabled>
                          Select Shipping Line
                        </option>
                        {shippingLineOptions.map((line) => (
                          <option key={line} value={line}>
                            {line}
                          </option>
                        ))}
                        <option value="__CUSTOM__">+ Other / Enter Custom Shipping Line...</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <ChevronDown className="size-4" />
                      </div>
                    </div>
                  )}
                  {errors.shippingLine && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.shippingLine}</p>
                  )}
                </div>

                {/* FIELD: VESSEL (Option Select with Custom Fallback) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Vessel Name
                    </label>
                    {isCustomVessel && (
                      <button
                        type="button"
                        onClick={() => setIsCustomVessel(false)}
                        className="text-[11px] text-[#0FA3B1] hover:underline font-medium cursor-pointer"
                      >
                        Choose from list
                      </button>
                    )}
                  </div>
                  {isCustomVessel ? (
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Ship className="size-4" />
                      </div>
                      <input
                        type="text"
                        value={vesselName}
                        onChange={(e) => {
                          setVesselName(e.target.value);
                          if (errors.vesselName) setErrors((prev) => ({ ...prev, vesselName: "" }));
                        }}
                        placeholder="Enter vessel name"
                        className={cn(
                          "w-full h-10 pl-9 pr-3 rounded-xl border bg-white text-xs sm:text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs",
                          errors.vesselName
                            ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            : "border-slate-200 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20",
                        )}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Ship className="size-4" />
                      </div>
                      <select
                        value={vesselName}
                        onChange={(e) => {
                          if (e.target.value === "__CUSTOM__") {
                            setIsCustomVessel(true);
                            setVesselName("");
                          } else {
                            setVesselName(e.target.value);
                            if (errors.vesselName)
                              setErrors((prev) => ({ ...prev, vesselName: "" }));
                          }
                        }}
                        className={cn(
                          "w-full h-10 pl-9 pr-8 rounded-xl border bg-white text-xs sm:text-[13px] font-medium text-slate-800 transition-all appearance-none cursor-pointer focus:outline-none focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 shadow-2xs",
                          errors.vesselName
                            ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                            : "border-slate-200",
                        )}
                      >
                        <option value="" disabled>
                          Select Vessel
                        </option>
                        {vesselOptions.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                        <option value="__CUSTOM__">+ Other / Enter Custom Vessel...</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <ChevronDown className="size-4" />
                      </div>
                    </div>
                  )}
                  {errors.vesselName && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.vesselName}</p>
                  )}
                </div>
              </div>

              {/* 6, 7 & 8. ETD, ETA & PICKUP DATE (3-Column Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* ETD */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Departure (ETD)
                  </label>
                  <input
                    type="date"
                    value={etd}
                    onChange={(e) => {
                      setEtd(e.target.value);
                      if (errors.etd) setErrors((prev) => ({ ...prev, etd: "" }));
                    }}
                    className={cn(
                      "w-full h-10 px-3.5 rounded-xl border bg-white text-xs sm:text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs cursor-pointer",
                      errors.etd
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        : "border-slate-200 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20",
                    )}
                  />
                  {errors.etd && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.etd}</p>
                  )}
                </div>

                {/* ETA */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Arrival (ETA)
                  </label>
                  <input
                    type="date"
                    value={eta}
                    onChange={(e) => {
                      setEta(e.target.value);
                      if (errors.eta) setErrors((prev) => ({ ...prev, eta: "" }));
                    }}
                    className={cn(
                      "w-full h-10 px-3.5 rounded-xl border bg-white text-xs sm:text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs cursor-pointer",
                      errors.eta
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        : "border-slate-200 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20",
                    )}
                  />
                  {errors.eta && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.eta}</p>
                  )}
                </div>

                {/* FIELD: PICKUP DATE */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Pickup Date</label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => {
                      setPickupDate(e.target.value);
                      if (errors.pickupDate) setErrors((prev) => ({ ...prev, pickupDate: "" }));
                    }}
                    className={cn(
                      "w-full h-10 px-3.5 rounded-xl border bg-white text-xs sm:text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs cursor-pointer",
                      errors.pickupDate
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        : "border-slate-200 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20",
                    )}
                  />
                  {errors.pickupDate && (
                    <p className="text-[11px] text-rose-500 font-medium">{errors.pickupDate}</p>
                  )}
                </div>
              </div>

              {/* 9 & 10. PICKUP ADDRESS & CARGO DETAILS (2-Column Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* FIELD: PICKUP ADDRESS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Pickup Address / Facility
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <MapPin className="size-4" />
                    </div>
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="e.g. Warehouse 4, Felixstowe Port"
                      className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-slate-200 text-xs sm:text-[13px] text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* FIELD: CARGO DETAILS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Cargo Details & Special Instructions
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                      <FileText className="size-4" />
                    </div>
                    <textarea
                      rows={2}
                      value={cargoDetails}
                      onChange={(e) => setCargoDetails(e.target.value)}
                      placeholder="e.g. 500 cartons commercial goods, palletized, keep dry..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-[13px] text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 transition-all shadow-2xs resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* 11. EMAIL CHECKBOX */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendConfirmationEmail}
                    onChange={(e) => setSendConfirmationEmail(e.target.checked)}
                    className="mt-0.5 size-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="text-left">
                    <span className="text-[13px] font-semibold text-slate-800 block">
                      Send confirmation email to forwarder
                    </span>
                    <span className="text-[11.5px] text-slate-400 block mt-0.5">
                      Transmits an official booking confirmation email via Gmail integration.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Bottom Buttons: Cancel & Confirm Booking (Clean & Flush) */}
            <div className="px-6 py-4 sm:px-8 sm:py-4.5 border-t border-slate-100/90 flex items-center justify-end gap-3 bg-white shrink-0">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 px-7 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-sm font-semibold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-white" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <span>Confirm Booking</span>
                )}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
});
