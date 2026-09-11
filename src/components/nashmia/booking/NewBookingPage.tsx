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
import {
  createBookingInSupabase,
  fetchBuyersFromSupabase,
  fetchSuppliersFromSupabase,
  fetchForwardersFromSupabase,
  insertBuyerToSupabase,
  insertSupplierToSupabase,
} from "@/lib/supabase-services";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { BuyerAccountFull } from "@/lib/buyers-data";
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
  const [dynamicBuyers, setDynamicBuyers] = useState<BuyerAccount[]>(BUYERS);
  const [dynamicSuppliers, setDynamicSuppliers] = useState<SupplierVendor[]>(SUPPLIERS);
  const [dynamicAgents, setDynamicAgents] = useState<BookingAgent[]>(BOOKING_AGENTS);

  // Form State initialized with realistic Nashmia defaults
  const [reference, setReference] = useState<string>(() => generateMovementNumber());
  const [buyer, setBuyer] = useState<BuyerAccount | null>(BUYERS[0]); // New Henna
  const [supplier, setSupplier] = useState<SupplierVendor | null>(SUPPLIERS[0]); // UK Supplier -> London Warehouse
  const [pol, setPol] = useState<Port | null>(PORTS_OF_LOADING[0]); // Felixstowe (FXT)
  const [pod, setPod] = useState<Port | null>(PORTS_OF_DISCHARGE[0]); // Karachi (KHI)
  const [shippingLine, setShippingLine] = useState<ShippingLine | null>(SHIPPING_LINES[0]); // MSC
  const [bookingAgent, setBookingAgent] = useState<BookingAgent | null>(BOOKING_AGENTS[0]); // ABC Forwarding
  const [selectedBookingAgents, setSelectedBookingAgents] = useState<BookingAgent[]>([
    BOOKING_AGENTS[0],
  ]);
  const [containerSize, setContainerSize] = useState<ContainerSize>("40HC");
  const [quantity, setQuantity] = useState<number>(2);
  const [productDescription, setProductDescription] = useState<string>("Used clothing & textiles");
  const [loadingDate, setLoadingDate] = useState<string>("2026-08-18");
  const [instructions, setInstructions] = useState<string>(
    "Please confirm availability before vessel cut-off.",
  );

  // Load parties from Supabase
  const loadParties = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const [bList, sList, fList] = await Promise.all([
        fetchBuyersFromSupabase(userId),
        fetchSuppliersFromSupabase(userId),
        fetchForwardersFromSupabase(userId),
      ]);

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
      } else {
        setDynamicBuyers([]);
      }

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
      } else {
        setDynamicSuppliers([]);
      }

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
        setDynamicAgents(BOOKING_AGENTS);
      }
    } catch (err) {
      console.warn("[NewBookingPage] Could not load dynamic parties:", err);
    }
  }, [userId, isConfigured]);

  useEffect(() => {
    setReference(`NASH-BK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    void loadParties();
  }, [loadParties]);

  // Realtime Supabase Sync for Buyers, Suppliers, Forwarders
  useSupabaseRealtime(
    "buyers",
    useCallback(() => {
      void loadParties();
    }, [loadParties]),
    isConfigured,
  );
  useSupabaseRealtime(
    "suppliers",
    useCallback(() => {
      void loadParties();
    }, [loadParties]),
    isConfigured,
  );
  useSupabaseRealtime(
    "forwarders",
    useCallback(() => {
      void loadParties();
    }, [loadParties]),
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

  // Auto-populate supplier / buyer if passed in URL query
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const supId = params.get("supplierId");
      const bId = params.get("buyerId");
      const agentId = params.get("bookingAgentId");

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
        }
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

  // Matched rate card calculation
  const matchedRate = useMemo(() => {
    if (!bookingAgent || !pol || !pod || !containerSize) return null;
    return findAgreedRate(bookingAgent.id, pol.code, pod.code, containerSize);
  }, [bookingAgent, pol, pod, containerSize]);

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
    if (!shippingLine) errs.shippingLine = "Shipping line is required";
    if (selectedBookingAgents.length === 0 && !bookingAgent) {
      errs.bookingAgent = "At least one booking agent / forwarder is required";
    }
    if (!productDescription.trim()) errs.productDescription = "Cargo description is required";
    if (!loadingDate) errs.loadingDate = "Loading date is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Create Booking Action -> Opens the Apple Liquid Glass Email Preview Modal
  const handleCreateBooking = () => {
    if (!validateForm()) {
      // scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      const sectionMap: Record<string, string> = {
        buyer: "section-parties",
        supplier: "section-parties",
        pol: "section-route",
        pod: "section-route",
        shippingLine: "section-shipping",
        bookingAgent: "section-shipping",
        productDescription: "section-cargo",
        loadingDate: "section-cargo",
      };
      if (firstErrorKey && sectionMap[firstErrorKey]) {
        document
          .getElementById(sectionMap[firstErrorKey])
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // DO NOT immediately create or send the booking.
    // Instead open the Apple Liquid Glass email-preview modal.
    setModalOpen(true);
  };

  // Save as Draft Action
  const handleSaveDraft = () => {
    setDraftSavedToast(true);
    toast.success("Draft Saved", {
      description: `Movement reference ${reference} draft has been preserved.`,
    });
    setTimeout(() => setDraftSavedToast(false), 3500);
  };

  const handleBookingSuccess = () => {
    // Generate new fresh Movement Number for the next booking
    setReference(generateMovementNumber());
  };

  return (
    <div className="relative min-h-screen bg-white pb-24 text-black">
      {/* Subtle atmospheric background gradient */}
      <div className="env-light" aria-hidden />

      {/* Main Content Area */}
      <div className="mx-auto max-w-[1520px] px-4 pt-6 sm:px-6 lg:px-8">
        {/* TOP HEADER */}
        <BookingHeader
          onBack={onBackToDashboard}
          onOpenMobileMenu={onOpenMobileMenu}
          isSaved={!isSubmitting}
        />

        {/* ELEGANT PROGRESS INDICATOR */}
        <div className="mt-6">
          <BookingProgress currentStep={currentStep} onSelectStep={handleSelectStep} />
        </div>

        {/* 70% FORM + 30% STICKY SUMMARY LAYOUT */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
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
              matchedRate={matchedRate}
              availableBookingAgents={dynamicAgents}
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
                <span className="text-xs text-slate-500">Estimated Total</span>
                <p className="text-lg font-black text-black">
                  ${matchedRate ? (matchedRate.ratePerContainer * quantity).toLocaleString() : "—"}{" "}
                  <span className="text-xs font-normal text-slate-500">USD</span>
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
                onSubmit={handleCreateBooking}
                onSaveDraft={handleSaveDraft}
                isSubmitting={isSubmitting}
              />
            </div>
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
