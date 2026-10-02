import { ForwarderAccount } from "@/lib/forwarders-data";
import { AddForwarderCard } from "./AddForwarderCard";
import { ForwarderCard } from "./ForwarderCard";

interface ForwarderCardGridProps {
  forwarders: ForwarderAccount[];
  onSelectForwarder: (forwarder: ForwarderAccount) => void;
  onEditForwarder: (forwarder: ForwarderAccount) => void;
  onToggleArchive: (forwarderId: string) => void;
  onSendTestEmail: (forwarder: ForwarderAccount) => void;
  onAddForwarder: () => void;
}

export function ForwarderCardGrid({
  forwarders,
  onSelectForwarder,
  onEditForwarder,
  onToggleArchive,
  onSendTestEmail,
  onAddForwarder,
}: ForwarderCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 lg:gap-6">
      {/* 1. First Card in Grid: Special + Add Forwarder Card */}
      <AddForwarderCard onAddForwarder={onAddForwarder} />

      {/* 2. Forwarder Business Profile Cards */}
      {forwarders.map((forwarder, idx) => (
        <ForwarderCard
          key={forwarder.id}
          forwarder={forwarder}
          index={idx + 1}
          onSelectForwarder={onSelectForwarder}
          onEditForwarder={onEditForwarder}
          onToggleArchive={onToggleArchive}
          onSendTestEmail={onSendTestEmail}
        />
      ))}
    </div>
  );
}
