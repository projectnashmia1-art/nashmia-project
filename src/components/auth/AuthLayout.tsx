import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Anchor, Container, Globe2, ShieldCheck, Ship } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-[#FFFFFF] text-[#000000] selection:bg-[#E8F1F3] selection:text-[#6A80A9] flex flex-col justify-between overflow-x-hidden">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(232,241,243,0.85),rgba(255,255,255,0))]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-32 -left-32 z-0 size-96 rounded-full bg-[#E8F1F3]/50 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -top-32 -right-32 z-0 size-96 rounded-full bg-[#C7D5BF]/25 blur-3xl"
        aria-hidden="true"
      />

      {/* Top minimal bar with logo */}
      <header className="relative z-20 w-full px-6 py-5 sm:px-10 lg:px-12 flex items-center justify-between">
        <Link
          to="/"
          className="group inline-flex items-center gap-3 transition-transform duration-200 active:scale-95"
        >
          <span className="grid size-10 place-items-center rounded-[14px] border border-[#6A80A9]/20 bg-[#E8F1F3] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] text-[#6A80A9] transition-all duration-300 group-hover:scale-105 group-hover:border-[#6A80A9]/40">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" strokeWidth="1.75">
              <rect
                x="2.5"
                y="7.5"
                width="12"
                height="9"
                rx="2"
                stroke="currentColor"
                className="opacity-90"
              />
              <path d="M6.5 7.5v9M10.5 7.5v9" stroke="currentColor" className="opacity-45" />
              <path
                d="M16.5 12h5M19 9.5 21.5 12 19 14.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="text-left">
            <p className="text-[14.5px] font-bold leading-none tracking-[0.14em] text-[#000000]">
              NASHMIA
            </p>
            <p className="mt-1 text-[9.5px] font-semibold leading-none tracking-[0.22em] text-slate-400">
              INDUSTRIES
            </p>
            <p className="mt-1 text-[8.5px] font-bold leading-none tracking-[0.3em] text-[#6A80A9]">
              LOGISTICS
            </p>
          </div>
        </Link>

        {/* Top Right Quick Link */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-slate-200/80 bg-white/70 px-3.5 py-1.5 text-[12.5px] font-medium text-slate-600 shadow-2xs backdrop-blur-md transition-all hover:bg-white hover:text-black"
          >
            <span>Overview Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main split content container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
        <div className="grid w-full max-w-[1240px] grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* LEFT SIDE: Premium Logistics Visual & Brand Atmosphere (Desktop only / compact on tablet) */}
          <div className="hidden lg:col-span-6 lg:flex flex-col justify-center space-y-7 pr-4">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6A80A9]/20 bg-[#E8F1F3]/80 px-3.5 py-1.5 text-[12px] font-semibold text-[#6A80A9] shadow-2xs backdrop-blur-md w-fit">
              <ShieldCheck className="size-3.5" />
              <span>Enterprise Grade Logistics Operating System</span>
            </div>

            {/* Main Hero Statement */}
            <div className="space-y-3">
              <h2 className="text-[36px] font-extrabold tracking-[-0.035em] text-[#000000] leading-[1.15] xl:text-[42px]">
                Container logistics, voyage intelligence & customs orchestration.
              </h2>
              <p className="max-w-[500px] text-[15px] text-slate-500 leading-relaxed">
                Connect ocean booking agents, verified suppliers, agreed rate cards, and buyer
                consignments in one unified high-contrast workspace.
              </p>
            </div>

            {/* Decorative Glass Feature Cards */}
            <div className="grid grid-cols-2 gap-3.5 pt-2 max-w-[520px]">
              <div className="rounded-[18px] border border-white/80 bg-white/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.03)] backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-[10px] bg-[#E8F1F3] text-[#6A80A9]">
                    <Ship className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Live Ocean
                    </p>
                    <p className="text-[13.5px] font-bold text-black truncate">
                      87 Vessels Tracking
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-white/80 bg-white/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.03)] backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-[10px] bg-[#C7D5BF]/40 text-[#2B3B24]">
                    <Container className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Active Cargo
                    </p>
                    <p className="text-[13.5px] font-bold text-black truncate">248 Containers</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Quote / Security Note */}
            <div className="flex items-center gap-3 pt-2 text-[12.5px] text-slate-500">
              <span className="size-2 rounded-full bg-[#3D5A32]" />
              <span>TLS 1.3 End-to-End Encrypted Session Security</span>
            </div>
          </div>

          {/* RIGHT SIDE: Centered Glass Authentication Card */}
          <div className="flex w-full justify-center lg:col-span-6 lg:justify-end">{children}</div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full px-6 py-4 text-center text-[12px] text-slate-400">
        <p>© {new Date().getFullYear()} Nashmia Industries. All rights reserved.</p>
      </footer>
    </div>
  );
}
