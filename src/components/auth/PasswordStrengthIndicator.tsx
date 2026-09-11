import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePasswordRules } from "./auth-utils";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    strengthLabel,
    strengthPercent,
    strengthColor,
  } = validatePasswordRules(password);

  const rules = [
    { label: "8+ characters", valid: hasMinLength },
    { label: "Uppercase letter", valid: hasUppercase },
    { label: "Lowercase letter", valid: hasLowercase },
    { label: "Number (0-9)", valid: hasNumber },
  ];

  if (!password) {
    return (
      <div className="mt-2 grid grid-cols-2 gap-1.5 pt-1 text-[11.5px] text-slate-400">
        {rules.map((rule) => (
          <div key={rule.label} className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-slate-300" />
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2.5 space-y-2 rounded-[12px] border border-[#6A80A9]/15 bg-[#E8F1F3]/30 p-2.5 backdrop-blur-sm transition-all duration-200">
      {/* Strength meter bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span>Password strength</span>
          <span
            className={cn(
              "font-medium",
              strengthPercent === 100 ? "text-[#3D5A32]" : "text-slate-500",
            )}
          >
            {strengthLabel}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
          <div
            className={cn("h-full transition-all duration-300 ease-out", strengthColor)}
            style={{ width: `${strengthPercent}%` }}
          />
        </div>
      </div>

      {/* Interactive checklist */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11.5px]">
        {rules.map((rule) => (
          <div
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 font-medium transition-colors duration-150",
              rule.valid ? "text-[#2B3B24]" : "text-slate-400",
            )}
          >
            {rule.valid ? (
              <span className="grid size-3.5 place-items-center rounded-full bg-[#C7D5BF] text-[#2B3B24]">
                <Check className="size-2.5 stroke-[3]" />
              </span>
            ) : (
              <span className="grid size-3.5 place-items-center rounded-full bg-slate-200 text-slate-400">
                <X className="size-2.5 stroke-[2.5]" />
              </span>
            )}
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
