import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  Globe2,
  Mail,
  Phone,
  Plus,
  Ship,
  User,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ForwarderAccount,
  FORWARDER_COUNTRY_OPTIONS,
  FORWARDER_SHIPPING_LINES_OPTIONS,
} from "@/lib/forwarders-data";
import { ResultSuccessView } from "@/components/nashmia/common/ResultSuccessView";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import { cn } from "@/lib/utils";

interface AddForwarderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveForwarder: (
    data: Omit<ForwarderAccount, "id" | "createdAt" | "rateCards" | "recentMovements">,
    editId?: string,
  ) => void;
  editForwarder?: ForwarderAccount | null;
}

const ALL_SHIPPING_LINES = FORWARDER_SHIPPING_LINES_OPTIONS.filter(
  (sl) => sl !== "All Shipping Lines",
);

export function AddForwarderModal({
  open,
  onOpenChange,
  onSaveForwarder,
  editForwarder,
}: AddForwarderModalProps) {
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactRole, setContactRole] = useState("Freight Booking Agent");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [selectedShippingLines, setSelectedShippingLines] = useState<string[]>([
    "MSC",
    "Maersk",
    "CMA CGM",
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedEntity, setSavedEntity] = useState<{ name: string; code: string } | null>(null);

  useEffect(() => {
    if (editForwarder) {
      setName(editForwarder.name);
      setContactPerson(editForwarder.contactPerson);
      setContactRole(editForwarder.contactRole || "Freight Booking Agent");
      setEmail(editForwarder.email);
      setWhatsapp(editForwarder.whatsapp);
      setCountry(editForwarder.country);
      setNotes(editForwarder.notes || "");
      setStatus(editForwarder.status === "Inactive" ? "Inactive" : "Active");
      setSelectedShippingLines(
        editForwarder.shippingLines.length > 0 ? editForwarder.shippingLines : ["MSC", "Maersk"],
      );
      setIsSuccess(false);
      setSavedEntity(null);
    } else {
      setName("");
      setContactPerson("");
      setContactRole("Freight Booking Agent");
      setEmail("");
      setWhatsapp("");
      setCountry("United Kingdom");
      setNotes("");
      setStatus("Active");
      setSelectedShippingLines(["MSC", "Maersk", "CMA CGM"]);
      setIsSuccess(false);
      setSavedEntity(null);
    }
    setErrors({});
  }, [editForwarder, open]);

  const toggleShippingLine = (line: string) => {
    if (selectedShippingLines.includes(line)) {
      if (selectedShippingLines.length > 1) {
        setSelectedShippingLines(selectedShippingLines.filter((l) => l !== line));
      }
    } else {
      setSelectedShippingLines([...selectedShippingLines, line]);
    }
  };

  const handleSelectAllLines = () => {
    setSelectedShippingLines([...ALL_SHIPPING_LINES]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Forwarder name is required";
    if (!contactPerson.trim()) newErrors.contactPerson = "Contact person is required";
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!whatsapp.trim()) newErrors.whatsapp = "WhatsApp or phone number is required";
    if (selectedShippingLines.length === 0) {
      newErrors.shippingLines = "Select at least one shipping line";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const countryCode =
      country === "United Kingdom"
        ? "GB"
        : country === "Germany"
          ? "DE"
          : country === "France"
            ? "FR"
            : country === "Spain"
              ? "ES"
              : country === "Italy"
                ? "IT"
                : country === "Netherlands"
                  ? "NL"
                  : country === "United Arab Emirates"
                    ? "AE"
                    : country === "Pakistan"
                      ? "PK"
                      : country === "China"
                        ? "CN"
                        : "US";

    const code =
      editForwarder?.code ||
      `${name.slice(0, 3).toUpperCase()}-FWD-${countryCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    onSaveForwarder(
      {
        name: name.trim(),
        code,
        badge: "Booking Agent",
        contactPerson: contactPerson.trim(),
        contactRole: contactRole.trim() || "Freight Booking Agent",
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        country,
        countryCode,
        shippingLines: selectedShippingLines,
        activeBookings: editForwarder ? editForwarder.activeBookings : 0,
        totalBookings: editForwarder ? editForwarder.totalBookings : 0,
        notes: notes.trim(),
        status,
      },
      editForwarder?.id,
    );

    setSavedEntity({ name: name.trim(), code });
    setIsSuccess(true);
  };

  const handleDismiss = () => {
    onOpenChange(false);
    setTimeout(() => {
      setIsSuccess(false);
      setSavedEntity(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-[95vw] sm:max-w-[580px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-100 bg-white shadow-2xl focus:outline-none",
          isSuccess && "sm:max-w-[420px]",
        )}
      >
        {isSuccess ? (
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[88vh]">
            <ResultSuccessView
              type="success"
              title={
                editForwarder ? "Forwarder Profile Updated" : "Forwarder Registered Successfully"
              }
              message={`Your forwarder partner data has been ${
                editForwarder ? "updated" : "saved and added to the directory"
              }. Active booking requests and rate cards can now reference this partner.`}
              entityName={savedEntity?.name}
              entitySubtitle={savedEntity?.code}
              actionText="OKAY"
              onAction={handleDismiss}
              onClose={handleDismiss}
            />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col h-full max-h-[90vh] overflow-hidden"
          >
            {/* Minimal Circular Close Button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-700 active:scale-95 cursor-pointer shadow-2xs"
            >
              <X className="size-4 stroke-[2.5]" />
            </button>

            {/* Clean Minimal Header (Matching Supplier Modal) */}
            <DialogHeader className="p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 shrink-0 bg-white space-y-1.5 text-left pr-10">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5F6] px-3 py-1 text-[11px] font-bold text-[#0FA3B1] w-fit">
                <span className="size-1.5 rounded-full bg-[#0FA3B1]" />
                {editForwarder ? "Edit Forwarder Partner" : "Forwarder Partner"}
              </div>
              <DialogTitle className="text-xl sm:text-[22px] font-extrabold tracking-tight text-[#0D1F3C]">
                {editForwarder ? "Update Forwarder Profile" : "Register New Forwarder"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-[13px] font-medium text-slate-500">
                {editForwarder
                  ? "Modify booking agent credentials, contracted shipping lines, and direct contact channels."
                  : "Configure booking agent details, contact channels, and contracted shipping lines."}
              </DialogDescription>
            </DialogHeader>

            {/* SCROLLABLE FORM INPUTS */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 [scrollbar-width:thin]">
              {/* Row 1: Name & Country */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Forwarder / Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder="e.g. Apex Global Forwarding"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                  />
                  {errors.name && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <LifecycleDropdownSelect
                    label="Country / Primary Hub"
                    value={country}
                    onChange={(val) => setCountry(val)}
                    options={FORWARDER_COUNTRY_OPTIONS.filter((c) => c !== "All Countries").map(
                      (c) => ({
                        value: c,
                        label: c,
                      }),
                    )}
                    placeholder="Select Country"
                    activeColor="teal"
                    triggerClassName="h-11 w-full text-sm sm:text-[13px] bg-slate-50/60"
                  />
                </div>
              </div>

              {/* Row 2: Contact Person & Role */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => {
                      setContactPerson(e.target.value);
                      if (errors.contactPerson) setErrors((prev) => ({ ...prev, contactPerson: "" }));
                    }}
                    placeholder="e.g. David Sterling"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                  />
                  {errors.contactPerson && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.contactPerson}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Designation / Role
                  </label>
                  <input
                    type="text"
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    placeholder="e.g. Senior Booking Agent"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 3: Email & WhatsApp / Phone */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Direct Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    placeholder="booking@forwarder.com"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                  />
                  {errors.email && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    WhatsApp / Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => {
                      setWhatsapp(e.target.value);
                      if (errors.whatsapp) setErrors((prev) => ({ ...prev, whatsapp: "" }));
                    }}
                    placeholder="+44 20 7946 0912"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                  />
                  {errors.whatsapp && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.whatsapp}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Row 4: Contracted Shipping Lines */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold text-slate-700">
                    Contracted Shipping Lines <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllLines}
                    className="text-[11px] font-bold text-[#0FA3B1] hover:underline cursor-pointer"
                  >
                    Select All ({ALL_SHIPPING_LINES.length})
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SHIPPING_LINES.map((line) => {
                    const isSelected = selectedShippingLines.includes(line);
                    return (
                      <button
                        key={line}
                        type="button"
                        onClick={() => toggleShippingLine(line)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                          isSelected
                            ? "border-[#0FA3B1] bg-[#E8F5F6] text-[#0FA3B1] shadow-2xs ring-1 ring-[#0FA3B1]/20"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[2.5]" />}
                        <span>{line}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.shippingLines && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{errors.shippingLines}</span>
                  </p>
                )}
              </div>

              {/* Row 5: Notes */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-slate-600">
                  Operational Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Preferred for MSC UK-Pakistan routes with guaranteed space."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                />
              </div>

              {/* Row 6: Status Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div>
                  <p className="text-[12px] font-bold text-slate-800">Forwarder Status</p>
                  <p className="text-[11px] text-slate-500">
                    Active partners receive automated quotation requests and booking orders
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-full self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setStatus("Active")}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer",
                      status === "Active"
                        ? "bg-white text-emerald-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("Inactive")}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer",
                      status === "Inactive"
                        ? "bg-white text-slate-800 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            {/* STICKY ACTION FOOTER */}
            <div className="p-4 sm:p-5 sm:py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 px-4 rounded-full text-[13px] font-semibold text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#009EE2] hover:bg-[#0089c7] px-5 sm:px-6 text-[13px] font-bold text-white shadow-md shadow-[#009EE2]/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
                <span>{editForwarder ? "Save Changes" : "Register Forwarder"}</span>
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
