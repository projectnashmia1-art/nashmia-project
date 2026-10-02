import { useState, useRef, useEffect } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Globe,
  Info,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Truck,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { type BuyerAccount, type SupplierVendor } from "@/lib/booking-data";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BuyerAccountFull } from "@/lib/buyers-data";
import { SupplierAccountFull } from "@/lib/suppliers-data";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";

interface BookingPartiesSectionProps {
  selectedBuyer: BuyerAccount | null;
  onSelectBuyer: (buyer: BuyerAccount) => void;
  selectedSupplier: SupplierVendor | null;
  onSelectSupplier: (supplier: SupplierVendor) => void;
  availableBuyers?: BuyerAccount[];
  availableSuppliers?: SupplierVendor[];
  onQuickCreateBuyer?: (
    buyerData: Omit<BuyerAccountFull, "id" | "createdAt">,
  ) => Promise<BuyerAccount | void>;
  onQuickCreateSupplier?: (
    supplierData: Omit<SupplierAccountFull, "id" | "createdAt">,
  ) => Promise<SupplierVendor | void>;
  errors?: {
    buyer?: string;
    supplier?: string;
  };
}

export function BookingPartiesSection({
  selectedBuyer,
  onSelectBuyer,
  selectedSupplier,
  onSelectSupplier,
  availableBuyers = [],
  availableSuppliers = [],
  onQuickCreateBuyer,
  onQuickCreateSupplier,
  errors,
}: BookingPartiesSectionProps) {
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");

  // Quick Add Buyer Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickBuyerName, setQuickBuyerName] = useState("");
  const [quickCompanyName, setQuickCompanyName] = useState("");
  const [quickCountry, setQuickCountry] = useState("United Kingdom");
  const [quickContactPerson, setQuickContactPerson] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickPort, setQuickPort] = useState("Karachi (KHI)");
  const [isSavingBuyer, setIsSavingBuyer] = useState(false);

  // Quick Add Supplier Modal State
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const [quickLoadPoint, setQuickLoadPoint] = useState("");
  const [quickSupplierCity, setQuickSupplierCity] = useState("London");
  const [quickSupplierAddress, setQuickSupplierAddress] = useState("");
  const [quickSupplierCountry, setQuickSupplierCountry] = useState("United Kingdom");
  const [quickSupplierContact, setQuickSupplierContact] = useState("");
  const [quickSupplierEmail, setQuickSupplierEmail] = useState("");
  const [quickSupplierPhone, setQuickSupplierPhone] = useState("");
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  const buyerRef = useRef<HTMLDivElement>(null);
  const supplierRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (buyerRef.current && !buyerRef.current.contains(event.target as Node)) {
        setBuyerOpen(false);
      }
      if (supplierRef.current && !supplierRef.current.contains(event.target as Node)) {
        setSupplierOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buyersList = availableBuyers;
  const suppliersList = availableSuppliers;

  const filteredBuyers = buyersList.filter(
    (b) =>
      b.name.toLowerCase().includes(buyerSearch.toLowerCase()) ||
      b.consignee.toLowerCase().includes(buyerSearch.toLowerCase()) ||
      b.country.toLowerCase().includes(buyerSearch.toLowerCase()) ||
      (b.code && b.code.toLowerCase().includes(buyerSearch.toLowerCase())),
  );

  const filteredSuppliers = suppliersList.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.loadPoint.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.city.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(supplierSearch.toLowerCase())) ||
      (s.country && s.country.toLowerCase().includes(supplierSearch.toLowerCase())),
  );

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBuyerName.trim()) {
      toast.error("Please enter a Buyer name");
      return;
    }
    setIsSavingBuyer(true);
    try {
      const countryCode =
        quickCountry === "United Kingdom"
          ? "GB"
          : quickCountry === "Pakistan"
            ? "PK"
            : quickCountry === "United Arab Emirates"
              ? "AE"
              : quickCountry === "Germany"
                ? "DE"
                : "US";

      const newBuyerData: Omit<BuyerAccountFull, "id" | "createdAt"> = {
        name: quickBuyerName.trim(),
        company: quickCompanyName.trim() || quickBuyerName.trim(),
        country: quickCountry,
        countryCode,
        contactPerson: quickContactPerson.trim() || "Operations Desk",
        email: quickEmail.trim() || `ops@${quickBuyerName.toLowerCase().replace(/\s+/g, "")}.com`,
        phone: quickPhone.trim() || "+44 20 7946 0000",
        activeMovements: 0,
        deltaThisMonth: "+1 new",
        progressPercent: 0,
        totalMovements: 0,
        deliveredMovements: 0,
        inTransitMovements: 0,
        status: "Active",
        code: `${quickBuyerName.slice(0, 3).toUpperCase()}-${countryCode}`,
        preferredPort: quickPort,
      };

      if (onQuickCreateBuyer) {
        const created = await onQuickCreateBuyer(newBuyerData);
        if (created) {
          onSelectBuyer(created);
        }
      } else {
        const tempBuyer: BuyerAccount = {
          id: `buyer-${Date.now()}`,
          name: newBuyerData.name,
          consignee: newBuyerData.company,
          country: newBuyerData.country,
          code: newBuyerData.code,
          badge: "Consignee",
          status: "Active",
          destinationPort: quickPort,
        };
        onSelectBuyer(tempBuyer);
      }

      setIsQuickAddOpen(false);
      setBuyerOpen(false);
      setQuickBuyerName("");
      setQuickCompanyName("");
      setQuickContactPerson("");
      setQuickEmail("");
      setQuickPhone("");
      toast.success(`${quickBuyerName} added & selected`);
    } catch (err: unknown) {
      toast.error("Failed to add buyer", {
        description: err instanceof Error ? err.message : "Database error",
      });
    } finally {
      setIsSavingBuyer(false);
    }
  };

  const handleQuickAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) {
      toast.error("Please enter a Supplier name");
      return;
    }
    setIsSavingSupplier(true);
    try {
      const countryCode =
        quickSupplierCountry === "United Kingdom"
          ? "GB"
          : quickSupplierCountry === "Pakistan"
            ? "PK"
            : quickSupplierCountry === "United Arab Emirates"
              ? "AE"
              : quickSupplierCountry === "Germany"
                ? "DE"
                : "US";

      const loadPointResolved =
        quickLoadPoint.trim() || `${quickSupplierName.trim()} Hub (${quickSupplierCity})`;
      const addressResolved =
        quickSupplierAddress.trim() ||
        `Industrial Park, ${quickSupplierCity}, ${quickSupplierCountry}`;

      const newSupplierData: Omit<SupplierAccountFull, "id" | "createdAt"> = {
        name: quickSupplierName.trim(),
        subtitle: "Pickup Vendor",
        companyName: quickSupplierName.trim(),
        country: quickSupplierCountry,
        countryCode,
        loadPoint: loadPointResolved,
        loadPointCity: quickSupplierCity,
        loadPointType: "Warehouse",
        contactPerson: quickSupplierContact.trim() || "Warehouse Manager",
        contactRole: "Logistics Lead",
        email:
          quickSupplierEmail.trim() ||
          `warehouse@${quickSupplierName.toLowerCase().replace(/\s+/g, "")}.com`,
        phone: quickSupplierPhone.trim() || "+44 20 7946 0123",
        activeContainers: 0,
        containersDelta: "+1 new",
        totalContainersMoved: 0,
        status: "Active",
        code: `SUP-${quickSupplierName.slice(0, 3).toUpperCase()}`,
        address: addressResolved,
        city: quickSupplierCity,
      };

      if (onQuickCreateSupplier) {
        const created = await onQuickCreateSupplier(newSupplierData);
        if (created) {
          onSelectSupplier(created);
        }
      } else {
        const tempSupplier: SupplierVendor = {
          id: `sup-${Date.now()}`,
          name: newSupplierData.name,
          loadPoint: newSupplierData.loadPoint,
          city: newSupplierData.city,
          address: newSupplierData.address,
          country: newSupplierData.country,
        };
        onSelectSupplier(tempSupplier);
      }

      setIsQuickSupplierOpen(false);
      setSupplierOpen(false);
      setQuickSupplierName("");
      setQuickLoadPoint("");
      setQuickSupplierAddress("");
      setQuickSupplierContact("");
      setQuickSupplierEmail("");
      setQuickSupplierPhone("");
      toast.success(`${quickSupplierName} added & selected`);
    } catch (err: unknown) {
      toast.error("Failed to add supplier", {
        description: err instanceof Error ? err.message : "Database error",
      });
    } finally {
      setIsSavingSupplier(false);
    }
  };

  return (
    <section
      id="section-parties"
      className="glass-card rounded-[24px] p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#6A80A9]/10 text-xs font-bold text-[#6A80A9]">
              01
            </span>
            <h2 className="text-xl font-bold tracking-tight text-black sm:text-2xl">
              Booking Parties
            </h2>
          </div>
          <p className="text-xs text-slate-500 sm:text-sm">
            Tell us who this movement is for and where the cargo is being collected.
          </p>
        </div>
      </div>

      {/* Grid for Buyer and Supplier */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* ACCOUNT / BUYER */}
        <div className="space-y-2" ref={buyerRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Account / Buyer <span className="text-rose-500">*</span>
            </label>
            {selectedBuyer && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#6A80A9]/10 px-2 py-0.5 text-[10px] font-semibold text-[#6A80A9]">
                <UserCheck className="size-3" />
                {selectedBuyer.badge || "Consignee"}
              </span>
            )}
          </div>

          {/* Searchable Select Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setBuyerOpen((prev) => !prev);
                setSupplierOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[16px] border bg-white/80 px-4 py-3.5 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30",
                buyerOpen ? "border-[#6A80A9] ring-2 ring-[#6A80A9]/20" : "border-slate-200/90",
                errors?.buyer && !selectedBuyer && "border-rose-400 bg-rose-50/30",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Building2 className="size-4 text-[#6A80A9]" />
                </div>
                <div>
                  {selectedBuyer ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-black">{selectedBuyer.name}</p>
                        {selectedBuyer.code && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-medium text-slate-600">
                            {selectedBuyer.code}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {selectedBuyer.consignee} • {selectedBuyer.country}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select buyer...</span>
                  )}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-slate-400 transition-transform duration-200",
                  buyerOpen && "rotate-180 text-black",
                )}
              />
            </button>

            {/* Error message */}
            {errors?.buyer && !selectedBuyer && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">{errors.buyer}</p>
            )}

            {/* Searchable dropdown menu */}
            {buyerOpen && (
              <div className="glass-card-strong absolute z-30 mt-2 max-h-72 w-full overflow-hidden rounded-[18px] border border-white/90 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={buyerSearch}
                    onChange={(e) => setBuyerSearch(e.target.value)}
                    placeholder="Search buyer by name, consignee or country..."
                    className="w-full rounded-xl border border-slate-200/80 bg-white/95 py-2 pl-9 pr-3 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredBuyers.length > 0 ? (
                    filteredBuyers.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          onSelectBuyer(b);
                          setBuyerOpen(false);
                          setBuyerSearch("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-[#E8F1F3]/80",
                          selectedBuyer?.id === b.id &&
                            "bg-[#6A80A9]/10 font-semibold text-[#6A80A9]",
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-black truncate">{b.name}</span>
                            {b.code && (
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                {b.code}
                              </span>
                            )}
                            {b.id.startsWith("buyer-") &&
                              !b.id.includes("buyer-1") &&
                              !b.id.includes("buyer-2") &&
                              !b.id.includes("buyer-3") &&
                              !b.id.includes("buyer-4") && (
                                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.2 text-[8px] font-bold text-emerald-700">
                                  REALTIME
                                </span>
                              )}
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {b.consignee} • {b.country}
                          </span>
                        </div>
                        {selectedBuyer?.id === b.id && (
                          <Check className="size-4 shrink-0 text-[#6A80A9]" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No buyers found for "{buyerSearch}"
                    </div>
                  )}
                </div>

                {/* Quick Add Buyer Footer Button */}
                <div className="mt-2 border-t border-slate-100 pt-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddOpen(true);
                      setBuyerOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#6A80A9]/10 py-2 text-xs font-semibold text-[#6A80A9] transition-colors hover:bg-[#6A80A9]/20"
                  >
                    <Plus className="size-3.5" />
                    <span>Add New Buyer to Supabase</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PICKUP VENDOR / SUPPLIER */}
        <div className="space-y-2" ref={supplierRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Pickup Vendor / Supplier <span className="text-rose-500">*</span>
            </label>
            {selectedSupplier && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Warehouse className="size-3" />
                Origin
              </span>
            )}
          </div>

          {/* Searchable Select Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSupplierOpen((prev) => !prev);
                setBuyerOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[16px] border bg-white/80 px-4 py-3.5 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30",
                supplierOpen ? "border-[#6A80A9] ring-2 ring-[#6A80A9]/20" : "border-slate-200/90",
                errors?.supplier && !selectedSupplier && "border-rose-400 bg-rose-50/30",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Warehouse className="size-4 text-[#6A80A9]" />
                </div>
                <div>
                  {selectedSupplier ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-black">{selectedSupplier.name}</p>
                        {selectedSupplier.country && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-medium text-slate-600">
                            {selectedSupplier.country}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {selectedSupplier.city} • {selectedSupplier.loadPoint}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select supplier...</span>
                  )}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-slate-400 transition-transform duration-200",
                  supplierOpen && "rotate-180 text-black",
                )}
              />
            </button>

            {/* Error message */}
            {errors?.supplier && !selectedSupplier && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">{errors.supplier}</p>
            )}

            {/* Searchable dropdown menu */}
            {supplierOpen && (
              <div className="glass-card-strong absolute z-30 mt-2 max-h-72 w-full overflow-hidden rounded-[18px] border border-white/90 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="Search supplier, load point or city..."
                    className="w-full rounded-xl border border-slate-200/80 bg-white/95 py-2 pl-9 pr-3 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectSupplier(s);
                          setSupplierOpen(false);
                          setSupplierSearch("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-[#E8F1F3]/80",
                          selectedSupplier?.id === s.id &&
                            "bg-[#6A80A9]/10 font-semibold text-[#6A80A9]",
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-black truncate">{s.name}</span>
                            {s.id.startsWith("sup-") &&
                              !s.id.includes("sup-1") &&
                              !s.id.includes("sup-2") &&
                              !s.id.includes("sup-3") &&
                              !s.id.includes("sup-4") && (
                                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.2 text-[8px] font-bold text-emerald-700">
                                  REALTIME
                                </span>
                              )}
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate">
                            Load Point: {s.loadPoint} ({s.city})
                          </span>
                        </div>
                        {selectedSupplier?.id === s.id && (
                          <Check className="size-4 shrink-0 text-[#6A80A9]" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No suppliers found for "{supplierSearch}"
                    </div>
                  )}
                </div>

                {/* Quick Add Supplier Footer Button */}
                <div className="mt-2 border-t border-slate-100 pt-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickSupplierOpen(true);
                      setSupplierOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#6A80A9]/10 py-2 text-xs font-semibold text-[#6A80A9] transition-colors hover:bg-[#6A80A9]/20"
                  >
                    <Plus className="size-3.5" />
                    <span>Add New Supplier to Supabase</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AUTOMATIC LOAD POINT DISPLAY PANEL */}
      {selectedSupplier && (
        <div className="mt-6 rounded-[18px] border border-[#C7D5BF]/80 bg-gradient-to-r from-[#C7D5BF]/15 via-white/80 to-[#E8F1F3]/30 p-4.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] animate-in fade-in duration-300">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#C7D5BF]/50 text-[#2D3C26] shadow-sm">
                <MapPin className="size-4.5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Load Point (Origin Depot)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#2D3C26]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2D3C26]">
                    <Sparkles className="size-2.5" />
                    Auto-Populated
                  </span>
                </div>
                <p className="text-base font-bold text-black">{selectedSupplier.loadPoint}</p>
                <p className="text-xs text-slate-600">{selectedSupplier.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur-sm sm:max-w-[260px]">
              <Info className="size-4 shrink-0 text-[#6A80A9]" />
              <span className="text-[11px] leading-tight">
                Load point automatically populated from supplier directory.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD BUYER MODAL */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto rounded-[24px] border border-slate-150 bg-white p-5 sm:p-6 shadow-2xl focus:outline-none [scrollbar-width:thin]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-black">
              <Building2 className="size-5 text-[#6A80A9]" />
              Add New Buyer to Supabase
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              New buyers are saved to Supabase in real-time and automatically available across all
              booking and directory views.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickAddSubmit} className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Buyer / Brand Name *</label>
              <input
                type="text"
                value={quickBuyerName}
                onChange={(e) => setQuickBuyerName(e.target.value)}
                placeholder="e.g. Al-Noor Global Trading"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Consignee Legal Company
              </label>
              <input
                type="text"
                value={quickCompanyName}
                onChange={(e) => setQuickCompanyName(e.target.value)}
                placeholder="e.g. Al-Noor Logistics Ltd"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LifecycleDropdownSelect
                label="Country"
                value={quickCountry}
                onChange={(val) => setQuickCountry(val)}
                options={[
                  "United Kingdom",
                  "Pakistan",
                  "United Arab Emirates",
                  "Germany",
                  "Spain",
                  "United States",
                ]}
                placeholder="Country"
                size="sm"
                activeColor="blue"
                triggerClassName="w-full h-9.5 text-xs mt-1"
              />

              <LifecycleDropdownSelect
                label="Destination Port"
                value={quickPort}
                onChange={(val) => setQuickPort(val)}
                options={[
                  "Karachi (KHI)",
                  "Dubai (DXB)",
                  "Hamburg (HAM)",
                  "Gothenburg (GOT)",
                  "Barcelona (BCN)",
                ]}
                placeholder="Destination Port"
                size="sm"
                activeColor="blue"
                triggerClassName="w-full h-9.5 text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Contact Person</label>
                <input
                  type="text"
                  value={quickContactPerson}
                  onChange={(e) => setQuickContactPerson(e.target.value)}
                  placeholder="e.g. Tariq Khan"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="+44 7911 123456"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingBuyer}
                className="w-full sm:w-auto rounded-xl bg-[#6A80A9] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#586C8F] disabled:opacity-50 cursor-pointer"
              >
                {isSavingBuyer ? "Saving to Supabase..." : "Save & Select Buyer"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD SUPPLIER MODAL */}
      <Dialog open={isQuickSupplierOpen} onOpenChange={setIsQuickSupplierOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto rounded-[24px] border border-slate-150 bg-white p-5 sm:p-6 shadow-2xl focus:outline-none [scrollbar-width:thin]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-black">
              <Warehouse className="size-5 text-[#6A80A9]" />
              Add New Supplier to Supabase
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              New suppliers are saved to Supabase in real-time and automatically available across
              booking and supplier directory views.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickAddSupplierSubmit} className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">
                Supplier / Vendor Name *
              </label>
              <input
                type="text"
                value={quickSupplierName}
                onChange={(e) => setQuickSupplierName(e.target.value)}
                placeholder="e.g. Thames River Textiles Ltd"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">City</label>
                <input
                  type="text"
                  value={quickSupplierCity}
                  onChange={(e) => setQuickSupplierCity(e.target.value)}
                  placeholder="e.g. Manchester"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                />
              </div>

              <LifecycleDropdownSelect
                label="Country"
                value={quickSupplierCountry}
                onChange={(val) => setQuickSupplierCountry(val)}
                options={[
                  "United Kingdom",
                  "Pakistan",
                  "United Arab Emirates",
                  "Germany",
                  "Spain",
                  "United States",
                ]}
                placeholder="Country"
                size="sm"
                activeColor="blue"
                triggerClassName="w-full h-9.5 text-xs mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Load Point / Depot Name
              </label>
              <input
                type="text"
                value={quickLoadPoint}
                onChange={(e) => setQuickLoadPoint(e.target.value)}
                placeholder="e.g. Manchester Central Depot Bay 4"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Physical Pickup Address
              </label>
              <input
                type="text"
                value={quickSupplierAddress}
                onChange={(e) => setQuickSupplierAddress(e.target.value)}
                placeholder="e.g. Unit 4, Trafford Park Logistics Gateway"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Contact Person</label>
                <input
                  type="text"
                  value={quickSupplierContact}
                  onChange={(e) => setQuickSupplierContact(e.target.value)}
                  placeholder="e.g. James Wilson"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={quickSupplierPhone}
                  onChange={(e) => setQuickSupplierPhone(e.target.value)}
                  placeholder="+44 161 999 1234"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsQuickSupplierOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSupplier}
                className="w-full sm:w-auto rounded-xl bg-[#6A80A9] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#586C8F] disabled:opacity-50 cursor-pointer"
              >
                {isSavingSupplier ? "Saving to Supabase..." : "Save & Select Supplier"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
