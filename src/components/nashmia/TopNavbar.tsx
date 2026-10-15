import {
  Bell,
  ChevronDown,
  Container,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Ship,
  SlidersHorizontal,
  Sparkles,
  User,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AINotificationCenter } from "@/components/nashmia/AINotificationCenter";
import { NotificationCenterTrigger } from "@/components/nashmia/NotificationCenterTrigger";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { SupabaseStatusIndicator } from "./SupabaseStatusIndicator";
import { UserProfile } from "@/components/auth/UserProfile";
import { GlobalSearch } from "@/components/nashmia/search/GlobalSearch";
import { purgeAllDataAndReload } from "@/lib/cache/purge-legacy-cache";

interface TopNavbarProps {
  onOpenMobileMenu?: () => void;
}

export function TopNavbar({ onOpenMobileMenu }: TopNavbarProps) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { unreadCount, isMounted } = useNotifications();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : "Nashmia Logistics");
  const displayEmail = profile?.email || user?.email || "";
  const displayRole = profile?.role ? profile.role.toUpperCase() : "OPERATIONS";
  const avatarLetter = (displayName?.[0] || user?.email?.[0] || "N").toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate({ to: "/login" });
    } catch (err: unknown) {
      toast.error("Sign out error", {
        description: err instanceof Error ? err.message : "Failed to sign out",
      });
      navigate({ to: "/login" });
    }
  };

  return (
    <header
      id="top-navigation-bar"
      className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between bg-transparent px-4 sm:px-6 transition-all"
    >
      {/* Left: App Title & Branding */}
      <div className="flex items-center gap-3 sm:gap-4">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Toggle navigation menu"
            className="grid size-8.5 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-2xs transition-all hover:bg-slate-100 lg:hidden cursor-pointer"
          >
            <Menu className="size-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-2xs">
            <Ship className="size-4 text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-white bg-emerald-500" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[14.5px] font-bold tracking-tight text-slate-900 sm:text-[15.5px]">
                Nashmia Operations
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-100/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 sm:inline-flex">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <span className="hidden text-[11px] font-normal text-slate-400 md:inline">
              Global Container Logistics &amp; Freight Command
            </span>
          </div>
        </div>
      </div>

      {/* Center: Quick Search */}
      <div className="hidden max-w-md flex-1 px-6 md:block">
        <GlobalSearch variant="navbar" />
      </div>

      {/* Right: Actions & User Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Supabase Connection Status Indicator */}
        <SupabaseStatusIndicator />

        {/* Quick Booking Button */}
        <Link
          to="/new-booking"
          className="hidden h-8.5 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-slate-800 active:scale-95 sm:inline-flex"
        >
          <Plus className="size-3.5" />
          <span>New Booking</span>
        </Link>

        {/* Notifications Button */}
        <NotificationCenterTrigger
          id="top-notifications-button"
          className="grid size-8.5 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-2xs transition-all hover:bg-slate-100 hover:text-slate-900"
          iconClassName="size-4"
        />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              id="user-profile-button"
              className="flex h-8.5 items-center gap-2 rounded-xl border border-slate-200/80 bg-white py-1 pl-1.5 pr-2.5 text-slate-800 shadow-2xs transition-all hover:bg-slate-50 focus:outline-none cursor-pointer"
            >
              <div className="relative">
                <span className="grid size-6.5 place-items-center rounded-lg bg-slate-900 text-[11px] font-bold text-white shadow-2xs">
                  {avatarLetter}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full border border-white bg-emerald-500" />
              </div>

              <div className="hidden text-left sm:block">
                <p className="text-[12px] font-semibold leading-tight text-slate-900 truncate max-w-[90px]">
                  {displayName.split(" ")[0]}
                </p>
                <p className="text-[9.5px] font-medium leading-none text-slate-400 uppercase">
                  {displayRole}
                </p>
              </div>

              <ChevronDown className="size-3 text-slate-400" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 rounded-2xl border border-slate-200/80 bg-white p-1.5 text-slate-700 shadow-xl"
          >
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-slate-900 text-[12px] font-bold text-white">
                  {avatarLetter}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-slate-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-[10.5px] text-slate-500 truncate">{displayEmail}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem
              asChild
              className="cursor-pointer gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Link to="/settings">
                <User className="size-4 text-slate-400" />
                <span>Profile &amp; Account</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Link to="/settings">
                <SlidersHorizontal className="size-4 text-slate-400" />
                <span>System Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                toast.loading("Purging client storage and reloading from Supabase...", {
                  duration: 1000,
                });
                setTimeout(() => {
                  purgeAllDataAndReload();
                }, 400);
              }}
              className="cursor-pointer gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
            >
              <Sparkles className="size-4 text-amber-600" />
              <span>Purge Cache &amp; Reload</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 transition-colors"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User Profile Modal Dialog */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent
          hideCloseButton
          className="w-full sm:max-w-xl p-0 overflow-hidden border-0 bg-transparent shadow-none sm:rounded-2xl"
        >
          <DialogTitle className="sr-only">User Profile &amp; Supabase Authentication</DialogTitle>
          <UserProfile onClose={() => setIsProfileModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
