import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, Warehouse, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierAccountFull, SUPPLIER_COUNTRY_OPTIONS } from "@/lib/suppliers-data";
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
    } else {
      setName("");
      setCountry("United Kingdom");
      setLoadPoint("");
      setLoadPointType("Warehouse");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setStatus("Active");
    }
    setErrors({});
    setIsSuccess(false);
  }, [editSupplier, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Supplier name is required";
    if (!loadPoint.trim()) newErrors.loadPoint = "Primary load point is required";
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

    const code = editSupplier?.code || `SUP-${countryCode}-${Math.floor(10 + Math.random() * 90)}`;

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
        phone: phone.trim() || "+44 000 000000",
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

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[560px] overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5 bg-slate-50/50">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-[#E8F5F6] border border-[#C7E8E8] text-[#0FA3B1]">
                <Warehouse className="size-4.5" />
              </span>
              <div>
                <DialogTitle className="text-[19px] font-bold text-slate-900">
                  {editSupplier ? "Edit Supplier Account" : "Register Origin Supplier"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Configure vendor identity, dispatch warehouse, and contact person.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>Supplier details successfully saved!</span>
            </div>
          )}

          {/* 1. Supplier Name & Country */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Global Logistics"
                className={cn(
                  "h-10 w-full rounded-xl border bg-white px-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0FA3B1] focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15",
                  errors.name ? "border-red-400" : "border-slate-200",
                )}
              />
              {errors.name && <p className="text-[11px] text-red-500 font-medium">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] text-slate-900 transition-all focus:border-[#0FA3B1] focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15"
              >
                {SUPPLIER_COUNTRY_OPTIONS.filter((c) => c !== "All Countries").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Load Point & Loading Type */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700">
                Primary Load Point / Factory <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={loadPoint}
                  onChange={(e) => setLoadPoint(e.target.value)}
                  placeholder="e.g. Felixstowe Cargo Hub, Gate 4"
                  className={cn(
                    "h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0FA3B1] focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15",
                    errors.loadPoint ? "border-red-400" : "border-slate-200",
                  )}
                />
              </div>
              {errors.loadPoint && (
                <p className="text-[11px] text-red-500 font-medium">{errors.loadPoint}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Facility Type</label>
              <select
                value={loadPointType}
                onChange={(e) =>
                  setLoadPointType(e.target.value as SupplierAccountFull["loadPointType"])
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] text-slate-900 transition-all focus:border-[#0FA3B1] focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15"
              >
                <option value="Warehouse">Warehouse</option>
                <option value="Factory">Factory</option>
                <option value="Terminal">Port Terminal</option>
                <option value="Depot">CFS Depot</option>
              </select>
            </div>
          </div>

          {/* 3. Contact Person */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Primary Contact Person <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. David Sterling (Dispatch Manager)"
              className={cn(
                "h-10 w-full rounded-xl border bg-white px-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0FA3B1] focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15",
                errors.contactPerson ? "border-red-400" : "border-slate-200",
              )}
            />
            {errors.contactPerson && (
              <p className="text-[11px] text-red-500 font-medium">{errors.contactPerson}</p>
            )}
          </div>

          {/* 4. Email & Phone */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dispatch@supplier.com"
                className={cn(
                  "h-10 w-full rounded-xl border bg-white px-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0FA3B1] focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15",
                  errors.email ? "border-red-400" : "border-slate-200",
                )}
              />
              {errors.email && (
                <p className="text-[11px] text-red-500 font-medium">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Phone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 20 7946 0912"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0FA3B1] focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15"
              />
            </div>
          </div>

          {/* 5. Status Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div>
              <p className="text-xs font-bold text-slate-900">Account Status</p>
              <p className="text-[11px] text-slate-500">
                Active accounts can immediately be assigned to new container bookings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus("Active")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-bold transition-all",
                  status === "Active"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
                )}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatus("Inactive")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-bold transition-all",
                  status === "Inactive"
                    ? "bg-slate-700 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
                )}
              >
                Inactive
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-5 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {editSupplier ? "Save Changes" : "Register Supplier"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
