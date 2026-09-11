import { Activity, CheckCircle2, Container, MapPin, Warehouse } from "lucide-react";

interface SuppliersSummaryStripProps {
  totalCount?: number;
  activeCount?: number;
  loadPointsCount?: number;
  activeMovementsCount?: number;
}

export function SuppliersSummaryStrip({
  totalCount = 28,
  activeCount = 25,
  loadPointsCount = 31,
  activeMovementsCount = 19,
}: SuppliersSummaryStripProps) {
  const cards = [
    {
      title: "Total Suppliers",
      value: totalCount,
      label: "Registered Vendors",
      icon: Warehouse,
      iconBg: "bg-[#E8F5F6]",
      iconBorder: "border-[#C7E8E8]",
      iconColor: "text-[#0FA3B1]",
      textColor: "text-slate-900",
    },
    {
      title: "Active Accounts",
      value: activeCount,
      label: "Verified & Operational",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconBorder: "border-emerald-200",
      iconColor: "text-emerald-600",
      textColor: "text-emerald-700",
    },
    {
      title: "Active Pickup Points",
      value: loadPointsCount,
      label: "Origin Warehouses",
      icon: MapPin,
      iconBg: "bg-cyan-50",
      iconBorder: "border-cyan-200",
      iconColor: "text-cyan-600",
      textColor: "text-slate-900",
    },
    {
      title: "Active Movements",
      value: activeMovementsCount,
      label: "In Cargo Pipeline",
      icon: Container,
      iconBg: "bg-indigo-50",
      iconBorder: "border-indigo-200",
      iconColor: "text-indigo-600",
      textColor: "text-indigo-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="group relative rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {card.title}
              </span>
              <div
                className={`grid size-9 place-items-center rounded-xl border ${card.iconBorder} ${card.iconBg} ${card.iconColor} shadow-2xs group-hover:scale-105 transition-transform`}
              >
                <Icon className="size-4.5" />
              </div>
            </div>

            <div className="mt-3">
              <p
                className={`font-mono text-2xl sm:text-3xl font-bold tracking-tight ${card.textColor}`}
              >
                {card.value}
              </p>
              <p className="mt-1 text-[11.5px] font-medium text-slate-400 truncate">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
