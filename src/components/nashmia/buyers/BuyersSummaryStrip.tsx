import { Activity, CheckCircle2, Container, Globe2, TrendingUp, Users } from "lucide-react";

interface BuyersSummaryStripProps {
  totalBuyers: number;
  activeBuyers: number;
  withActiveMovements: number;
  totalCountries: number;
}

export function BuyersSummaryStrip({
  totalBuyers,
  activeBuyers,
  withActiveMovements,
  totalCountries,
}: BuyersSummaryStripProps) {
  const activeRate = totalBuyers > 0 ? Math.round((activeBuyers / totalBuyers) * 100) : 0;

  const cards = [
    {
      label: "TOTAL BUYERS",
      value: totalBuyers,
      sublabel: "Registered accounts",
      badge: "+1 this month",
      badgeType: "positive" as const,
      icon: Users,
      iconBg: "bg-[#E8F5F6]",
      iconBorder: "border-[#C7E8E8]",
      iconColor: "text-[#0FA3B1]",
      topLine: "from-[#0FA3B1] to-[#45DFEB]",
    },
    {
      label: "ACTIVE ACCOUNTS",
      value: activeBuyers,
      sublabel: `${activeRate}% active engagement`,
      badge: "Live Network",
      badgeType: "emerald" as const,
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconBorder: "border-emerald-200/80",
      iconColor: "text-emerald-600",
      topLine: "from-emerald-500 to-teal-400",
    },
    {
      label: "WITH MOVEMENTS",
      value: withActiveMovements,
      sublabel: "Allocated containers",
      badge: "Active routing",
      badgeType: "indigo" as const,
      icon: Container,
      iconBg: "bg-indigo-50",
      iconBorder: "border-indigo-200/80",
      iconColor: "text-indigo-600",
      topLine: "from-indigo-500 to-blue-400",
    },
    {
      label: "GLOBAL DESTINATIONS",
      value: totalCountries,
      sublabel: "UK, PK, EU & US corridors",
      badge: "6 Corridors",
      badgeType: "cyan" as const,
      icon: Globe2,
      iconBg: "bg-cyan-50",
      iconBorder: "border-cyan-200/80",
      iconColor: "text-cyan-600",
      topLine: "from-cyan-500 to-sky-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03),0_8px_20px_-6px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08)]"
          >
            {/* Top Accent Gradient Line on Hover */}
            <div
              className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${card.topLine} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
            />

            {/* Top Row: Icon + Label + Badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-11 place-items-center rounded-xl border ${card.iconBorder} ${card.iconBg} ${card.iconColor} transition-transform duration-200 group-hover:scale-105`}
                >
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {card.label}
                  </p>
                  <p className="text-[12px] text-slate-500">{card.sublabel}</p>
                </div>
              </div>

              {card.badgeType === "emerald" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {card.badge}
                </span>
              ) : card.badgeType === "indigo" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {card.badge}
                </span>
              ) : card.badgeType === "cyan" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                  {card.badge}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C7E8E8] bg-[#E8F5F6] px-2 py-0.5 text-[11px] font-semibold text-[#0FA3B1]">
                  <TrendingUp className="size-3" />
                  {card.badge}
                </span>
              )}
            </div>

            {/* Metric Value */}
            <div className="mt-4 flex items-baseline justify-between">
              <span className="num text-[32px] font-bold tracking-tight text-slate-900 leading-none">
                {card.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
