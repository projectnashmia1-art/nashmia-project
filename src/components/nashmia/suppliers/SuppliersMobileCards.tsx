import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Check,
  Container,
  Copy,
  Edit2,
  MapPin,
  MoreHorizontal,
  Plus,
  Warehouse,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupplierAccountFull } from "@/lib/suppliers-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface SuppliersMobileCardsProps {
  suppliers: SupplierAccountFull[];
  onSelectSupplier: (supplier: SupplierAccountFull) => void;
  onEditSupplier: (supplier: SupplierAccountFull) => void;
  onToggleArchive: (supplierId: string) => void;
}

function getAvatarInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function SuppliersMobileCards({
  suppliers,
  onSelectSupplier,
  onEditSupplier,
  onToggleArchive,
}: SuppliersMobileCardsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
      {suppliers.map((supplier) => {
        const initials = getAvatarInitials(supplier.name);
        const isInactive = supplier.status === "Inactive" || supplier.status === "Archived";

        return (
          <div
            key={supplier.id}
            onClick={() => onSelectSupplier(supplier)}
            className={cn(
              "group relative flex cursor-pointer flex-col justify-between rounded-[20px] border border-white/85 bg-white/85 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-all duration-300 active:scale-[0.99]",
              isInactive && "opacity-75 bg-slate-50/70",
            )}
          >
            <div>
              {/* Card Header: Avatar, Name, Status, Three-dot Menu */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[#6A80A9]/20 bg-[#E8F1F3] text-[13px] font-bold text-[#6A80A9]">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[#000000] text-[16px] truncate">
                      {supplier.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[12px] text-slate-400">
                      <span>{supplier.country}</span>
                      <span>·</span>
                      <span className="font-mono">{supplier.code}</span>
                    </div>
                  </div>
                </div>

                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 shrink-0"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${supplier.name}`}
                        className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-black"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-2xl"
                    >
                      <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {supplier.name}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onSelectSupplier(supplier)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <span>View Supplier</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEditSupplier(supplier)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                      >
                        <Edit2 className="size-3.5 text-slate-400" />
                        <span>Edit Supplier</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          to="/new-booking"
                          search={{ supplierId: supplier.id }}
                          className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="size-3.5 text-[#6A80A9]" />
                          <span>Create Booking</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-slate-100" />
                      <DropdownMenuItem
                        onClick={() => onToggleArchive(supplier.id)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100"
                      >
                        {supplier.status === "Active" ? (
                          <>
                            <Archive className="size-3.5 text-amber-600" />
                            <span>Archive</span>
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="size-3.5 text-emerald-600" />
                            <span>Activate</span>
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Status Pill */}
              <div className="mt-2.5 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-tight",
                    supplier.status === "Active"
                      ? "bg-[#C7D5BF]/40 text-[#2B3B24] border border-[#C7D5BF]/60"
                      : "bg-slate-100 text-slate-500 border border-slate-200",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      supplier.status === "Active" ? "bg-[#3D5A32]" : "bg-slate-400",
                    )}
                  />
                  <span>{supplier.status}</span>
                </span>
              </div>

              {/* LOAD POINT (VISUALLY PROMINENT) */}
              <div className="mt-3.5 rounded-[14px] border border-[#6A80A9]/20 bg-[#E8F1F3]/40 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6A80A9]">
                  <Warehouse className="size-3" />
                  <span>Pickup Load Point</span>
                </div>
                <div className="mt-1 flex items-start gap-2">
                  <MapPin className="size-4 text-[#6A80A9] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#000000] text-[13.5px]">
                      {supplier.loadPoint}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">{supplier.address}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="mt-3 flex items-center justify-between text-[12px] text-slate-600 border-t border-slate-100 pt-2.5">
                <div>
                  <p className="font-medium text-[#000000]">{supplier.contactPerson}</p>
                  <p className="text-slate-400 truncate max-w-[190px]">{supplier.email}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => copyToClipboard(supplier.email, "Email", e)}
                  className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100"
                >
                  {copiedField === "Email" ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#000000]">
                <span className="font-mono text-[#6A80A9] font-bold">
                  {supplier.activeContainers}
                </span>
                <span>Active Containers</span>
              </div>

              <div className="flex items-center gap-1 text-[12.5px] font-medium text-[#6A80A9]">
                <span>View</span>
                <ArrowRight className="size-3.5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
