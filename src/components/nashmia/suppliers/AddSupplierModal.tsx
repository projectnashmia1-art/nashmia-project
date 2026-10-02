import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Plus,
  User,
  Warehouse,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierAccountFull, SUPPLIER_COUNTRY_OPTIONS } from "@/lib/suppliers-data";
import { ResultSuccessView } from "@/components/nashmia/common/ResultSuccessView";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import { cn } from "@/lib/utils";

interface AddSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSupplier: (data: Omit<SupplierAccountFull, "id" | "createdAt">, editId?: string) => void;
  editSupplier?: SupplierAccountFull | null;
}

export function AddSupplierModal({
  open,
  onOpenChange,
  onSaveSupplier,
  editSupplier,
}: AddSupplierModalProps) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [loadPoint, setLoadPoint] = useState("");
  const [loadPointType, setLoadPointType] =
    useState<SupplierAccountFull["loadPointType"]>("Warehouse");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedEntity, setSavedEntity] = useState<{ name: string; code: string } | null>(null);

  // Populate form when editing or opening
  useEffect(() => {
    if (editSupplier) {
      setName(editSupplier.name);
      setCountry(editSupplier.country);
      setLoadPoint(editSupplier.loadPoint);
      setLoadPointType(editSupplier.loadPointType);
      setContactPerson(editSupplier.contactPerson);
      setEmail(editSupplier.email);
      setPhone(editSupplier.phone);
      setStatus(editSupplier.status === "Inactive" ? "Inactive" : "Active");
      setIsSuccess(false);
      setSavedEntity(null);
    } else {
      setName("");
      setCountry("United Kingdom");
      setLoadPoint("");
      setLoadPointType("Warehouse");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setStatus("Active");
      setIsSuccess(false);
      setSavedEntity(null);
    }
    setErrors({});
  }, [editSupplier, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Supplier name is required";
    if (!loadPoint.trim()) newErrors.loadPoint = "Load point or warehouse is required";
    if (!contactPerson.trim()) newErrors.contactPerson = "Contact person is required";
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const countryCode =
      country === "United Kingdom"
        ? "GB"
        : country === "Spain"
          ? "ES"
          : country === "France"
            ? "FR"
            : country === "Germany"
              ? "DE"
              : country === "Italy"
                ? "IT"
                : country === "Netherlands"
                  ? "NL"
                  : country === "Pakistan"
                    ? "PK"
                    : "US";

    const code =
      editSupplier?.code || `SUP-${countryCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    onSaveSupplier(
      {
        name: name.trim(),
        subtitle: "Pickup Vendor",
        companyName: editSupplier?.companyName || `${name.trim()} Ltd`,
        country,
        countryCode,
        loadPoint: loadPoint.trim(),
        loadPointCity: loadPoint.trim().split(" ")[0],
        loadPointType,
        contactPerson: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || "+44 20 7946 0000",
        status,
        code,
        address: editSupplier?.address || `${loadPoint.trim()}, ${country}`,
        city: editSupplier?.city || country,
        activeContainers: editSupplier ? editSupplier.activeContainers : 0,
        containersDelta: editSupplier ? editSupplier.containersDelta : "0 this month",
        totalContainersMoved: editSupplier ? editSupplier.totalContainersMoved : 0,
      },
      editSupplier?.id,
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
          "w-[95vw] max-w-[95vw] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-100 bg-white shadow-2xl focus:outline-none",
          isSuccess && "sm:max-w-[420px]",
        )}
      >
        {isSuccess ? (
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[88vh]">
            <ResultSuccessView
              type="success"
              title="Success!"
              message={`Thank you for waiting. Your supplier data has been ${
                editSupplier ? "updated" : "approved"
              }.`}
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

            {/* Clean Minimal Header (Non-shrinking) */}
            <DialogHeader className="p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 shrink-0 bg-white space-y-1.5 text-left pr-10">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5F6] px-3 py-1 text-[11px] font-bold text-[#0FA3B1] w-fit">
                <span className="size-1.5 rounded-full bg-[#0FA3B1]" />
                {editSupplier ? "Edit Supplier Profile" : "Origin Supplier"}
              </div>
              <DialogTitle className="text-xl sm:text-[22px] font-extrabold tracking-tight text-[#0D1F3C]">
                {editSupplier ? "Update Supplier Profile" : "Add Supplier Profile"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-[13px] font-medium text-slate-500">
                {editSupplier
                  ? "Modify vendor dispatch warehouse, facility type, and direct contact."
                  : "Configure dispatch location, contact person, and booking status."}
              </DialogDescription>
            </DialogHeader>

            {/* SCROLLABLE FORM INPUTS */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 [scrollbar-width:thin]">
              {/* Row 1: Name & Country */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Supplier Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder="e.g. Apex Global Logistics"
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
                    label="Country"
                    value={country}
                    onChange={(val) => setCountry(val)}
                    options={SUPPLIER_COUNTRY_OPTIONS.filter((c) => c !== "All Countries").map(
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

              {/* Row 2: Load Point & Facility Type */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Primary Load Point / Facility <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={loadPoint}
                      onChange={(e) => {
                        setLoadPoint(e.target.value);
                        if (errors.loadPoint) setErrors((prev) => ({ ...prev, loadPoint: "" }));
                      }}
                      placeholder="e.g. Felixstowe Cargo Hub, Gate 4"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                    />
                  </div>
                  {errors.loadPoint && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.loadPoint}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <LifecycleDropdownSelect
                    label="Facility Type"
                    value={loadPointType}
                    onChange={(val) =>
                      setLoadPointType(val as SupplierAccountFull["loadPointType"])
                    }
                    options={[
                      { value: "Warehouse", label: "Warehouse" },
                      { value: "Factory", label: "Factory" },
                      { value: "Terminal", label: "Terminal" },
                      { value: "Depot", label: "Depot" },
                    ]}
                    placeholder="Select Type"
                    activeColor="teal"
                    triggerClassName="h-11 w-full text-sm sm:text-[13px] bg-slate-50/60"
                  />
                </div>
              </div>

              {/* Row 3: Contact Person */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-slate-600">
                  Primary Contact Person <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => {
                    setContactPerson(e.target.value);
                    if (errors.contactPerson) setErrors((prev) => ({ ...prev, contactPerson: "" }));
                  }}
                  placeholder="e.g. David Sterling (Dispatch Lead)"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                />
                {errors.contactPerson && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{errors.contactPerson}</span>
                  </p>
                )}
              </div>

              {/* Row 4: Email & Phone */}
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
                    placeholder="dispatch@supplier.com"
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
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 20 7946 0912"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 5: Status Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div>
                  <p className="text-[12px] font-bold text-slate-800">Dispatch Status</p>
                  <p className="text-[11px] text-slate-500">
                    Active suppliers can be assigned immediately to ocean bookings
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
                <span>{editSupplier ? "Save Changes" : "Add Supplier"}</span>
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
