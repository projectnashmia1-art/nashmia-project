import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  Plus,
  Search,
  Settings,
  Ship,
  Sparkles,
  Timer,
  User,
  Warehouse,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBookingsFromSupabase,
  fetchBuyersFromSupabase,
  fetchSuppliersFromSupabase,
  fetchForwardersFromSupabase,
  reconcileBookingWithConfirmations,
  type FullBookingRecord,
} from "@/lib/supabase-services";
import type { Movement } from "@/lib/nashmia-data";

const MovementLifecycleDrawer = lazy(() =>
  import("../movements/MovementLifecycleDrawer").then((m) => ({
    default: m.MovementLifecycleDrawer,
  })),
);

export interface GlobalSearchProps {
  variant?: "dashboard" | "navbar";
  className?: string;
  placeholder?: string;
  onSelectMovement?: (movementId?: string, ref?: string) => void;
}

interface SearchResultItem {
  id: string;
  category: "movement" | "buyer" | "supplier" | "forwarder" | "action";
  title: string;
  subtitle: string;
  meta?: string;
  badge?: {
    label: string;
    variant: "cyan" | "emerald" | "amber" | "slate" | "indigo";
  };
  data?: unknown;
  actionUrl?: string;
}

const QUICK_ACTIONS: SearchResultItem[] = [
  {
    id: "act-new-booking",
    category: "action",
    title: "Create New Booking",
    subtitle: "Launch full lifecycle freight container booking",
    meta: "Quick Action",
    badge: { label: "New", variant: "cyan" },
    actionUrl: "/new-booking",
  },
  {
    id: "act-requests",
    category: "action",
    title: "Quotation Requests & RFQs",
    subtitle: "Multi-forwarder rate bidding and freight contracts",
    meta: "Quotations",
    badge: { label: "RFQ", variant: "indigo" },
    actionUrl: "/requests",
  },
  {
    id: "act-emails",
    category: "action",
    title: "AI Email Operations Hub",
    subtitle: "Automated forwarder confirmations & booking threads",
    meta: "AI Communications",
    badge: { label: "AI Mail", variant: "cyan" },
    actionUrl: "/emails",
  },
  {
    id: "act-buyers",
    category: "action",
    title: "Buyers & Consignees Directory",
    subtitle: "Manage buyer accounts, shipment history & destinations",
    meta: "Directory",
    badge: { label: "Accounts", variant: "slate" },
    actionUrl: "/buyers",
  },
  {
    id: "act-suppliers",
    category: "action",
    title: "Suppliers & Load Points Directory",
    subtitle: "Collection warehouses, CFS terminals & vendor contacts",
    meta: "Vendors",
    badge: { label: "Pickup Points", variant: "amber" },
    actionUrl: "/suppliers",
  },
  {
    id: "act-forwarders",
    category: "action",
    title: "Forwarders & Shipping Lines",
    subtitle: "Freight carriers, contracts, ratings and allocations",
    meta: "Carriers",
    badge: { label: "Lines", variant: "emerald" },
    actionUrl: "/forwarders",
  },
  {
    id: "act-documents",
    category: "action",
    title: "Document Vault & Bill of Lading",
    subtitle: "Export declarations, packing lists & commercial invoices",
    meta: "Compliance",
    badge: { label: "Docs", variant: "slate" },
    actionUrl: "/documents",
  },
  {
    id: "act-settings",
    category: "action",
    title: "System & Profile Settings",
    subtitle: "Organization profile, notifications and preferences",
    meta: "Config",
    badge: { label: "Admin", variant: "slate" },
    actionUrl: "/settings",
  },
];

export const GlobalSearch = memo(function GlobalSearch({
  variant = "dashboard",
  className,
  placeholder,
  onSelectMovement,
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Local state for movement drawer if opened directly from search
  const [activeMovementDrawerId, setActiveMovementDrawerId] = useState<string | null>(null);
  const [activeMovementDrawerRef, setActiveMovementDrawerRef] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch live bookings
  const { data: rawBookings = [] } = useQuery({
    queryKey: ["global-search-bookings", userId],
    queryFn: () => fetchBookingsFromSupabase(userId),
    staleTime: 1000 * 30,
  });

  // Fetch live buyers
  const { data: rawBuyers = [] } = useQuery({
    queryKey: ["global-search-buyers", userId],
    queryFn: () => fetchBuyersFromSupabase(userId),
    staleTime: 1000 * 60,
  });

  // Fetch live suppliers
  const { data: rawSuppliers = [] } = useQuery({
    queryKey: ["global-search-suppliers", userId],
    queryFn: () => fetchSuppliersFromSupabase(userId),
    staleTime: 1000 * 60,
  });

  // Fetch live forwarders
  const { data: rawForwarders = [] } = useQuery({
    queryKey: ["global-search-forwarders", userId],
    queryFn: () => fetchForwardersFromSupabase(userId),
    staleTime: 1000 * 60,
  });

  // Reconcile and normalize movements
  const movementsList = useMemo(() => {
    if (rawBookings && rawBookings.length > 0) {
      return (rawBookings as FullBookingRecord[]).map(reconcileBookingWithConfirmations);
    }
    return [];
  }, [rawBookings]);

  // Combine buyers
  const buyersList = useMemo(() => {
    return rawBuyers || [];
  }, [rawBuyers]);

  // Combine suppliers
  const suppliersList = useMemo(() => {
    return rawSuppliers || [];
  }, [rawSuppliers]);

  // Filtered search results
  const searchResults = useMemo<SearchResultItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    if (!q) {
      // Return top quick suggestions when no query typed
      return QUICK_ACTIONS.slice(0, 6);
    }

    const items: SearchResultItem[] = [];

    // 1. Search Movements & Bookings
    const matchedMovements = movementsList.filter((m: FullBookingRecord | Movement) => {
      const ref = (
        (m as FullBookingRecord).movement_number ||
        (m as FullBookingRecord).booking_reference ||
        (m as Movement).ref ||
        m.id ||
        ""
      ).toLowerCase();
      const buyer = (
        (m as FullBookingRecord).buyer_name ||
        (m as FullBookingRecord).buyer?.company_name ||
        (m as Movement).buyer ||
        ""
      ).toLowerCase();
      const supplier = (
        (m as FullBookingRecord).supplier_name ||
        (m as FullBookingRecord).supplier?.company_name ||
        (m as Movement).supplier ||
        ""
      ).toLowerCase();
      const forwarder = (
        (m as FullBookingRecord).forwarder_name ||
        (m as FullBookingRecord).forwarder?.company_name ||
        (m as Movement).forwarder ||
        ""
      ).toLowerCase();
      const pol = ((m as FullBookingRecord).origin_port || (m as Movement).pol || "").toLowerCase();
      const pod = (
        (m as FullBookingRecord).destination_port ||
        (m as Movement).pod ||
        ""
      ).toLowerCase();
      const vessel = (
        (m as FullBookingRecord).vessel_name ||
        (m as Movement).vessel ||
        ""
      ).toLowerCase();
      const stage = ((m as FullBookingRecord).status || (m as Movement).stage || "").toLowerCase();

      return (
        ref.includes(q) ||
        buyer.includes(q) ||
        supplier.includes(q) ||
        forwarder.includes(q) ||
        pol.includes(q) ||
        pod.includes(q) ||
        vessel.includes(q) ||
        stage.includes(q)
      );
    });

    matchedMovements.slice(0, 5).forEach((m: FullBookingRecord | Movement) => {
      const ref =
        (m as FullBookingRecord).movement_number ||
        (m as FullBookingRecord).booking_reference ||
        (m as Movement).ref ||
        (m.id ? `MOV-${String(m.id).slice(0, 8).toUpperCase()}` : "Movement");
      const buyer =
        (m as FullBookingRecord).buyer_name ||
        (m as FullBookingRecord).buyer?.company_name ||
        (m as Movement).buyer ||
        "—";
      const supplier =
        (m as FullBookingRecord).supplier_name ||
        (m as FullBookingRecord).supplier?.company_name ||
        (m as Movement).supplier ||
        "—";
      const forwarder =
        (m as FullBookingRecord).forwarder_name ||
        (m as FullBookingRecord).forwarder?.company_name ||
        (m as Movement).forwarder ||
        "Unassigned";
      const pol = ((m as FullBookingRecord).origin_port || (m as Movement).pol || "").toUpperCase();
      const pod = (
        (m as FullBookingRecord).destination_port ||
        (m as Movement).pod ||
        ""
      ).toUpperCase();
      const vessel = (m as FullBookingRecord).vessel_name || (m as Movement).vessel || "—";
      const stage = (m as FullBookingRecord).status || (m as Movement).stage || "Booking Requested";

      const isConfirmed =
        stage.toLowerCase().includes("confirmed") ||
        (m as FullBookingRecord).confirmation_status === "CONFIRMED";

      const laneText = pol && pod ? ` · ${pol} → ${pod}` : "";
      items.push({
        id: `mov-${m.id || ref}`,
        category: "movement",
        title: `${ref}${laneText}`,
        subtitle: `${buyer} • ${supplier} • Forwarder: ${forwarder} • Vessel: ${vessel}`,
        meta: pol && pod ? `${pol} → ${pod}` : undefined,
        badge: {
          label: isConfirmed ? "Confirmed" : stage,
          variant: isConfirmed ? "cyan" : "slate",
        },
        data: { id: m.id, ref },
      });
    });

    // 2. Search Buyers
    const matchedBuyers = buyersList.filter((b) => {
      const name = (b.name || (b as { company?: string }).company || "").toLowerCase();
      const contact = (
        b.contact_person ||
        (b as { contactPerson?: string }).contactPerson ||
        ""
      ).toLowerCase();
      const country = (b.country || "").toLowerCase();
      const code = (b.code || "").toLowerCase();
      const email = (b.email || "").toLowerCase();

      return (
        name.includes(q) ||
        contact.includes(q) ||
        country.includes(q) ||
        code.includes(q) ||
        email.includes(q)
      );
    });

    matchedBuyers.slice(0, 3).forEach((b) => {
      const name = b.name || (b as { company?: string }).company || "Buyer Account";
      const contact =
        b.contact_person || (b as { contactPerson?: string }).contactPerson || "Primary Contact";
      const country = b.country || "Global";
      const code = b.code || "BYR";

      items.push({
        id: `buyer-${b.id || name}`,
        category: "buyer",
        title: `${name} (${code})`,
        subtitle: `${contact} · ${country} · ${b.email || "buyer@nashmia.com"}`,
        meta: country,
        badge: { label: "Buyer", variant: "slate" },
        actionUrl: "/buyers",
      });
    });

    // 3. Search Suppliers
    const matchedSuppliers = suppliersList.filter((s) => {
      const name = (
        s.name ||
        (s as { companyName?: string }).companyName ||
        (s as { company_name?: string }).company_name ||
        ""
      ).toLowerCase();
      const contact = (
        s.contact_person ||
        (s as { contactPerson?: string }).contactPerson ||
        ""
      ).toLowerCase();
      const city = (s.city || (s as { loadPointCity?: string }).loadPointCity || "").toLowerCase();
      const loadPoint = (
        (s as { loadPoint?: string }).loadPoint ||
        (s as { address?: string }).address ||
        ""
      ).toLowerCase();
      const code = (s.code || "").toLowerCase();

      return (
        name.includes(q) ||
        contact.includes(q) ||
        city.includes(q) ||
        loadPoint.includes(q) ||
        code.includes(q)
      );
    });

    matchedSuppliers.slice(0, 3).forEach((s) => {
      const name =
        s.name ||
        (s as { companyName?: string }).companyName ||
        (s as { company_name?: string }).company_name ||
        "Supplier";
      const city = s.city || (s as { loadPointCity?: string }).loadPointCity || "City Hub";
      const code = s.code || "SUP";
      const contact =
        s.contact_person || (s as { contactPerson?: string }).contactPerson || "Vendor Contact";

      items.push({
        id: `sup-${s.id || name}`,
        category: "supplier",
        title: `${name} (${code})`,
        subtitle: `${contact} · ${city} · Vendor Pickup Point`,
        meta: city,
        badge: { label: "Supplier", variant: "amber" },
        actionUrl: "/suppliers",
      });
    });

    // 4. Search Quick Actions / Modules
    const matchedActions = QUICK_ACTIONS.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        (a.meta && a.meta.toLowerCase().includes(q)),
    );

    matchedActions.slice(0, 3).forEach((a) => {
      items.push(a);
    });

    return items;
  }, [searchQuery, movementsList, buyersList, suppliersList]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== "input" && activeTag !== "textarea") {
          e.preventDefault();
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle selecting an item
  const handleSelectItem = useCallback(
    (item: SearchResultItem) => {
      setIsOpen(false);
      setSearchQuery("");

      if (item.category === "movement") {
        const movData = item.data as { id?: string; ref?: string } | undefined;
        if (onSelectMovement) {
          onSelectMovement(movData?.id, movData?.ref);
        } else {
          setActiveMovementDrawerId(movData?.id || null);
          setActiveMovementDrawerRef(movData?.ref || null);
        }
        return;
      }

      if (item.actionUrl) {
        navigate({ to: item.actionUrl });
      }
    },
    [navigate, onSelectMovement],
  );

  // Keyboard navigation within dropdown
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        handleSelectItem(searchResults[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Grouped search results for structured view
  const groupedResults = useMemo(() => {
    const movements = searchResults.filter((r) => r.category === "movement");
    const parties = searchResults.filter(
      (r) => r.category === "buyer" || r.category === "supplier" || r.category === "forwarder",
    );
    const actions = searchResults.filter((r) => r.category === "action");

    return { movements, parties, actions };
  }, [searchResults]);

  const defaultPlaceholder =
    variant === "dashboard"
      ? "Search containers, buyers, references..."
      : "Search containers, vessels, bookings, cut-offs...";

  return (
    <>
      <div ref={containerRef} className={cn("relative", className)}>
        {/* Input Field Container */}
        {variant === "dashboard" ? (
          <div
            className={cn(
              "flex h-11 w-full min-w-0 sm:min-w-[240px] items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 shadow-2xs sm:w-[330px] transition-all duration-200",
              isOpen &&
                "border-[#0FA3B1] ring-2 ring-[#0FA3B1]/20 shadow-[0_4px_16px_rgba(15,163,177,0.1)]",
            )}
          >
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
                setSelectedIndex(0);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleInputKeyDown}
              aria-label="Search"
              placeholder={placeholder || defaultPlaceholder}
              className="w-full bg-transparent text-[13.5px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none hidden items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 sm:inline-block">
                ⌘K
              </kbd>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "flex h-8.5 w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 shadow-2xs transition-all duration-150 hover:border-slate-300 focus-within:border-slate-900 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/10",
              isOpen && "border-slate-900 bg-white ring-2 ring-slate-900/10",
            )}
          >
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
                setSelectedIndex(0);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleInputKeyDown}
              aria-label="Search operations"
              placeholder={placeholder || defaultPlaceholder}
              className="w-full bg-transparent text-[12.5px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="rounded-full p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="hidden rounded-[6px] border border-white/90 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-xs lg:inline-block">
                ⌘K
              </kbd>
            )}
          </div>
        )}

        {/* Global Search Dropdown Flyout */}
        {isOpen && (
          <div
            ref={listRef}
            className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-[460px] max-w-[calc(100vw-24px)] top-full mt-2 z-50 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.16)] backdrop-blur-xl animate-in fade-in-50 zoom-in-95 duration-150"
          >
            {/* Header info bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-[#0FA3B1]" />
                {searchQuery ? "Global Results" : "Quick Actions & Navigation"}
              </span>
              <span className="font-normal normal-case text-slate-400 text-[11px]">
                {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
              </span>
            </div>

            {/* Results List */}
            <div className="max-h-[380px] overflow-y-auto overscroll-contain py-1 divide-y divide-slate-100/60">
              {searchResults.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-400">
                    <Search className="size-5" />
                  </div>
                  <p className="mt-2.5 text-[13.5px] font-semibold text-slate-800">
                    No matching records found
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Try searching with reference number, port code, or partner name.
                  </p>
                </div>
              ) : (
                <>
                  {/* Movements Section */}
                  {groupedResults.movements.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Ship className="size-3 text-[#0FA3B1]" />
                        Movements &amp; Shipments
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {groupedResults.movements.map((item) => {
                          const itemIndex = searchResults.findIndex((r) => r.id === item.id);
                          const isSelected = itemIndex === selectedIndex;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              className={cn(
                                "group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 cursor-pointer",
                                isSelected
                                  ? "bg-[#E8F5F6] text-slate-900 shadow-2xs"
                                  : "text-slate-700 hover:bg-slate-50",
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={cn(
                                    "grid size-8 shrink-0 place-items-center rounded-lg border text-[13px] font-bold transition-colors",
                                    isSelected
                                      ? "border-[#0FA3B1] bg-[#0FA3B1] text-white"
                                      : "border-slate-200 bg-slate-100 text-slate-600 group-hover:border-[#0FA3B1]/40 group-hover:text-[#0FA3B1]",
                                  )}
                                >
                                  <Ship className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-[13px] font-bold text-slate-900">
                                      {item.title}
                                    </p>
                                    {item.badge && (
                                      <span
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                                          item.badge.variant === "cyan"
                                            ? "bg-[#0FA3B1]/10 text-[#0FA3B1]"
                                            : "bg-slate-100 text-slate-600",
                                        )}
                                      >
                                        {item.badge.label}
                                      </span>
                                    )}
                                  </div>
                                  <p className="truncate text-[11.5px] text-slate-500 mt-0.5">
                                    {item.subtitle}
                                  </p>
                                </div>
                              </div>
                              <ArrowRight
                                className={cn(
                                  "size-4 shrink-0 transition-transform",
                                  isSelected
                                    ? "text-[#0FA3B1] translate-x-0.5"
                                    : "text-slate-300 opacity-0 group-hover:opacity-100",
                                )}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Parties Section */}
                  {groupedResults.parties.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="size-3 text-amber-500" />
                        Directory &amp; Accounts
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {groupedResults.parties.map((item) => {
                          const itemIndex = searchResults.findIndex((r) => r.id === item.id);
                          const isSelected = itemIndex === selectedIndex;
                          const isBuyer = item.category === "buyer";
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              className={cn(
                                "group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 cursor-pointer",
                                isSelected
                                  ? "bg-slate-100 text-slate-900 shadow-2xs"
                                  : "text-slate-700 hover:bg-slate-50",
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={cn(
                                    "grid size-8 shrink-0 place-items-center rounded-lg border text-[13px] font-bold transition-colors",
                                    isBuyer
                                      ? "border-blue-200 bg-blue-50 text-blue-600"
                                      : "border-amber-200 bg-amber-50 text-amber-600",
                                  )}
                                >
                                  {isBuyer ? (
                                    <Building2 className="size-4" />
                                  ) : (
                                    <Warehouse className="size-4" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-[13px] font-bold text-slate-900">
                                      {item.title}
                                    </p>
                                    {item.badge && (
                                      <span
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                                          isBuyer
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-amber-100 text-amber-700",
                                        )}
                                      >
                                        {item.badge.label}
                                      </span>
                                    )}
                                  </div>
                                  <p className="truncate text-[11.5px] text-slate-500 mt-0.5">
                                    {item.subtitle}
                                  </p>
                                </div>
                              </div>
                              <ArrowRight
                                className={cn(
                                  "size-4 shrink-0 text-slate-400 transition-transform",
                                  isSelected
                                    ? "translate-x-0.5 text-slate-700"
                                    : "opacity-0 group-hover:opacity-100",
                                )}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions Section */}
                  {groupedResults.actions.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="size-3 text-indigo-500" />
                        Quick Navigation
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {groupedResults.actions.map((item) => {
                          const itemIndex = searchResults.findIndex((r) => r.id === item.id);
                          const isSelected = itemIndex === selectedIndex;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              className={cn(
                                "group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all duration-150 cursor-pointer",
                                isSelected
                                  ? "bg-slate-100 text-slate-900 shadow-2xs"
                                  : "text-slate-700 hover:bg-slate-50",
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs group-hover:border-[#0FA3B1]">
                                  {item.id.includes("booking") ? (
                                    <Plus className="size-3.5 text-[#0FA3B1]" />
                                  ) : item.id.includes("email") ? (
                                    <Mail className="size-3.5 text-[#0FA3B1]" />
                                  ) : (
                                    <ArrowRight className="size-3.5 text-slate-500" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12.5px] font-semibold text-slate-800">
                                    {item.title}
                                  </p>
                                  <p className="truncate text-[11px] text-slate-400">
                                    {item.subtitle}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-600">
                                Open
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer keyboard hints */}
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 bg-slate-50/50 rounded-b-xl">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-slate-500 shadow-2xs">
                    ↑
                  </kbd>
                  <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-slate-500 shadow-2xs">
                    ↓
                  </kbd>
                  <span className="ml-1">Navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-slate-500 shadow-2xs">
                    ↵
                  </kbd>
                  <span className="ml-1">Select</span>
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-slate-500 shadow-2xs">
                  Esc
                </kbd>
                <span className="ml-1">Close</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Standalone Movement Lifecycle Drawer when triggered from search */}
      {activeMovementDrawerRef && (
        <Suspense fallback={null}>
          <MovementLifecycleDrawer
            isOpen={Boolean(activeMovementDrawerRef)}
            onClose={() => {
              setActiveMovementDrawerRef(null);
              setActiveMovementDrawerId(null);
            }}
            bookingId={activeMovementDrawerId || undefined}
            initialReference={activeMovementDrawerRef}
          />
        </Suspense>
      )}
    </>
  );
});
