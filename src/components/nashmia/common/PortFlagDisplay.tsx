import { memo } from "react";
import { getPortCountryMeta } from "@/lib/port-flags";
import { CountryFlagSvg } from "@/components/nashmia/common/CountryFlagSvg";

interface PortFlagDisplayProps {
  portCode?: string | null;
  portName?: string | null;
  countryHint?: string | null;
  className?: string;
  align?: "left" | "right" | "center";
  showName?: boolean;
  size?: "sm" | "md" | "lg";
}

export const PortFlagDisplay = memo(function PortFlagDisplay({
  portCode,
  portName,
  countryHint,
  className = "",
  align = "left",
  showName = true,
  size = "md",
}: PortFlagDisplayProps) {
  const meta = getPortCountryMeta(portCode, portName, countryHint);
  const code = (portCode || "PORT").trim().toUpperCase();
  const name = portName || meta.countryName || "";

  const isRight = align === "right";
  const isCenter = align === "center";

  const flagSize = size === "sm" ? "xs" : size === "lg" ? "md" : "sm";

  return (
    <div
      className={`min-w-0 flex flex-col ${
        isRight
          ? "items-end text-right"
          : isCenter
            ? "items-center text-center"
            : "items-start text-left"
      } ${className}`}
    >
      {/* Code with Small Country Flag SVG */}
      <div
        className={`inline-flex items-center gap-1.5 font-bold text-slate-900 tracking-tight ${
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-[13.5px]"
        }`}
      >
        {!isRight && (
          <CountryFlagSvg
            countryCode={meta.countryCode}
            size={flagSize}
            title={`${meta.countryName} (${meta.countryCode})`}
          />
        )}

        <span className="font-bold tracking-tight text-slate-900">{code}</span>

        {isRight && (
          <CountryFlagSvg
            countryCode={meta.countryCode}
            size={flagSize}
            title={`${meta.countryName} (${meta.countryCode})`}
          />
        )}
      </div>

      {/* Port Name with Country hint */}
      {showName && name && (
        <p
          className={`line-clamp-1 text-slate-500 font-medium ${
            size === "sm" ? "text-[10.5px]" : "text-[11.5px]"
          }`}
          title={`${name} · ${meta.countryName}`}
        >
          {name}
        </p>
      )}
    </div>
  );
});
