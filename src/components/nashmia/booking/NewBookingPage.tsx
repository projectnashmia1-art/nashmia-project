import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BUYERS,
  SUPPLIERS,
  PORTS_OF_LOADING,
  PORTS_OF_DISCHARGE,
  SHIPPING_LINES,
  BOOKING_AGENTS,
  findAgreedRate,
  type BuyerAccount,
  type SupplierVendor,
  type Port,
  type ShippingLine,
  type BookingAgent,
  type ContainerSize,
  type FreightRateMode,
} from "@/lib/booking-data";
import { BookingHeader } from "./BookingHeader";
import { BookingProgress } from "./BookingProgress";
import { BookingPartiesSection } from "./BookingPartiesSection";
import { RouteSection } from "./RouteSection";
import { ShippingSection } from "./ShippingSection";
import { ContainerCargoSection } from "./ContainerCargoSection";
import { SpecialInstructionsSection } from "./SpecialInstructionsSection";
import { BookingSummaryCard } from "./BookingSummaryCard";
import { BookingEmailPreviewModal } from "./BookingEmailPreviewModal";
import { ArrowRight, BookmarkCheck, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  createBookingInSupabase,
  insertBuyerToSupabase,
  insertSupplierToSupabase,
} from "@/lib/supabase-services";
import {
  useCachedBuyers,
  useCachedSuppliers,
  useCachedForwarders,
  invalidateCachedBuyers,
  invalidateCachedSuppliers,
  invalidateCachedForwarders,
  entityCacheKeys,
} from "@/lib/cache";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { BuyerAccountFull } from "@/lib/buyers-data";
import { useRealRateCards } from "@/services/data-fetching.service";
import { SupplierAccountFull } from "@/lib/suppliers-data";
import { ForwarderAccount } from "@/lib/forwarders-data";
import { generateMovementNumber } from "@/lib/movement-lifecycle";
import { toast } from "sonner";

export function NewBookingPage({
  onBackToDashboard,
  onOpenMobileMenu,
}: {
  onBackToDashboard?: () => void;
  onOpenMobileMenu?: () => void;
}) {
  const { userId, isConfigured } = useAuth();

  // Dynamic party options from Supabase
  const [dynamicBuyers, setDynamicBuyers] = useState<BuyerAccount[]>([]);
  const [dynamicSuppliers, setDynamicSuppliers] = useState<SupplierVendor[]>([]);
  const [dynamicAgents, setDynamicAgents] = useState<BookingAgent[]>([]);

  // Form State initialized with stable default for SSR hydration consistency
  const [reference, setReference] = useState<string>("MOV-2026-00001");

  useEffect(() => {
    // Generate unique movement number after initial client mount to eliminate hydration mismatch
    setReference(generateMovementNumber());
  }, []);
  const [buyer, setBuyer] = useState<BuyerAccount | null>(null);
  const [supplier, setSupplier] = useState<SupplierVendor | null>(null);
  const [pol, setPol] = useState<Port | null>(PORTS_OF_LOADING[0] || null); // Felixstowe (FXT)
  const [pod, setPod] = useState<Port | null>(PORTS_OF_DISCHARGE[0] || null); // Karachi (KHI)
  const [shippingLine, setShippingLine] = useState<ShippingLine | null>(SHIPPING_LINES[0] || null); // MSC
  const [bookingAgent, setBookingAgent] = useState<BookingAgent | null>(null);
  const [selectedBookingAgents, setSelectedBookingAgents] = useState<BookingAgent[]>([]);
  const [containerSize, setContainerSize] = useState<ContainerSize>("40HC");
  const [quantity, setQuantity] = useState<number>(1);
  const [productDescription, setProductDescription] = useState<string>("");
  const [loadingDate, setLoadingDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [instructions, setInstructions] = useState<string>("");

  // Freight Rate Mode & Custom Rate state
  const [rateMode, setRateMode] = useState<FreightRateMode>("AGREED_RATE");
  const [customRate, setCustomRate] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("USD");

  const queryClient = useQueryClient();

  // Cached parties with automatic deduplication, page navigation reuse & background revalidation
  const { data: bList = [] } = useCachedBuyers(userId, { enabled: isConfigured });
  const { data: sList = [] } = useCachedSuppliers(userId, { enabled: isConfigured });
  const { data: fList = [] } = useCachedForwarders(userId, { enabled: isConfigured });

  // Map cached buyers to booking party format
  useEffect(() => {
    if (bList.length > 0) {
      const mappedB: BuyerAccount[] = bList.map((b) => ({
        id: b.id,
        name: b.name,
        country: b.country,
        consignee: b.company || b.name,
        code: b.code || `${b.name.slice(0, 3).toUpperCase()}`,
        badge: b.company ? "Consignee" : "Direct Buyer",
        status: b.status,
        destinationPort: b.preferredPort || b.destinationPort,
        activeMovements: b.activeMovements,
        creditTerm: "30 Days NET",
      }));
      setDynamicBuyers(mappedB);
    }
  }, [bList]);

  // Map cached suppliers to booking party format
  useEffect(() => {
    if (sList.length > 0) {
      const mappedS: SupplierVendor[] = sList.map((s) => ({
        id: s.id,
        name: s.name,
        country: s.country,
        city: s.city || "London",
        address: s.address || "Warehouse Bay",
        loadPoint: s.loadPoint || `${s.city || "London"} Warehouse`,
        contact: s.contactPerson,
        email: s.email,
        status: s.status,
      }));
      setDynamicSuppliers(mappedS);
    }
  }, [sList]);

  // Map cached forwarders to booking agent format
  useEffect(() => {
    if (fList.length > 0) {
      const mappedF: BookingAgent[] = fList.map((f) => ({
        id: f.id,
        name: f.name,
        code: f.code || `${f.name.slice(0, 3).toUpperCase()}-FWD`,
        contact: f.contactPerson,
        email: f.email,
        phone: f.whatsapp,
        contractTier: f.badge || "Tier 1 Priority",
        activeRates: f.rateCards ? f.rateCards.length : 0,
        slaHours: 4,
        supportedLines: f.shippingLines || ["MSC", "Maersk"],
      }));
      setDynamicAgents(mappedF);
    } else {
      setDynamicAgents([]);
    }
  }, [fList]);

  useEffect(() => {
    setReference(`NASH-BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

  // Realtime Supabase Sync for Buyers, Suppliers, Forwarders: invalidates query cache for background refresh
  useSupabaseRealtime(
    "buyers",
    useCallback(() => {
      void invalidateCachedBuyers(queryClient, userId);
    }, [queryClient, userId]),
    isConfigured,
  );
  useSupabaseRealtime(
    "suppliers",
    useCallback(() => {
      void invalidateCachedSuppliers(queryClient, userId);
    }, [queryClient, userId]),
    isConfigured,
  );
  useSupabaseRealtime(
    "forwarders",
    useCallback(() => {
      void invalidateCachedForwarders(queryClient, userId);
    }, [queryClient, userId]),
    isConfigured,
  );

  // Listen to instantaneous window event from Buyer Directory page
  useEffect(() => {
    const handleBuyerCreated = (e: Event) => {
      const customEvent = e as CustomEvent<BuyerAccountFull>;
      const created = customEvent.detail;
      if (!created) return;
      const mapped: BuyerAccount = {
        id: created.id,
        name: created.name,
        country: created.country,
        consignee: created.company || created.name,
        code: created.code || `${created.name.slice(0, 3).toUpperCase()}`,
        badge: "Consignee",
        status: created.status || "Active",
        destinationPort: created.preferredPort || "Karachi (KHI)",
        activeMovements: created.activeMovements || 0,
        creditTerm: "30 Days NET",
      };
      setDynamicBuyers((prev) => {
        const filtered = prev.filter(
          (b) => b.id !== mapped.id && b.name.toLowerCase() !== mapped.name.toLowerCase(),
        );
        return [mapped, ...filtered];
      });
      setBuyer(mapped);
    };

    window.addEventListener("nashmia-buyer-created", handleBuyerCreated);
    return () => window.removeEventListener("nashmia-buyer-created", handleBuyerCreated);
  }, []);

  // Listen to instantaneous window event from Supplier Directory page
  useEffect(() => {
    const handleSupplierCreated = (e: Event) => {
      const customEvent = e as CustomEvent<SupplierAccountFull>;
      const created = customEvent.detail;
      if (!created) return;
      const mapped: SupplierVendor = {
        id: created.id,
        name: created.name,
        country: created.country,
        city: created.city || "London",
        address: created.address || "Warehouse Bay",
        loadPoint: created.loadPoint || `${created.city || "London"} Warehouse`,
        contact: created.contactPerson,
        email: created.email,
        status: created.status || "Active",
      };
      setDynamicSuppliers((prev) => {
        const filtered = prev.filter(
          (s) => s.id !== mapped.id && s.name.toLowerCase() !== mapped.name.toLowerCase(),
        );
        return [mapped, ...filtered];
      });
      setSupplier(mapped);
    };

    window.addEventListener("nashmia-supplier-created", handleSupplierCreated);
    return () => window.removeEventListener("nashmia-supplier-created", handleSupplierCreated);
  }, []);

  // Listen to instantaneous window event from Forwarder Directory page
  useEffect(() => {
    const handleForwarderCreated = (e: Event) => {
      const customEvent = e as CustomEvent<ForwarderAccount>;
      const created = customEvent.detail;
      if (!created) return;
      const mapped: BookingAgent = {
        id: created.id,
        name: created.name,
        code: created.code || `${created.name.slice(0, 3).toUpperCase()}-FWD`,
        contact: created.contactPerson,
        email: created.email,
        phone: created.whatsapp,
        contractTier: created.badge || "Tier 1 Priority",
        activeRates: created.rateCards ? created.rateCards.length : 0,
        slaHours: 4,
        supportedLines: created.shippingLines || ["MSC", "Maersk"],
      };
      setDynamicAgents((prev) => {
        const filtered = prev.filter(
          (a) => a.id !== mapped.id && a.name.toLowerCase() !== mapped.name.toLowerCase(),
        );
        return [mapped, ...filtered];
      });
      setBookingAgent(mapped);
    };

    window.addEventListener("nashmia-forwarder-created", handleForwarderCreated);
    return () => window.removeEventListener("nashmia-forwarder-created", handleForwarderCreated);
  }, []);

  // Quick Add Buyer handler for Booking Part
  const handleQuickCreateBuyer = async (
    buyerData: Omit<BuyerAccountFull, "id" | "createdAt">,
  ): Promise<BuyerAccount> => {
    let createdAcc: BuyerAccount;
    const tempId = `buyer-${Date.now()}`;
    const fallbackBuyerFull: BuyerAccountFull = {
      ...buyerData,
      id: tempId,
      createdAt: new Date().toISOString(),
    };
    const fallbackBuyerAcc: BuyerAccount = {
      id: tempId,
      name: buyerData.name,
      country: buyerData.country,
      consignee: buyerData.company,
      code: buyerData.code,
      badge: "Consignee",
      status: "Active",
      destinationPort: buyerData.preferredPort,
      activeMovements: 0,
      creditTerm: "30 Days NET",
    };

    if (isConfigured) {
      try {
        const created = await insertBuyerToSupabase(userId || null, buyerData);
        createdAcc = {
          id: created.id,
          name: created.name,
          country: created.country,
          consignee: created.company,
          code: created.code,
          badge: "Consignee",
          status: created.status,
          destinationPort: created.preferredPort,
          activeMovements: 0,
          creditTerm: "30 Days NET",
        };
        try {
          window.dispatchEvent(new CustomEvent("nashmia-buyer-created", { detail: created }));
        } catch (e) {
          console.error("Event dispatch error:", e);
        }
      } catch (err) {
        console.warn("[NewBookingPage] Supabase buyer creation fallback:", err);
        createdAcc = fallbackBuyerAcc;
        try {
          window.dispatchEvent(
            new CustomEvent("nashmia-buyer-created", { detail: fallbackBuyerFull }),
          );
        } catch (e) {
          console.error("Event dispatch error:", e);
        }
      }
    } else {
      createdAcc = fallbackBuyerAcc;
      try {
        window.dispatchEvent(
          new CustomEvent("nashmia-buyer-created", { detail: fallbackBuyerFull }),
        );
      } catch (e) {
        console.error("Event dispatch error:", e);
      }
    }

    setDynamicBuyers((prev) => [createdAcc, ...prev.filter((b) => b.id !== createdAcc.id)]);
    setBuyer(createdAcc);
    return createdAcc;
  };

  // Quick Add Supplier handler for Booking Part
  const handleQuickCreateSupplier = async (
    supplierData: Omit<SupplierAccountFull, "id" | "createdAt">,
  ): Promise<SupplierVendor> => {
    let createdSup: SupplierVendor;
    const tempId = `sup-${Date.now()}`;
    const fallbackSupplierFull: SupplierAccountFull = {
      ...supplierData,
      id: tempId,
      createdAt: new Date().toISOString(),
    };
    const fallbackSupplierVendor: SupplierVendor = {
      id: tempId,
      name: supplierData.name,
      country: supplierData.country,
      city: supplierData.city,
      address: supplierData.address,
      loadPoint: supplierData.loadPoint,
      contact: supplierData.contactPerson,
      email: supplierData.email,
      status: "Active",
    };

    if (isConfigured) {
      try {
        const created = await insertSupplierToSupabase(userId || null, supplierData);
        createdSup = {
          id: created.id,
          name: created.name,
          country: created.country,
          city: created.city,
          address: created.address,
          loadPoint: created.loadPoint,
          contact: created.contactPerson,
          email: created.email,
          status: created.status,
        };
        try {
          window.dispatchEvent(new CustomEvent("nashmia-supplier-created", { detail: created }));
        } catch (e) {
          console.error("Event dispatch error:", e);
        }
      } catch (err) {
        console.warn("[NewBookingPage] Supabase supplier creation fallback:", err);
        createdSup = fallbackSupplierVendor;
        try {
          window.dispatchEvent(
            new CustomEvent("nashmia-supplier-created", { detail: fallbackSupplierFull }),
          );
        } catch (e) {
          console.error("Event dispatch error:", e);
        }
      }
    } else {
      createdSup = fallbackSupplierVendor;
      try {
        window.dispatchEvent(
          new CustomEvent("nashmia-supplier-created", { detail: fallbackSupplierFull }),
        );
      } catch (e) {
        console.error("Event dispatch error:", e);
      }
    }

    setDynamicSuppliers((prev) => [createdSup, ...prev.filter((s) => s.id !== createdSup.id)]);
    setSupplier(createdSup);
    return createdSup;
  };

  // Query real rate cards from Supabase
  const { data: realRateCards = [] } = useRealRateCards(userId);

  // Auto-populate supplier / buyer / rate if passed in URL query
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const supId = params.get("supplierId");
      const bId = params.get("buyerId");
      const agentId = params.get("bookingAgentId") || params.get("fwd");
      const urlSize = params.get("size");

      if (supId) {
        const foundSup = dynamicSuppliers.find((s) => s.id === supId);
        if (foundSup) {
          setSupplier(foundSup);
        }
      }

      if (bId) {
        const foundBuyer = dynamicBuyers.find((b) => b.id === bId);
        if (foundBuyer) {
          setBuyer(foundBuyer);
        }
      }

      if (agentId) {
        const foundAgent = dynamicAgents.find((a) => a.id === agentId);
        if (foundAgent) {
          setBookingAgent(foundAgent);
          setSelectedBookingAgents([foundAgent]);
        }
      }

      if (urlSize && (urlSize === "20FT" || urlSize === "40FT" || urlSize === "40HC")) {
        setContainerSize(urlSize as ContainerSize);
      }
    } catch {
      // safe fallback
    }
  }, [dynamicBuyers, dynamicSuppliers, dynamicAgents]);

  // Step state
  const [currentStep, setCurrentStep] = useState(0);

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftSavedToast, setDraftSavedToast] = useState(false);

  // Submission Modal state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Matched rate card calculation from real Supabase records
  const matchedRate = useMemo(() => {
    const activeAgentId = selectedBookingAgents[0]?.id || bookingAgent?.id;
    if (!activeAgentId) return null;

    // 1. Check real Supabase rate cards for this forwarder
    const dbMatch =
      realRateCards.find((rc) => {
        if (rc.status === "Inactive") return false;
        const isAgentMatch = rc.forwarder_id === activeAgentId;
        if (!isAgentMatch) return false;

        const pickupLocation = supplier?.loadPoint || supplier?.city || "";
        const pickupMatch =
          !pickupLocation && !pol
            ? true
            : (pickupLocation &&
                rc.load_point &&
                rc.load_point.toLowerCase().includes(pickupLocation.toLowerCase())) ||
              (pickupLocation &&
                rc.origin &&
                rc.origin.toLowerCase().includes(pickupLocation.toLowerCase())) ||
              (pol && rc.pol_code && rc.pol_code.toLowerCase() === pol.code.toLowerCase()) ||
              (pol && rc.origin && rc.origin.toLowerCase().includes(pol.name.toLowerCase()));

        return isAgentMatch && pickupMatch;
      }) ||
      realRateCards.find((rc) => rc.status !== "Inactive" && rc.forwarder_id === activeAgentId);

    if (dbMatch) {
      return {
        agentId: dbMatch.forwarder_id,
        agentName:
          dbMatch.forwarders?.company_name ||
          dbMatch.forwarders?.contact_person ||
          bookingAgent?.name ||
          "Forwarder",
        polCode: dbMatch.pol_code || pol?.code || dbMatch.origin || "Pickup Point",
        podCode: dbMatch.pod_code || pod?.code || dbMatch.destination || "Destination",
        size: (dbMatch.container_size as ContainerSize) || containerSize,
        ratePerContainer: dbMatch.base_rate || dbMatch.rate || 0,
        currency: dbMatch.currency || "USD",
        validUntil: dbMatch.valid_until,
        cardName: dbMatch.card_name || `${dbMatch.origin} (${dbMatch.load_point || "Pickup"})`,
      };
    }

    // 2. Fallback
    if (bookingAgent && pol && pod && containerSize) {
      return findAgreedRate(bookingAgent.id, pol.code, pod.code, containerSize);
    }
    return null;
  }, [realRateCards, selectedBookingAgents, bookingAgent, pol, pod, containerSize, supplier]);

  // Handle Step selection / smooth scroll
  const handleSelectStep = (index: number) => {
    setCurrentStep(index);
    const sectionIds = [
      "section-parties",
      "section-route",
      "section-cargo",
      "section-instructions",
    ];
    const target = document.getElementById(sectionIds[index]);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!buyer) errs.buyer = "Buyer account is required";
    if (!supplier) errs.supplier = "Pickup supplier is required";
    if (!pol) errs.pol = "Port of loading is required";
    if (!pod) errs.pod = "Port of discharge is required";
    if (selectedBookingAgents.length === 0 && !bookingAgent) {
      errs.bookingAgent = "At least one booking agent / forwarder is required";
    }
    const cleanDesc = productDescription.trim() || "Commercial Freight Cargo";
    if (!productDescription.trim()) {
      setProductDescription(cleanDesc);
    }
    if (!loadingDate) errs.loadingDate = "Loading date is required";

    setErrors(errs);

    const errorKeys = Object.keys(errs);
    if (errorKeys.length > 0) {
      const firstErrorKey = errorKeys[0];
      const sectionMap: Record<string, string> = {
        buyer: "section-parties",
        supplier: "section-parties",
        pol: "section-route",
        pod: "section-route",
        bookingAgent: "section-shipping",
        productDescription: "section-cargo",
        loadingDate: "section-cargo",
      };
      if (firstErrorKey && sectionMap[firstErrorKey]) {
        document
          .getElementById(sectionMap[firstErrorKey])
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast.error("Please fill required field", {
        description: errs[firstErrorKey],
      });
      return false;
    }

    return true;
  };

  // Create Booking Action -> Opens the Apple Liquid Glass Email Preview Modal
  const handleCreateBooking = () => {
    if (!validateForm()) {
      return;
    }

    setModalOpen(true);
  };

  // Save as Draft Action
  const handleSaveDraft = async () => {
    try {
      const effectiveRate =
        customRate !== null && customRate !== undefined
          ? customRate
          : matchedRate
            ? matchedRate.ratePerContainer
            : null;

      const draftBooking = await createBookingInSupabase(userId, {
        reference,
        bookingReference: reference,
        movementNumber: reference,
        buyerId: buyer?.id,
        buyerName: buyer?.name,
        buyerCountry: buyer?.country,
        supplierId: supplier?.id,
        supplierName: supplier?.name,
        supplierCity: supplier?.city,
        forwarderId:
          rateMode === "AGREED_RATE" && selectedBookingAgents.length === 1
            ? selectedBookingAgents[0]?.id || bookingAgent?.id
            : undefined,
        forwarderName:
          rateMode === "AGREED_RATE" && selectedBookingAgents.length === 1
            ? selectedBookingAgents[0]?.name || bookingAgent?.name
            : "Pending Award",
        shippingLineId: shippingLine?.id,
        shippingLineName: shippingLine?.name,
        origin: pol?.name || "Felixstowe (FXT)",
        destination: pod?.name || "Karachi (KHI)",
        containerSize,
        containerCount: quantity,
        loadingDate,
        productDescription,
        specialInstructions: instructions,
        rateMode,
        freightRateMode: rateMode,
        customRate: rateMode === "ASKING_RATE" ? null : effectiveRate,
        totalFreight:
          rateMode === "ASKING_RATE"
            ? null
            : effectiveRate !== null
              ? effectiveRate * quantity
              : null,
        currency: currency || "USD",
        status: "Draft",
      });

      queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nashmia_booking_created", {
            detail: {
              booking: draftBooking,
              id: draftBooking.id,
              movementNumber: draftBooking.movement_number,
              bookingReference: draftBooking.booking_reference,
              reference: draftBooking.booking_reference,
              status: "Draft",
              rateMode,
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("nashmia_movement_created", {
            detail: {
              booking: draftBooking,
              id: draftBooking.id,
              movementNumber: draftBooking.movement_number,
              bookingReference: draftBooking.booking_reference,
              reference: draftBooking.booking_reference,
              status: "Draft",
              rateMode,
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("nashmia_bookings_updated", {
            detail: {
              updated: true,
              id: draftBooking.id,
              movementNumber: draftBooking.movement_number,
              bookingReference: draftBooking.booking_reference,
            },
          }),
        );
      }
    } catch (e) {
      console.warn("Draft persistence notice:", e);
    }

    setDraftSavedToast(true);
    toast.success("Draft Saved", {
      description: `Movement reference ${reference} draft has been preserved.`,
    });
    setTimeout(() => setDraftSavedToast(false), 3500);
  };

  const handleBookingSuccess = (result?: { movementNumber?: string; reference?: string }) => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["movements"] });
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] });

    const movRef = result?.movementNumber || result?.reference || reference;
    toast.success("Booking Created Successfully!", {
      description: `Movement ${movRef} has been recorded into the live database.`,
      duration: 5000,
    });
    setModalOpen(false);
    onBackToDashboard?.();
  };

  return (
    <div className="w-full min-w-0 max-w-full pb-16 text-black space-y-6">
      {/* TOP HEADER */}
      <BookingHeader
        onBack={onBackToDashboard}
        onOpenMobileMenu={onOpenMobileMenu}
        isSaved={!isSubmitting}
      />

      {/* ELEGANT PROGRESS INDICATOR */}
      <div className="mt-4 sm:mt-6">
        <BookingProgress currentStep={currentStep} onSelectStep={handleSelectStep} />
      </div>

      {/* 70% FORM + 30% STICKY SUMMARY LAYOUT */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* LEFT 70% — BOOKING FORM (col-span-8) */}
        <div className="space-y-8 lg:col-span-8">
          {/* SECTION 1: BOOKING PARTIES */}
          <BookingPartiesSection
            selectedBuyer={buyer}
            onSelectBuyer={(b) => {
              setBuyer(b);
              setErrors((prev) => ({ ...prev, buyer: "" }));
            }}
            selectedSupplier={supplier}
            onSelectSupplier={(s) => {
              setSupplier(s);
              setErrors((prev) => ({ ...prev, supplier: "" }));
            }}
            availableBuyers={dynamicBuyers}
            availableSuppliers={dynamicSuppliers}
            onQuickCreateBuyer={handleQuickCreateBuyer}
            onQuickCreateSupplier={handleQuickCreateSupplier}
            errors={errors}
          />

          {/* SECTION 2: ROUTE */}
          <RouteSection
            pol={pol}
            onSelectPol={(p) => {
              setPol(p);
              setErrors((prev) => ({ ...prev, pol: "" }));
            }}
            pod={pod}
            onSelectPod={(p) => {
              setPod(p);
              setErrors((prev) => ({ ...prev, pod: "" }));
            }}
            errors={errors}
          />

          {/* SECTION 3: SHIPPING & AGREED RATE */}
          <ShippingSection
            shippingLine={shippingLine}
            onSelectShippingLine={(sl) => {
              setShippingLine(sl);
              setErrors((prev) => ({ ...prev, shippingLine: "" }));
            }}
            bookingAgent={bookingAgent}
            onSelectBookingAgent={(ba) => {
              setBookingAgent(ba);
              setErrors((prev) => ({ ...prev, bookingAgent: "" }));
            }}
            selectedBookingAgents={selectedBookingAgents}
            onSelectBookingAgents={(agents) => {
              setSelectedBookingAgents(agents);
              if (agents.length > 0) {
                setBookingAgent(agents[0]);
                setErrors((prev) => ({ ...prev, bookingAgent: "" }));
              } else {
                setBookingAgent(null);
              }
            }}
            pol={pol}
            pod={pod}
            containerSize={containerSize}
            quantity={quantity}
            matchedRate={matchedRate}
            rateMode={rateMode}
            onChangeRateMode={setRateMode}
            customRate={customRate}
            onChangeCustomRate={setCustomRate}
            currency={currency}
            onChangeCurrency={setCurrency}
            availableBookingAgents={dynamicAgents}
            availableRateCards={realRateCards}
            errors={errors}
          />

          {/* SECTION 4: CONTAINER & CARGO */}
          <ContainerCargoSection
            containerSize={containerSize}
            onSelectSize={setContainerSize}
            onSelectContainerSize={setContainerSize}
            quantity={quantity}
            onChangeQuantity={setQuantity}
            productDescription={productDescription}
            onChangeProductDescription={(val) => {
              setProductDescription(val);
              setErrors((prev) => ({ ...prev, productDescription: "" }));
            }}
            loadingDate={loadingDate}
            onChangeLoadingDate={(val) => {
              setLoadingDate(val);
              setErrors((prev) => ({ ...prev, loadingDate: "" }));
            }}
            errors={errors}
          />

          {/* SECTION 5: SPECIAL INSTRUCTIONS */}
          <SpecialInstructionsSection
            instructions={instructions}
            onChangeInstructions={setInstructions}
          />

          {/* BOTTOM ACTIONS BAR FOR MOBILE / TABLET */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between lg:hidden">
            <div>
              <span className="text-xs text-slate-500">
                {rateMode === "ASKING_RATE" ? "Rate Status" : "Estimated Total"}
              </span>
              <p className="text-lg font-black text-black">
                {rateMode === "ASKING_RATE" ? (
                  <span className="text-sm font-semibold text-[#6A80A9]">Quotation Requested</span>
                ) : (
                  <>
                    $
                    {(customRate !== null && customRate !== undefined
                      ? customRate
                      : matchedRate
                        ? matchedRate.ratePerContainer
                        : 0) *
                      quantity >
                    0
                      ? (
                          (customRate !== null && customRate !== undefined
                            ? customRate
                            : matchedRate?.ratePerContainer || 0) * quantity
                        ).toLocaleString()
                      : "—"}{" "}
                    <span className="text-xs font-normal text-slate-500">{currency}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <BookmarkCheck className="size-4" />
                <span>Draft</span>
              </button>
              <button
                type="button"
                onClick={handleCreateBooking}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-6 text-xs font-semibold text-white shadow-md hover:bg-slate-800"
              >
                <span>Submit</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT 30% — STICKY SUMMARY CARD (col-span-4) */}
        <div className="lg:col-span-4">
          <div className="sticky top-6">
            <BookingSummaryCard
              reference={reference}
              buyer={buyer}
              supplier={supplier}
              pol={pol}
              pod={pod}
              shippingLine={shippingLine}
              bookingAgent={bookingAgent}
              selectedBookingAgents={selectedBookingAgents}
              containerSize={containerSize}
              quantity={quantity}
              loadingDate={loadingDate}
              matchedRate={matchedRate}
              rateMode={rateMode}
              customRate={customRate}
              currency={currency}
              onSubmit={handleCreateBooking}
              onSaveDraft={handleSaveDraft}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* DRAFT SAVED TOAST */}
      {draftSavedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-in slide-in-from-bottom-5">
          <Check className="size-4 text-emerald-400" />
          <span>Draft booking state preserved locally.</span>
        </div>
      )}

      {/* APPLE LIQUID GLASS EMAIL PREVIEW & DISPATCH MODAL */}
      <BookingEmailPreviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        reference={reference}
        buyer={buyer}
        supplier={supplier}
        pol={pol}
        pod={pod}
        shippingLine={shippingLine}
        bookingAgent={bookingAgent}
        selectedBookingAgents={selectedBookingAgents}
        containerSize={containerSize}
        quantity={quantity}
        loadingDate={loadingDate}
        productDescription={productDescription}
        instructions={instructions}
        matchedRate={matchedRate}
        rateMode={rateMode}
        customRate={customRate}
        currency={currency}
        onSuccess={handleBookingSuccess}
        onSaveDraft={handleSaveDraft}
        onViewMovement={() => {
          setModalOpen(false);
          onBackToDashboard?.();
        }}
      />
    </div>
  );
}
