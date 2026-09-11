import { forwardRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  id: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-[13px] font-semibold text-[#000000] tracking-tight"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Lock className="size-4 stroke-[1.8]" aria-hidden="true" />
          </div>

          <input
            ref={ref}
            id={id}
            type={showPassword ? "text" : "password"}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(
              "h-[46px] w-full rounded-[14px] border bg-white/70 pl-10 pr-11 text-[14px] text-[#000000] placeholder:text-slate-400 transition-all duration-200 backdrop-blur-md",
              "focus:bg-[#E8F1F3]/40 focus:outline-none",
              error
                ? "border-red-400/80 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.14)]"
                : "border-slate-200/80 focus:border-[#6A80A9] focus:shadow-[0_0_0_3px_rgba(106,128,169,0.14)]",
              className,
            )}
            {...props}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none focus-visible:text-[#6A80A9]"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? (
              <EyeOff className="size-4 stroke-[1.8]" />
            ) : (
              <Eye className="size-4 stroke-[1.8]" />
            )}
          </button>
        </div>

        {error && (
          <p
            id={`${id}-error`}
            className="text-[11.5px] font-medium text-red-500 animate-in fade-in duration-150"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
