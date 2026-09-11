import { BuyerAccountFull } from "@/lib/buyers-data";
import { AddBuyerCard } from "./AddBuyerCard";
import { BuyerCard } from "./BuyerCard";

interface BuyerCardGridProps {
  buyers: BuyerAccountFull[];
  onSelectBuyer: (buyer: BuyerAccountFull) => void;
  onEditBuyer: (buyer: BuyerAccountFull) => void;
  onToggleArchive: (buyerId: string) => void;
  onAddBuyer: () => void;
}

export function BuyerCardGrid({
  buyers,
  onSelectBuyer,
  onEditBuyer,
  onToggleArchive,
  onAddBuyer,
}: BuyerCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 animate-in fade-in-50 duration-300">
      {/* Visual Entry Card: + Add Buyer */}
      <AddBuyerCard onClick={onAddBuyer} />

      {/* Individual Buyer Profile Cards (Strictly 3 per row on desktop) */}
      {buyers.map((buyer, index) => (
        <BuyerCard
          key={buyer.id}
          buyer={buyer}
          index={index}
          onSelect={onSelectBuyer}
          onEdit={onEditBuyer}
          onToggleArchive={onToggleArchive}
        />
      ))}
    </div>
  );
}
