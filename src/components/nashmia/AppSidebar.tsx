import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Activity,
  Anchor,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Container,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  Receipt,
  Route as RouteIcon,
  Send,
  Settings,
  Ship,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { UserProfile } from "@/components/auth/UserProfile";

export type Tone = "blue" | "teal" | "sage" | "amber" | "rose" | "violet" | "indigo" | "cyan";

export const tone: Record<Tone, { text: string; chip: string; ring: string; bar: string }> = {
  blue: {
    text: "text-tone-blue",
    chip: "bg-tone-blue/14",
    ring: "border-tone-blue/22",
    bar: "bg-tone-blue/60",
  },
  teal: {
    text: "text-tone-teal",
    chip: "bg-tone-teal/14",
    ring: "border-tone-teal/22",
    bar: "bg-tone-teal/60",
  },
  sage: {
    text: "text-tone-sage",
    chip: "bg-tone-sage/14",
    ring: "border-tone-sage/22",
    bar: "bg-tone-sage/60",
  },
  amber: {
    text: "text-tone-amber",
    chip: "bg-tone-amber/16",
    ring: "border-tone-amber/24",
    bar: "bg-tone-amber/60",
  },
  rose: {
    text: "text-tone-rose",
    chip: "bg-tone-rose/14",
    ring: "border-tone-rose/22",
    bar: "bg-tone-rose/60",
  },
  violet: {
    text: "text-tone-violet",
    chip: "bg-tone-violet/14",
    ring: "border-tone-violet/22",
    bar: "bg-tone-violet/60",
  },
  indigo: {
    text: "text-tone-indigo",
    chip: "bg-tone-indigo/14",
    ring: "border-tone-indigo/22",
    bar: "bg-tone-indigo/60",
  },
  cyan: {
    text: "text-tone-cyan",
    chip: "bg-tone-cyan/14",
    ring: "border-tone-cyan/22",
    bar: "bg-tone-cyan/60",
  },
};

type NavItem = {
  label: string;
  icon: LucideIcon;
  badge?: string;
  href?: string;
};

type NavSection = { title: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    title: "Operations",
    items: [
      { label: "New Booking", icon: Plus, href: "/new-booking" },
      { label: "Bookings", icon: Container, href: "/" },
      {
        label: "Requests",
        icon: ClipboardList,
        href: "/requests",
        badge: "6",
      },
      { label: "In Transit", icon: Ship },
      { label: "Arrivals", icon: Anchor },
    ],
  },
  {
    title: "Directory",
    items: [
      { label: "Buyers", icon: Users, href: "/buyers" },
      { label: "Suppliers", icon: Warehouse, href: "/suppliers" },
      { label: "Forwarders", icon: Send, href: "/forwarders" },
      { label: "Shipping Lines", icon: RouteIcon },
    ],
  },
  { title: "Commercial", items: [{ label: "Rate Cards", icon: Receipt }] },
  {
    title: "Records",
    items: [
      { label: "Documents", icon: FileText },
      { label: "Emails", icon: Mail, href: "/emails" },
      { label: "Activity", icon: Activity },
    ],
  },
  {
    title: "System",
    items: [{ label: "Settings", icon: Settings, href: "/settings" }],
  },
];

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)] ring-2 ring-white/60 transition-transform duration-300 hover:scale-105",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5 text-[#0FA3B1]" fill="none" strokeWidth="2.2">
        <rect
          x="3"
          y="7"
          width="11"
          height="10"
          rx="2"
          stroke="currentColor"
          className="opacity-95"
        />
        <path d="M7 7v10M10.5 7v10" stroke="currentColor" className="opacity-60" />
        <path
          d="M16 12h5M18.5 9.5 21 12l-2.5 2.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  const location = useLocation();

  // Exactly matching current active route
  const isCurrentActive =
    item.href !== undefined &&
    (item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href));

  // Collapsed view (Vertical capsule pill with smooth morphing transition on active and hover)
  if (collapsed) {
    const collapsedContent = (
      <div className="flex justify-center py-1">
        {isCurrentActive ? (
          <div className="relative flex flex-col items-center justify-center w-[58px] py-2.5 rounded-[26px] bg-[#FFFFFF] text-[#0FA3B1] shadow-[0_8px_24px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.9)] transition-all duration-300 ease-out">
            <Icon className="size-[20px] stroke-[2.4] text-[#0FA3B1] transition-transform duration-300" />
            <span className="mt-1 text-[9.5px] font-bold tracking-tight text-[#0FA3B1] leading-none select-none">
              {item.label.split(" ")[0]}
            </span>
            {item.badge && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#078A99] px-1 text-[9px] font-bold text-white shadow-xs">
                {item.badge}
              </span>
            )}
          </div>
        ) : (
          <div className="group relative flex flex-col items-center justify-center size-11 rounded-[22px] text-white/90 transition-all duration-300 ease-out hover:bg-white hover:text-[#0FA3B1] hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] hover:scale-105 active:scale-95">
            <Icon className="size-[19px] stroke-[1.9] text-white/90 group-hover:text-[#0FA3B1] group-hover:stroke-[2.2] transition-colors duration-300" />
            {item.badge && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-[#C7E8E8] ring-2 ring-[#0FA3B1] group-hover:bg-[#0FA3B1] group-hover:ring-white transition-all duration-300" />
            )}
          </div>
        )}
      </div>
    );

    const row = item.href ? (
      <Link
        to={item.href}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[26px]"
      >
        {collapsedContent}
      </Link>
    ) : (
      <button
        type="button"
        className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[26px]"
      >
        {collapsedContent}
      </button>
    );

    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="rounded-xl border border-white/20 bg-[#078A99] text-white shadow-lg text-xs font-semibold px-3 py-1.5 backdrop-blur-md"
        >
          {item.label}
          {item.badge ? ` (${item.badge})` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded View - active or hover converts smoothly into pure white pill with dark text & teal icon
  const inner = (
    <div
      className={cn(
        "group/nav relative flex h-11 items-center gap-3 rounded-[24px] px-3.5 transition-all duration-300 ease-out cursor-pointer select-none",
        isCurrentActive
          ? "bg-[#FFFFFF] text-[#000000] shadow-[0_8px_24px_rgba(0,0,0,0.10),0_0_0_1px_rgba(255,255,255,0.95)]"
          : "text-white/90 hover:bg-[#FFFFFF] hover:text-[#000000] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.9)] hover:translate-x-[2px]",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center transition-all duration-300",
          isCurrentActive ? "text-[#0FA3B1]" : "text-white/90 group-hover/nav:text-[#0FA3B1]",
        )}
      >
        <Icon
          className={cn(
            "size-[18px] transition-all duration-300",
            isCurrentActive ? "stroke-[2.4]" : "stroke-[1.8] group-hover/nav:stroke-[2.2]",
          )}
        />
      </span>

      <span
        className={cn(
          "truncate text-[13.5px] transition-colors duration-300",
          isCurrentActive
            ? "font-bold text-[#000000]"
            : "font-medium text-white/95 group-hover/nav:font-bold group-hover/nav:text-[#000000]",
        )}
      >
        {item.label}
      </span>

      {item.badge && (
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold transition-all duration-300",
            isCurrentActive
              ? "bg-[#E8F5F6] text-[#078A99]"
              : "bg-white/20 text-white group-hover/nav:bg-[#E8F5F6] group-hover/nav:text-[#078A99]",
          )}
        >
          {item.badge}
        </span>
      )}
    </div>
  );

  return item.href ? (
    <Link
      to={item.href}
      className="block outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[24px]"
    >
      {inner}
    </Link>
  ) : (
    <button
      type="button"
      className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[24px]"
    >
      {inner}
    </button>
  );
}

function SidebarBody({
  collapsed,
  onToggle,
  showToggle = true,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
}) {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split("@")[0] : "Nashmia Logistics");
  const userRole = profile?.role || (user?.user_metadata?.role as string) || "Operations";
  const initial = (displayName.charAt(0) || user?.email?.charAt(0) || "N").toUpperCase();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate({ to: "/login" });
    } catch {
      toast.success("Signed out");
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden select-none">
      {/* Subtle Botanical / Fluid Ambient Shapes in Background */}
      <div
        className="pointer-events-none absolute -bottom-10 -left-10 size-48 rounded-full bg-white/5 blur-2xl"
        aria-hidden
      />
      <div className="pointer-events-none absolute bottom-4 -left-2 opacity-15" aria-hidden>
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
          <path d="M20 90C20 50 60 20 90 20C90 60 50 90 20 90Z" fill="#C7E8E8" />
          <path d="M10 100C10 65 45 40 75 40C75 75 40 100 10 100Z" fill="#E8F5F6" />
        </svg>
      </div>

      {/* TOP BRAND AREA */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-3 px-4 pb-4 pt-5",
          collapsed ? "justify-center px-0" : "justify-between",
        )}
      >
        <div className="flex items-center gap-3">
          <BrandMark />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[14.5px] font-bold leading-none tracking-[0.14em] text-white drop-shadow-xs">
                NASHMIA
              </p>
              <p className="mt-1 text-[9.5px] font-medium leading-none tracking-[0.22em] text-white/80">
                INDUSTRIES
              </p>
              <p className="mt-1.5 text-[8.5px] font-bold leading-none tracking-[0.28em] text-[#C7E8E8]">
                LOGISTICS
              </p>
            </div>
          )}
        </div>

        {!collapsed && showToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid size-7 place-items-center rounded-full text-white/80 transition-all hover:bg-white/15 hover:text-white"
          >
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>

      {/* EXPAND BUTTON IN COLLAPSED MODE */}
      {collapsed && showToggle && (
        <div className="relative z-10 flex justify-center pb-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="grid size-7 place-items-center rounded-full text-white/80 transition-all hover:bg-white/20 hover:text-white"
          >
            <ChevronsRight className="size-4" />
          </button>
        </div>
      )}

      {/* DIVIDER */}
      <div className="mx-4 h-px bg-white/15" />

      {/* NAVIGATION ITEMS */}
      <nav className="relative z-10 flex-1 space-y-4 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[9.5px] font-bold uppercase tracking-[0.2em] text-white/60">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavRow key={item.label} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* DIVIDER */}
      <div className="mx-4 h-px bg-white/15" />

      {/* BOTTOM SECTION: USER PROFILE & LOGOUT */}
      <div className="relative z-10 p-3">
        {collapsed ? (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="mx-auto flex size-10 items-center justify-center rounded-full bg-white text-[#0FA3B1] font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:scale-105 transition-transform"
              >
                {initial}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="rounded-xl border border-white/20 bg-[#078A99] text-white shadow-lg text-xs font-semibold px-3 py-1.5"
            >
              {displayName} ({userRole})
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 rounded-[20px] bg-white/10 p-2 border border-white/15 backdrop-blur-xs transition-colors hover:bg-white/15">
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[12px] font-bold text-[#0FA3B1] shadow-xs">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-white leading-tight">
                  {displayName}
                </p>
                <p className="truncate text-[10.5px] font-medium text-white/75 capitalize leading-tight">
                  {userRole}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              className="grid size-7 shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            >
              <LogOut className="size-3.5 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* User Profile Modal Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-0 bg-transparent shadow-none sm:rounded-[22px]">
          <DialogTitle className="sr-only">User Profile & Metadata</DialogTitle>
          <UserProfile onClose={() => setIsProfileOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <TooltipProvider>
      <aside
        style={{
          width: collapsed ? 80 : 252,
          height: "calc(100vh - 88px)",
          willChange: "width",
        }}
        className="fixed left-3 top-[76px] z-20 hidden overflow-hidden rounded-[26px] bg-gradient-to-b from-[#0FA3B1] via-[#0D98A6] to-[#078A99] text-white shadow-[0_16px_44px_rgba(15,163,177,0.22),0_0_0_1px_rgba(255,255,255,0.18)] transition-[width] duration-250 ease-out lg:block"
      >
        <SidebarBody collapsed={collapsed} onToggle={onToggle} />
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebar({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (isControlled) {
      onOpenChange?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  return (
    <TooltipProvider>
      {!isControlled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="fixed bottom-5 left-5 z-50 grid size-12 place-items-center rounded-full bg-[#0FA3B1] text-white shadow-[0_12px_32px_rgba(15,163,177,0.35)] ring-2 ring-white/70 lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      )}

      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/25 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed left-3 top-[76px] z-50 w-[252px] overflow-hidden rounded-[26px] bg-gradient-to-b from-[#0FA3B1] via-[#0D98A6] to-[#078A99] text-white shadow-[0_20px_50px_rgba(15,163,177,0.28)] ring-1 ring-white/20 transition-transform duration-250 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-[115%]",
        )}
        style={{ height: "calc(100vh - 88px)", willChange: "transform" }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-full text-white/80 hover:bg-white/20 hover:text-white"
        >
          <X className="size-4" />
        </button>
        <SidebarBody collapsed={false} showToggle={false} />
      </aside>
    </TooltipProvider>
  );
}
