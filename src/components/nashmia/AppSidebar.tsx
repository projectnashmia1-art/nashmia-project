import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
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
  Send,
  Settings,
  Users,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

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
    ],
  },
  {
    title: "Directory",
    items: [
      { label: "Buyers", icon: Users, href: "/buyers" },
      { label: "Suppliers", icon: Warehouse, href: "/suppliers" },
      { label: "Forwarders", icon: Send, href: "/forwarders" },
    ],
  },
  {
    title: "Commercial",
    items: [{ label: "Rate Cards", icon: Receipt, href: "/rate-cards" }],
  },
  {
    title: "Records",
    items: [
      { label: "Documents", icon: FileText, href: "/documents" },
      { label: "Emails", icon: Mail, href: "/emails" },
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
        "grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)] ring-2 ring-white/60 transition-transform duration-200 hover:scale-105",
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

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const location = useLocation();

  // Exactly matching current active route
  const isCurrentActive =
    item.href !== undefined &&
    (item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href));

  // Collapsed view: Self-contained icon + compact label, zero horizontal clipping, zero blocking
  if (collapsed) {
    const collapsedContent = (
      <div className="flex justify-center py-0.5">
        {isCurrentActive ? (
          <div className="relative flex flex-col items-center justify-center w-[54px] py-1.5 rounded-[20px] bg-white text-[#0FA3B1] shadow-[0_6px_20px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.9)] transition-all duration-200 ease-out">
            <Icon className="size-[18px] stroke-[2.4] text-[#0FA3B1]" />
            <span className="mt-1 text-[8.5px] font-bold tracking-tight text-[#0FA3B1] leading-none select-none">
              {item.label.split(" ")[0]}
            </span>
            {item.badge && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#078A99] px-1 text-[9px] font-bold text-white shadow-xs">
                {item.badge}
              </span>
            )}
          </div>
        ) : (
          <div className="relative flex flex-col items-center justify-center w-[54px] py-1.5 rounded-[20px] text-white/90 transition-all duration-150 ease-out hover:bg-white/20 hover:text-white hover:scale-105 active:scale-95">
            <Icon className="size-[18px] stroke-[1.9] text-white/90 transition-colors duration-150" />
            <span className="mt-1 text-[8px] font-medium tracking-tight text-white/80 leading-none select-none">
              {item.label.split(" ")[0]}
            </span>
            {item.badge && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-[#C7E8E8] ring-2 ring-[#0FA3B1] transition-all duration-150" />
            )}
          </div>
        )}
      </div>
    );

    const innerNode = item.href ? (
      <Link
        to={item.href}
        onClick={onNavigate}
        title={item.label}
        aria-label={item.label}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[20px]"
      >
        {collapsedContent}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onNavigate}
        title={item.label}
        aria-label={item.label}
        className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[20px] cursor-pointer"
      >
        {collapsedContent}
      </button>
    );

    return <div className="relative flex justify-center">{innerNode}</div>;
  }

  // Expanded View - active or hover converts smoothly into pure white pill with dark text & teal icon
  const inner = (
    <div
      className={cn(
        "group/nav relative flex h-10.5 items-center gap-3 rounded-[22px] px-3.5 transition-colors duration-150 ease-out cursor-pointer",
        isCurrentActive
          ? "bg-[#FFFFFF] text-[#000000] shadow-[0_8px_24px_rgba(0,0,0,0.10),0_0_0_1px_rgba(255,255,255,0.95)]"
          : "text-white/90 hover:bg-[#FFFFFF] hover:text-[#000000] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08),0_0_0_1px_rgba(255,255,255,0.9)] hover:translate-x-[2px]",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center transition-colors duration-150",
          isCurrentActive ? "text-[#0FA3B1]" : "text-white/90 group-hover/nav:text-[#0FA3B1]",
        )}
      >
        <Icon className="size-[18px] stroke-[2.2]" />
      </span>

      <span
        className={cn(
          "min-w-0 flex-1 text-[13px] font-semibold tracking-tight transition-colors duration-150 truncate whitespace-nowrap",
          isCurrentActive
            ? "text-slate-900 font-bold"
            : "text-white group-hover/nav:text-slate-900",
        )}
      >
        {item.label}
      </span>

      {item.badge && (
        <span
          className={cn(
            "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold transition-colors duration-150",
            isCurrentActive
              ? "bg-[#0FA3B1] text-white"
              : "bg-white/20 text-white group-hover/nav:bg-[#0FA3B1] group-hover/nav:text-white",
          )}
        >
          {item.badge}
        </span>
      )}
    </div>
  );

  if (item.href) {
    return (
      <Link
        to={item.href}
        onClick={onNavigate}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[22px]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-[22px] cursor-pointer"
    >
      {inner}
    </button>
  );
}

function SidebarBody({
  collapsed,
  onToggle,
  showToggle = true,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
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
    <div className="relative flex h-full flex-col overflow-hidden">
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
          "relative z-10 flex items-center gap-3 px-4 pb-3.5 pt-4.5 select-none",
          collapsed ? "justify-center px-0" : "justify-between",
        )}
      >
        <div className="flex items-center gap-3">
          <BrandMark />
          {!collapsed && (
            <div className="min-w-0 overflow-hidden whitespace-nowrap">
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
            className="grid size-7 place-items-center rounded-full text-white/80 transition-all hover:bg-white/15 hover:text-white cursor-pointer"
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
            className="grid size-7 place-items-center rounded-full text-white/80 transition-all hover:bg-white/20 hover:text-white cursor-pointer"
          >
            <ChevronsRight className="size-4" />
          </button>
        </div>
      )}

      {/* DIVIDER */}
      <div className="mx-4 h-px bg-white/15" />

      {/* NAVIGATION ITEMS: Buttery-Smooth, Non-Sticking, Contained Scroll */}
      <nav className="relative z-10 flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-3 py-3 scroll-smooth touch-pan-y [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/35">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[9.5px] font-bold uppercase tracking-[0.2em] text-white/60 select-none">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavRow
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
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
          <div className="flex justify-center">
            <Link
              to="/settings"
              onClick={onNavigate}
              aria-label="Account Settings"
              title={`${displayName} (${userRole})`}
              className="mx-auto flex size-10 items-center justify-center rounded-full bg-white text-[#0FA3B1] font-bold text-sm shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:scale-105 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {initial}
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-[20px] bg-white/10 p-2 border border-white/15 backdrop-blur-xs transition-colors hover:bg-white/15">
            <Link
              to="/settings"
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left group/profile"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[12px] font-bold text-[#0FA3B1] shadow-xs group-hover/profile:scale-105 transition-transform">
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
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="grid size-7 shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({
  collapsed: propCollapsed,
  onToggle: propOnToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
} = {}) {
  const [hookCollapsed, hookToggle] = useSidebarCollapsed();
  const isControlled = propCollapsed !== undefined;
  const collapsed = isControlled ? propCollapsed : hookCollapsed;
  const onToggle = propOnToggle ?? hookToggle;

  return (
    <aside
      style={{
        width: collapsed ? 76 : 256,
        willChange: "width",
      }}
      aria-label="Main Navigation"
      className="fixed left-3.5 top-3.5 bottom-3.5 z-30 isolate hidden overflow-hidden rounded-[26px] bg-gradient-to-b from-[#0FA3B1] via-[#0D98A6] to-[#078A99] text-white shadow-[0_16px_44px_rgba(15,163,177,0.22),0_0_0_1px_rgba(255,255,255,0.18)] transition-[width] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex lg:flex-col"
    >
      <SidebarBody collapsed={collapsed} onToggle={onToggle} />
    </aside>
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
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="fixed bottom-5 left-5 z-40 grid size-12 place-items-center rounded-full bg-[#0FA3B1] text-white shadow-[0_12px_32px_rgba(15,163,177,0.35)] ring-2 ring-white/70 lg:hidden cursor-pointer"
        >
          <Menu className="size-5" />
        </button>
      )}

      {/* Dim backdrop with blur - safely below modals (z-40) */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-250 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0 invisible",
        )}
      />

      {/* Mobile Drawer - isolated stacking context at z-40, below modals (z-50) */}
      <aside
        aria-label="Mobile Navigation"
        className={cn(
          "fixed left-3.5 top-3.5 bottom-3.5 z-40 isolate w-[268px] max-w-[calc(100vw-28px)] overflow-hidden rounded-[26px] bg-gradient-to-b from-[#0FA3B1] via-[#0D98A6] to-[#078A99] text-white shadow-[0_20px_50px_rgba(15,163,177,0.35)] ring-1 ring-white/20 transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden flex flex-col",
          open
            ? "translate-x-0 opacity-100 visible"
            : "-translate-x-[115%] opacity-0 invisible pointer-events-none",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="absolute right-3.5 top-3.5 z-20 grid size-8 place-items-center rounded-full text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
        <SidebarBody collapsed={false} showToggle={false} onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
