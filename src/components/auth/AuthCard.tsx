import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function AuthCard({ title, subtitle, children, footer, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[460px] overflow-hidden rounded-[24px] border border-white/90 bg-white/82 p-7 sm:p-9 shadow-[0_24px_64px_rgba(15,23,42,0.065)] backdrop-blur-[32px] transition-all duration-300",
        className,
      )}
    >
      {/* Subtle top ambient specular light */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-gradient-to-b from-white to-transparent opacity-70 blur-2xl"
        aria-hidden="true"
      />

      {/* Header section */}
      <div className="relative z-10 mb-7 text-left">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-[#000000] leading-tight sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500 font-normal leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Main Form content */}
      <div className="relative z-10">{children}</div>

      {/* Footer navigation (e.g. switch between login & signup) */}
      {footer && (
        <div className="relative z-10 mt-7 pt-5 border-t border-slate-100/90 text-center text-[13px] text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
}
