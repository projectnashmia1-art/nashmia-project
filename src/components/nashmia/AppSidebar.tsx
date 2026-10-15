import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
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
import { useState, useEffect, useCallback } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

export type NavItem = {
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  href: string;
  exact?: boolean;
  roles?: string[];
  description?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAVIGATION_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/",
        exact: true,
        description: "Operations metrics & activity",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "New Booking",
        icon: Plus,
        href: "/new-booking",
        description: "Create export/import container booking",
      },
      {
        label: "Bookings",
        icon: Container,
        href: "/",
        exact: false,
        description: "Active container movements & cut-offs",
      },
      {
        label: "Requests",
        icon: ClipboardList,
        href: "/requests",
        badge: "6",
        description: "Forwarder quotation inquiries",
      },
    ],
  },
  {
    title: "Directory",
    items: [
      {
        label: "Buyers",
        icon: Users,
        href: "/buyers",
        description: "Buyer consignees & accounts",
      },
      {
        label: "Suppliers",
        icon: Warehouse,
        href: "/suppliers",
        description: "Shippers & cargo suppliers",
      },
      {
        label: "Forwarders",
        icon: Send,
        href: "/forwarders",
        description: "Ocean carriers & freight forwarders",
      },
    ],
  },
  {
    title: "Commercial",
    items: [
      {
        label: "Rate Cards",
        icon: Receipt,
        href: "/rate-cards",
        description: "Contracted freight tariff sheets",
      },
    ],
  },
  {
    title: "Records",
    items: [
      {
        label: "Documents",
        icon: FileText,
        href: "/documents",
        description: "Bills of lading, invoices & OCR records",
      },
      {
        label: "Emails",
        icon: Mail,
        href: "/emails",
        description: "Automated quotation inbox & threads",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Settings",
        icon: Settings,
        href: "/settings",
        description: "Organization & workflow preferences",
      },
    ],
  },
];

/**
 * Brand Logo Mark - Circular Pill Container matching reference aesthetic
 */
function BrandMark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="relative flex items-center gap-3 select-none">
      <div
        className={cn(
          "relative grid size-9.5 shrink-0 place-items-center rounded-full bg-white text-slate-900 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-transform duration-200 group-hover:scale-105",
          collapsed && "mx-auto",
        )}
      >
        {/* Minimal Geometric / Maritime Brand Symbol */}
        <svg
          viewBox="0 0 24 24"
          className="size-4.5 text-slate-900"
          fill="none"
          strokeWidth="2.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
          <path d="M7 11v6a2 2 0 0 0 2 2h6" />
        </svg>
        <span className="absolute bottom-0.5 right-0.5 size-2 rounded-full border-2 border-white bg-emerald-500 shadow-2xs" />
      </div>

      {!collapsed && (
        <div className="flex min-w-0 flex-col overflow-hidden text-left transition-opacity duration-200">
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-extrabold tracking-[0.06em] text-slate-900">
              NASHMIA
            </span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8.5px] font-bold tracking-wider text-slate-600">
              LOGISTICS
            </span>
          </div>
          <span className="text-[10.5px] font-medium text-slate-400 truncate">
            Container Operations
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Determines whether a navigation item is active based on exact or nested path
 */
function isItemActive(item: NavItem, currentPath: string): boolean {
  if (!item.href) return false;

  // Root Dashboard vs Bookings disambiguation
  if (item.href === "/") {
    if (item.label === "Dashboard") {
      return currentPath === "/" && !window.location.hash.includes("booking");
    }
    if (item.label === "Bookings") {
      return currentPath === "/" && window.location.hash.includes("booking");
    }
    return currentPath === "/";
  }

  if (item.exact) {
    return currentPath === item.href;
  }

  // Nested routes, dynamic child routes (e.g. /requests/xyz, /documents/xyz)
  return currentPath === item.href || currentPath.startsWith(`${item.href}/`);
}

/**
 * Navigation Row Component - Smooth, Reference-Inspired Circular Icon Navigation
 */
function NavRow({
  item,
  collapsed,
  onNavigate,
  dynamicBadge,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
  dynamicBadge?: string | number;
}) {
  const Icon = item.icon;
  const location = useLocation();
  const currentPath = location.pathname;
  const isActive = isItemActive(item, currentPath);

  const displayBadge = dynamicBadge ?? item.badge;

  // Collapsed Mode: Perfectly Centered Circular Icon Rail
  if (collapsed) {
    return (
      <div className="relative group/nav flex justify-center py-0.5">
        <Link
          to={item.href}
          onClick={onNavigate}
          aria-label={item.label}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "relative flex size-9.5 items-center justify-center rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2",
            isActive
              ? "bg-slate-950 text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)] scale-100 ring-1 ring-black/10"
              : "bg-white text-slate-600 border border-slate-200/70 shadow-2xs hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 hover:shadow-xs hover:scale-105 active:scale-95",
          )}
        >
          <Icon
            className={cn(
              "size-4 shrink-0 transition-transform duration-200 group-hover/nav:scale-105",
              isActive ? "text-white" : "text-slate-600 group-hover/nav:text-slate-900",
            )}
            strokeWidth={isActive ? 2.2 : 1.9}
          />

          {/* Badge Dot for Collapsed Mode */}
          {Boolean(displayBadge) && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[8.5px] font-bold shadow-xs ring-2 ring-white",
                isActive ? "bg-amber-400 text-slate-950 font-extrabold" : "bg-slate-950 text-white",
              )}
            >
              {displayBadge}
            </span>
          )}
        </Link>

        {/* Floating Tooltip positioned immediately to the right */}
        <div
          role="tooltip"
          className="pointer-events-none fixed left-[78px] z-50 hidden rounded-2xl bg-slate-900 px-3 py-1.5 text-left text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md transition-all duration-150 group-hover/nav:flex group-hover/nav:items-center group-hover/nav:gap-2 group-focus-within/nav:flex"
        >
          <div className="flex flex-col">
            <span className="text-[12px] font-semibold text-white whitespace-nowrap">
              {item.label}
            </span>
            {item.description && (
              <span className="text-[10px] font-normal text-slate-300 whitespace-nowrap">
                {item.description}
              </span>
            )}
          </div>
          {Boolean(displayBadge) && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold text-white">
              {displayBadge}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Expanded Mode: Soft Pill Row with circular icon button on the left
  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-10 items-center gap-2.5 rounded-2xl px-2 text-[13px] font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 overflow-hidden",
        isActive
          ? "bg-slate-100/90 text-slate-950 font-semibold shadow-2xs ring-1 ring-slate-200/70"
          : "text-slate-600 hover:bg-slate-50/80 hover:text-slate-950",
      )}
    >
      {/* Circular Icon Pill matching reference */}
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full transition-all duration-200",
          isActive
            ? "bg-slate-950 text-white shadow-xs ring-1 ring-black/10 scale-100"
            : "bg-white text-slate-600 border border-slate-200/80 shadow-2xs group-hover/nav:border-slate-300 group-hover/nav:text-slate-950 group-hover/nav:shadow-xs",
        )}
      >
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200 group-hover/nav:scale-105",
            isActive ? "text-white" : "text-slate-600 group-hover/nav:text-slate-900",
          )}
          strokeWidth={isActive ? 2.2 : 1.9}
        />
      </div>

      <span className="min-w-0 flex-1 truncate whitespace-nowrap">{item.label}</span>

      {Boolean(displayBadge) && (
        <span
          className={cn(
            "ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[9.5px] font-bold tracking-tight transition-colors duration-150 shrink-0",
            isActive
              ? "bg-slate-950 text-white shadow-2xs"
              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 group-hover/nav:bg-slate-200 group-hover/nav:text-slate-900",
          )}
        >
          {displayBadge}
        </span>
      )}
    </Link>
  );
}

/**
 * Sidebar Body - Shared between Desktop Fixed and Mobile Drawer
 */
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
  const { unreadCount } = useNotifications();

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split("@")[0] : "Operations");
  const userRole = (
    profile?.role ||
    (user?.user_metadata?.role as string) ||
    "OPERATIONS"
  ).toUpperCase();
  const userEmail = profile?.email || user?.email || "";
  const initial = (displayName.charAt(0) || userEmail.charAt(0) || "N").toUpperCase();

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
    <div className="relative flex h-full flex-col overflow-hidden bg-white/95 rounded-[26px] border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-slate-700 antialiased select-none backdrop-blur-md">
      {/* TOP BRAND AREA */}
      <div
        className={cn(
          "relative z-10 flex h-14 shrink-0 items-center px-3 border-b border-slate-100/80",
          collapsed ? "justify-center px-1" : "justify-between",
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          aria-label="Nashmia Logistics Home"
          className="group flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-2xl"
        >
          <BrandMark collapsed={collapsed} />
        </Link>

        {!collapsed && showToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="grid size-7.5 place-items-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-800 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-900 border border-slate-100 hover:border-slate-200 shadow-2xs"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        )}
      </div>

      {/* COLLAPSED EXPAND TOGGLE */}
      {collapsed && showToggle && (
        <div className="flex justify-center py-1.5 border-b border-slate-100/80 bg-slate-50/40">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="grid size-7.5 place-items-center rounded-full text-slate-400 transition-all hover:bg-slate-950 hover:text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-900 border border-slate-200/70 shadow-2xs hover:scale-105"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* NAVIGATION SECTIONS: Vertical Icon Rail matching reference */}
      <nav
        aria-label="Primary Navigation"
        className={cn(
          "relative z-10 flex-1 overflow-y-auto overscroll-contain py-2 scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.2)_transparent]",
          collapsed ? "px-1.5 space-y-1" : "px-2.5 space-y-2.5",
        )}
      >
        {NAVIGATION_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2 pb-0.5 pt-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 select-none">
                  {section.title}
                </span>
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavRow
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  dynamicBadge={
                    item.label === "Requests"
                      ? item.badge
                      : item.label === "Emails" && unreadCount > 0
                        ? unreadCount
                        : item.badge
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* BOTTOM USER AREA & SETTINGS MATCHING REFERENCE */}
      <div className="relative z-10 p-2 border-t border-slate-100/80 bg-slate-50/30">
        {collapsed ? (
          <div className="group/user relative flex flex-col items-center gap-1.5">
            {/* Circular Profile Avatar matching reference portrait bottom pill */}
            <Link
              to="/settings"
              onClick={onNavigate}
              aria-label={`User Settings - ${displayName} (${userRole})`}
              className="relative flex size-9 items-center justify-center rounded-full bg-slate-950 font-bold text-xs text-white shadow-[0_3px_10px_rgba(0,0,0,0.16)] transition-transform hover:scale-105 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 border-2 border-white"
            >
              {initial}
              <span className="absolute bottom-0 right-0 size-2 rounded-full border border-white bg-emerald-500 shadow-2xs" />
            </Link>

            {/* User Tooltip for Collapsed Mode */}
            <div
              role="tooltip"
              className="pointer-events-none fixed left-[78px] bottom-3.5 z-50 hidden rounded-2xl bg-slate-900 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md transition-all group-hover/user:block"
            >
              <p className="text-[12px] font-bold text-white leading-tight">{displayName}</p>
              <p className="text-[10px] font-medium text-slate-300">{userEmail}</p>
              <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold text-slate-200">
                {userRole}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-white p-1.5 border border-slate-200/70 shadow-2xs transition-all hover:border-slate-300">
            <Link
              to="/settings"
              onClick={onNavigate}
              className="group/profile flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-slate-900 rounded-xl p-0.5"
            >
              <div className="relative grid size-7.5 shrink-0 place-items-center rounded-full bg-slate-950 text-[11px] font-bold text-white shadow-2xs">
                {initial}
                <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-white bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-slate-900 leading-tight">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9.5px] font-medium text-slate-400 capitalize truncate">
                    {userRole.toLowerCase()}
                  </span>
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="grid size-7 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-rose-500 border border-transparent hover:border-rose-100"
            >
              <LogOut className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Desktop AppSidebar (Fixed Full-Height Sticky Floating Card Layout)
 */
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
      aria-label="Main Navigation"
      style={{
        width: collapsed ? 72 : 260,
        willChange: "width",
      }}
      className={cn(
        "fixed inset-y-0 left-0 z-30 isolate hidden h-screen h-[100dvh] flex-col p-2 transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] lg:flex",
      )}
    >
      <SidebarBody collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
}

/**
 * Mobile Sidebar Drawer (Off-Canvas Sheet)
 */
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

  const setOpen = useCallback(
    (val: boolean) => {
      if (isControlled) {
        onOpenChange?.(val);
      } else {
        setInternalOpen(val);
      }
    },
    [isControlled, onOpenChange],
  );

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="fixed bottom-5 left-5 z-40 grid size-11 place-items-center rounded-full bg-slate-950 text-white shadow-lg ring-2 ring-white lg:hidden cursor-pointer active:scale-95 transition-transform"
        >
          <Menu className="size-5" />
        </button>
      )}

      {/* Backdrop overlay */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity duration-250 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0 invisible",
        )}
      />

      {/* Off-canvas mobile navigation drawer */}
      <aside
        aria-label="Mobile Navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 isolate flex h-full h-[100dvh] w-[270px] max-w-[85vw] flex-col p-2.5 transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] lg:hidden",
          open ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="absolute right-5 top-5 z-20 grid size-7.5 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-900 border border-slate-200/80 bg-white shadow-2xs"
        >
          <X className="size-3.5" />
        </button>

        <SidebarBody collapsed={false} showToggle={false} onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
