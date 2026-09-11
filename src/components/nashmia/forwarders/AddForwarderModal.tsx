import { useEffect, useState } from "react";
import { Check, CheckCircle2, Send, Ship, X } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [selectedShippingLines, setSelectedShippingLines] = useState<string[]>(["MSC", "Maersk"]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (editForwarder) {
      setName(editForwarder.name);
      setContactPerson(editForwarder.contactPerson);
      setEmail(editForwarder.email);
      setWhatsapp(editForwarder.whatsapp);
      setCountry(editForwarder.country);
      setNotes(editForwarder.notes);
      setStatus(editForwarder.status === "Inactive" ? "Inactive" : "Active");
      setSelectedShippingLines(editForwarder.shippingLines);
    } else {
      setName("");
      setContactPerson("");
      setEmail("");
      setWhatsapp("+44 ");
      setCountry("United Kingdom");
      setNotes("");
      setStatus("Active");
      setSelectedShippingLines(["MSC", "Maersk"]);
    }
    setErrors({});
    setIsSuccess(false);
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
    if (!whatsapp.trim()) newErrors.whatsapp = "WhatsApp number is required";
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
            : country === "United Arab Emirates"
              ? "AE"
              : country === "Pakistan"
                ? "PK"
                : "US";

    const code = editForwarder?.code || `${name.substring(0, 3).toUpperCase()}-FWD`;

    onSaveForwarder(
      {
        name: name.trim(),
        code,
        badge: "Booking Agent",
        contactPerson: contactPerson.trim(),
        contactRole: editForwarder?.contactRole || "Freight Booking Agent",
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

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[24px] border border-white/80 bg-white/95 p-0 shadow-[0_24px_64px_rgba(15,23,42,0.14)] backdrop-blur-2xl sm:max-w-[580px] overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100/80 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-[10px] bg-[#E8F1F3] text-[#6A80A9]">
                <Send className="size-4" />
              </span>
              <DialogTitle className="text-[20px] font-semibold tracking-[-0.02em] text-[#000000]">
                {editForwarder ? "Edit Forwarder" : "Create Forwarder"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[13px] text-slate-500 mt-1">
              Add a booking agent and configure shipping line agreements.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[68vh] overflow-y-auto px-6 py-5 space-y-4">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="grid size-16 place-items-center rounded-full bg-[#C7D5BF]/40 text-[#2B3B24] border border-[#C7D5BF]/80">
                  <CheckCircle2 className="size-8 text-[#3D5A32]" />
                </div>
                <h3 className="mt-3.5 text-[18px] font-semibold text-[#000000]">
                  ✓ {editForwarder ? "Forwarder Updated" : "Forwarder Created"}
                </h3>
                <p className="mt-1 text-[13.5px] text-slate-500">
                  {name} has been saved successfully.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Forwarder Name & Country */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-[#000000]">
                      Forwarder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                      }}
                      placeholder="e.g. ABC Forwarding"
                      className={cn(
                        "h-[44px] w-full rounded-[12px] border bg-white/70 px-3.5 text-[14px] text-black transition-all focus:bg-[#E8F1F3]/40 focus:outline-none",
                        errors.name
                          ? "border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                          : "border-slate-200 focus:border-[#6A80A9] focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)]",
                      )}
                    />
                    {errors.name && (
                      <p className="text-[11.5px] font-medium text-red-500">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-[#000000]">Country</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-[44px] w-full rounded-[12px] border border-slate-200 bg-white/70 px-3.5 text-[14px] text-black transition-all focus:border-[#6A80A9] focus:bg-[#E8F1F3]/40 focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)] focus:outline-none"
                    >
                      {FORWARDER_COUNTRY_OPTIONS.filter((c) => c !== "All Countries").map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Contact Person & Email */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-[#000000]">
                      Contact Person <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => {
                        setContactPerson(e.target.value);
                        if (errors.contactPerson) {
                          setErrors((prev) => ({ ...prev, contactPerson: "" }));
                        }
                      }}
                      placeholder="e.g. John Smith"
                      className={cn(
                        "h-[44px] w-full rounded-[12px] border bg-white/70 px-3.5 text-[14px] text-black transition-all focus:bg-[#E8F1F3]/40 focus:outline-none",
                        errors.contactPerson
                          ? "border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                          : "border-slate-200 focus:border-[#6A80A9] focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)]",
                      )}
                    />
                    {errors.contactPerson && (
                      <p className="text-[11.5px] font-medium text-red-500">
                        {errors.contactPerson}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-[#000000]">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      placeholder="e.g. booking@abc-forwarding.co.uk"
                      className={cn(
                        "h-[44px] w-full rounded-[12px] border bg-white/70 px-3.5 text-[14px] text-black transition-all focus:bg-[#E8F1F3]/40 focus:outline-none",
                        errors.email
                          ? "border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                          : "border-slate-200 focus:border-[#6A80A9] focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)]",
                      )}
                    />
                    {errors.email && (
                      <p className="text-[11.5px] font-medium text-red-500">{errors.email}</p>
                    )}
                  </div>
                </div>

                {/* 3. WhatsApp & Status */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-[#000000]">
                      WhatsApp Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => {
                        setWhatsapp(e.target.value);
                        if (errors.whatsapp) setErrors((prev) => ({ ...prev, whatsapp: "" }));
                      }}
                      placeholder="e.g. +44 7700 900077"
                      className={cn(
                        "h-[44px] w-full rounded-[12px] border bg-white/70 px-3.5 text-[14px] text-black transition-all focus:bg-[#E8F1F3]/40 focus:outline-none",
                        errors.whatsapp
                          ? "border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
                          : "border-slate-200 focus:border-[#6A80A9] focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)]",
                      )}
                    />
                    {errors.whatsapp && (
                      <p className="text-[11.5px] font-medium text-red-500">{errors.whatsapp}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12.5px] font-semibold text-[#000000]">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                      className="h-[44px] w-full rounded-[12px] border border-slate-200 bg-white/70 px-3.5 text-[14px] text-black transition-all focus:border-[#6A80A9] focus:bg-[#E8F1F3]/40 focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)] focus:outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* 4. Shipping Lines (Multi-Select Searchable Chips) */}
                <div className="space-y-2 rounded-[16px] border border-[#6A80A9]/20 bg-[#E8F1F3]/30 p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[12.5px] font-bold text-[#000000] flex items-center gap-1.5">
                      <Ship className="size-3.5 text-[#6A80A9]" />
                      <span>Connected Shipping Lines</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {selectedShippingLines.length} selected
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {ALL_SHIPPING_LINES.map((line) => {
                      const isSelected = selectedShippingLines.includes(line);
                      return (
                        <button
                          key={line}
                          type="button"
                          onClick={() => toggleShippingLine(line)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium transition-all shadow-2xs",
                            isSelected
                              ? "bg-[#6A80A9] text-white shadow-[0_2px_8px_rgba(106,128,169,0.3)]"
                              : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300",
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                          <span>{line}</span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.shippingLines && (
                    <p className="text-[11.5px] font-medium text-red-500">{errors.shippingLines}</p>
                  )}
                </div>

                {/* 5. Notes & Dispatch Guidelines */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-[#000000]">
                    Operational Notes & Communication SLA
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Direct contract for UK-PK lanes. Vessel cutoff reminders required 48h in advance."
                    className="w-full rounded-[12px] border border-slate-200 bg-white/70 p-3 text-[13.5px] text-black transition-all focus:border-[#6A80A9] focus:bg-[#E8F1F3]/40 focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)] focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          {!isSuccess && (
            <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-[44px] rounded-[12px] border border-slate-200 bg-white px-5 text-[13.5px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-[44px] rounded-[12px] bg-[#000000] px-6 text-[13.5px] font-medium text-[#FFFFFF] shadow-md hover:bg-slate-900 transition-all hover:scale-[1.01]"
              >
                {editForwarder ? "Save Changes" : "Create Forwarder"}
              </button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
