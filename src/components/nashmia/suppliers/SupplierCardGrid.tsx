import { SupplierAccountFull } from "@/lib/suppliers-data";
import { AddSupplierCard } from "./AddSupplierCard";
import { SupplierCard } from "./SupplierCard";

interface SupplierCardGridProps {
  suppliers: SupplierAccountFull[];
  onSelectSupplier: (supplier: SupplierAccountFull) => void;
  onEditSupplier: (supplier: SupplierAccountFull) => void;
  onToggleArchive: (supplierId: string) => void;
  onAddSupplier: () => void;
}

export function SupplierCardGrid({
  suppliers,
  onSelectSupplier,
  onEditSupplier,
  onToggleArchive,
  onAddSupplier,
}: SupplierCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 animate-in fade-in-50 duration-300">
      {/* 1. First Item: Special + Add Supplier Card */}
      <AddSupplierCard onClick={onAddSupplier} />

      {/* 2. Suppliers Grid: Strictly 3 cards per row on desktop */}
      {suppliers.map((supplier, index) => (
        <SupplierCard
          key={supplier.id}
          supplier={supplier}
          index={index}
          onSelect={onSelectSupplier}
          onEdit={onEditSupplier}
          onToggleArchive={onToggleArchive}
        />
      ))}
    </div>
  );
}
