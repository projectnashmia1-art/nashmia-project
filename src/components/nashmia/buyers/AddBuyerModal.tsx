import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  Plus,
  Sparkles,
  User,
  X,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BuyerAccountFull, COUNTRY_FILTER_OPTIONS } from "@/lib/buyers-data";
import { toast } from "sonner";

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
  const [createdBuyerName, setCreatedBuyerName] = useState("");

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
    } else {
      setName("");
      setCompany("");
      setCountry("United Kingdom");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setErrors({});
      setShowSuccessScreen(false);
    }
  }, [editBuyer, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Buyer account name is required";
    if (!company.trim()) newErrors.company = "Company entity is required";
    if (!contactPerson.trim()) newErrors.contactPerson = "Primary contact person is required";
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
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

    const code = editBuyer?.code || `${name.slice(0, 2).toUpperCase()}-${countryCode}`;

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
    setCreatedBuyerName(name.trim());
    setShowSuccessScreen(true);

    setTimeout(() => {
      onOpenChange(false);
      setShowSuccessScreen(false);
    }, 1400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] rounded-2xl border border-slate-200/90 bg-white p-7 shadow-2xl">
        {showSuccessScreen ? (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-xs">
              <CheckCircle2 className="size-9" />
            </div>
            <h3 className="mt-4 text-[22px] font-bold text-slate-900 tracking-tight">
              {editBuyer ? "Buyer Profile Updated" : "✓ Buyer Registered"}
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-slate-500">
              <strong className="text-slate-900">{createdBuyerName}</strong> has been{" "}
              {editBuyer ? "successfully updated" : "added to the live directory"}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader className="space-y-1.5 text-left">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-[#C7E8E8] bg-[#E8F5F6] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0FA3B1]">
                  {editBuyer ? "Edit Consignee Profile" : "+ New Buyer Account"}
                </span>
              </div>
              <DialogTitle className="text-[22px] font-bold tracking-tight text-slate-900">
                {editBuyer ? "Update Buyer Profile" : "Register New Buyer"}
              </DialogTitle>
              <DialogDescription className="text-[13.5px] text-slate-500">
                {editBuyer
                  ? "Modify buyer enterprise details and contact credentials."
                  : "Fill in account details to establish a new consignee in your network."}
              </DialogDescription>
            </DialogHeader>

            {/* FORM FIELDS */}
            <div className="mt-6 space-y-4">
              {/* Buyer Name & Company */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-slate-700">
                    Buyer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. New Henna Ltd"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 focus:outline-none"
                  />
                  {errors.name && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
                      <AlertCircle className="size-3" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-slate-700">
                    Legal Company <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Haji Trading Global LLC"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 focus:outline-none"
                  />
                  {errors.company && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
                      <AlertCircle className="size-3" />
                      <span>{errors.company}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Country & Contact Person */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-slate-700">
                    Destination Country <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-medium text-slate-900 transition-all duration-150 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 focus:outline-none"
                  >
                    {COUNTRY_FILTER_OPTIONS.filter((c) => c !== "All Countries").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-slate-700">
                    Primary Contact Person <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 focus:outline-none"
                  />
                  {errors.contactPerson && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
                      <AlertCircle className="size-3" />
                      <span>{errors.contactPerson}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Email Address & Phone Number */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-slate-700">
                    Direct Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="consignee@company.com"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 focus:outline-none"
                  />
                  {errors.email && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
                      <AlertCircle className="size-3" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-slate-700">
                    Phone / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 20 7946 0000"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 focus:border-[#0FA3B1] focus:ring-2 focus:ring-[#0FA3B1]/20 focus:outline-none"
                  />
                  {errors.phone && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500">
                      <AlertCircle className="size-3" />
                      <span>{errors.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <DialogFooter className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5 sm:justify-between">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[13.5px] font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="flex h-11 items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-6 text-[13.5px] font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="size-4" />
                <span>{editBuyer ? "Save Changes" : "Register Buyer"}</span>
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
