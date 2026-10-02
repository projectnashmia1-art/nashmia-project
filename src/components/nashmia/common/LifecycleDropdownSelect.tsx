import React from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface LifecycleDropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (DropdownOption | string)[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  align?: "start" | "end" | "center";
  activeColor?: "teal" | "blue" | "slate";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export function LifecycleDropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  label,
  icon,
  className,
  triggerClassName,
  contentClassName,
  align = "start",
  activeColor = "teal",
  size = "md",
  disabled = false,
}: LifecycleDropdownSelectProps) {
  // Normalize options
  const normalizedOptions: DropdownOption[] = options.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const isSelectedActive = value && value !== "all" && value !== "";

  const sizeClasses = {
    sm: "h-8.5 px-3 text-xs rounded-xl",
    md: "h-[40px] px-3.5 text-[13px] rounded-xl",
    lg: "h-[44px] px-4 text-[13.5px] rounded-xl",
  };

  const activeColorMap = {
    teal: {
      activeBorder: "border-[#0FA3B1]/40 bg-[#E8F5F6] text-[#0FA3B1]",
      checkColor: "text-[#0FA3B1]",
    },
    blue: {
      activeBorder: "border-blue-300 bg-blue-50/80 text-blue-700",
      checkColor: "text-blue-600",
    },
    slate: {
      activeBorder: "border-slate-300 bg-slate-100 text-slate-900",
      checkColor: "text-slate-800",
    },
  };

  const activeConfig = activeColorMap[activeColor] || activeColorMap.teal;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-[11.5px] font-medium text-slate-500 flex items-center gap-1">
          {label}
        </label>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-between gap-2 border font-semibold transition-all duration-200 cursor-pointer select-none",
              sizeClasses[size],
              isSelectedActive
                ? activeConfig.activeBorder
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs",
              disabled && "opacity-50 cursor-not-allowed pointer-events-none",
              triggerClassName,
            )}
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
              <span className="truncate">{displayLabel}</span>
            </div>
            <ChevronDown className="size-3.5 shrink-0 opacity-50 ml-1.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align}
          className={cn(
            "w-56 max-h-[300px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl z-50",
            contentClassName,
          )}
        >
          {normalizedOptions.map((opt) => {
            const isMatch = opt.value === value;
            return (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors",
                  isMatch
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-700 hover:bg-slate-50",
                )}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  {opt.badge}
                  {isMatch && <Check className={cn("size-4", activeConfig.checkColor)} />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
