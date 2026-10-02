import { useEffect, useState } from "react";
import {
  Building2,
  ChevronDown,
  Globe2,
  Mail,
  Phone,
  Plus,
  User,
  X,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BuyerAccountFull, COUNTRY_FILTER_OPTIONS } from "@/lib/buyers-data";
import { ResultSuccessView } from "@/components/nashmia/common/ResultSuccessView";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import { cn } from "@/lib/utils";

interface AddBuyerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveBuyer: (data: Omit<BuyerAccountFull, "id" | "createdAt">, editId?: string) => void;
  editBuyer?: BuyerAccountFull | null;
}

export function AddBuyerModal({ open, onOpenChange, onSaveBuyer, editBuyer }: AddBuyerModalProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [savedEntity, setSavedEntity] = useState<{ name: string; code: string } | null>(null);

  // Sync edit buyer into form state
  useEffect(() => {
    if (editBuyer) {
      setName(editBuyer.name);
      setCompany(editBuyer.company);
      setCountry(editBuyer.country);
      setContactPerson(editBuyer.contactPerson);
      setEmail(editBuyer.email);
      setPhone(editBuyer.phone);
      setErrors({});
      setShowSuccessScreen(false);
      setSavedEntity(null);
    } else {
      setName("");
      setCompany("");
      setCountry("United Kingdom");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setErrors({});
      setShowSuccessScreen(false);
      setSavedEntity(null);
    }
  }, [editBuyer, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Buyer name is required";
    if (!company.trim()) newErrors.company = "Company entity is required";
    if (!contactPerson.trim()) newErrors.contactPerson = "Contact person is required";
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!phone.trim()) newErrors.phone = "Phone number is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const countryCode =
      country === "United Kingdom"
        ? "GB"
        : country === "Pakistan"
          ? "PK"
          : country === "Spain"
            ? "ES"
            : country === "Germany"
              ? "DE"
              : country === "Italy"
                ? "IT"
                : country === "France"
                  ? "FR"
                  : country === "Sweden"
                    ? "SE"
                    : "US";

    const code = editBuyer?.code || `BUY-${countryCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const buyerData: Omit<BuyerAccountFull, "id" | "createdAt"> = {
      name: name.trim(),
      company: company.trim(),
      country,
      countryCode,
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      activeMovements: editBuyer ? editBuyer.activeMovements : 0,
      deltaThisMonth: editBuyer ? editBuyer.deltaThisMonth : "+0 this month",
      progressPercent: editBuyer ? editBuyer.progressPercent : 0,
      totalMovements: editBuyer ? editBuyer.totalMovements : 0,
      deliveredMovements: editBuyer ? editBuyer.deliveredMovements : 0,
      inTransitMovements: editBuyer ? editBuyer.inTransitMovements : 0,
      status: editBuyer ? editBuyer.status : "Active",
      code,
      taxId:
        editBuyer?.taxId || `${countryCode}-${Math.floor(100000000 + Math.random() * 900000000)}`,
      address: editBuyer?.address || `Commercial Freight Corridor, ${country}`,
      city: editBuyer?.city || country,
      recentMovement: editBuyer?.recentMovement,
    };

    onSaveBuyer(buyerData, editBuyer?.id);
    setSavedEntity({ name: name.trim(), code });
    setShowSuccessScreen(true);
  };

  const handleDismiss = () => {
    onOpenChange(false);
    setTimeout(() => {
      setShowSuccessScreen(false);
      setSavedEntity(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-[95vw] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-100 bg-white shadow-2xl focus:outline-none",
          showSuccessScreen && "sm:max-w-[420px]",
        )}
      >
        {showSuccessScreen ? (
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[88vh]">
            <ResultSuccessView
              type="success"
              title="Success!"
              message={`Thank you for waiting. Your buyer data has been ${
                editBuyer ? "updated" : "approved"
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
                {editBuyer ? "Edit Buyer Profile" : "New Consignee"}
              </div>
              <DialogTitle className="text-xl sm:text-[22px] font-extrabold tracking-tight text-[#0D1F3C]">
                {editBuyer ? "Update Buyer Account" : "Add Buyer Account"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-[13px] font-medium text-slate-500">
                {editBuyer
                  ? "Modify consignee contact details and delivery settings."
                  : "Fill in the details below to add a buyer to your active logistics network."}
              </DialogDescription>
            </DialogHeader>

            {/* SCROLLABLE FORM INPUTS */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 [scrollbar-width:thin]">
              {/* Row 1: Buyer Name & Company */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Buyer Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                      }}
                      placeholder="e.g. New Henna Ltd"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                    />
                  </div>
                  {errors.name && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Legal Company <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => {
                        setCompany(e.target.value);
                        if (errors.company) setErrors((prev) => ({ ...prev, company: "" }));
                      }}
                      placeholder="e.g. Global Trading LLC"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                    />
                  </div>
                  {errors.company && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.company}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Country & Contact Person */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <LifecycleDropdownSelect
                    label="Destination Country *"
                    value={country}
                    onChange={(val) => setCountry(val)}
                    options={COUNTRY_FILTER_OPTIONS.filter((c) => c !== "All Countries").map(
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

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => {
                        setContactPerson(e.target.value);
                        if (errors.contactPerson)
                          setErrors((prev) => ({ ...prev, contactPerson: "" }));
                      }}
                      placeholder="e.g. John Smith"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                    />
                  </div>
                  {errors.contactPerson && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.contactPerson}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Row 3: Email & Phone */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Work Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      placeholder="buyer@enterprise.com"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                    />
                  </div>
                  {errors.email && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Phone / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      placeholder="+44 20 7946 0000"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none"
                    />
                  </div>
                  {errors.phone && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.phone}</span>
                    </p>
                  )}
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
                <span>{editBuyer ? "Save Changes" : "Add Buyer"}</span>
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
