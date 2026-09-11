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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AINotificationCenter } from "@/components/nashmia/AINotificationCenter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { SupabaseStatusIndicator } from "./SupabaseStatusIndicator";
import { UserProfile } from "@/components/auth/UserProfile";

interface TopNavbarProps {
  onOpenMobileMenu?: () => void;
}

export function TopNavbar({ onOpenMobileMenu }: TopNavbarProps) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { unreadCount, isMounted } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");
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
      className="glass-apple fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/80 px-4 sm:px-6 backdrop-blur-2xl transition-all"
    >
      {/* Left: App Title & Branding */}
      <div className="flex items-center gap-3 sm:gap-4">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Toggle navigation menu"
            className="grid size-9 place-items-center rounded-[12px] border border-white/70 bg-white/50 text-ink transition-all hover:bg-white/80 lg:hidden"
          >
            <Menu className="size-4" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="relative grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink text-background shadow-[0_4px_14px_oklch(0_0_0/0.25)]">
            <Ship className="size-4.5 text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-white bg-sage" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold tracking-[-0.01em] text-ink sm:text-[16px]">
                Nashmia Operations Hub
              </span>
              <span className="hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary sm:inline-flex">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Live Hub
              </span>
            </div>
            <span className="hidden text-[11px] font-medium tracking-[0.06em] text-muted-foreground md:inline">
              Global Container Logistics & Freight Command
            </span>
          </div>
        </div>
      </div>

      {/* Center: Quick Search */}
      <div className="hidden max-w-md flex-1 px-6 md:block">
        <div className="glass-apple-subtle flex h-10 w-full items-center gap-2.5 rounded-[12px] border border-white/80 px-3.5 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search operations"
            placeholder="Search containers, vessels, bookings, cut-offs..."
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/75"
          />
          <kbd className="hidden rounded-[6px] border border-white/90 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-xs lg:inline-block">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Actions & User Profile Placeholder */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Supabase Connection Status Indicator */}
        <SupabaseStatusIndicator />

        {/* Quick Booking Button */}
        <Link
          to="/new-booking"
          className="hidden h-9 items-center gap-1.5 rounded-[12px] bg-ink px-3 text-[12.5px] font-semibold text-background shadow-[0_6px_20px_oklch(0_0_0/0.2)] transition-all duration-200 ease-glass hover:-translate-y-0.5 hover:shadow-[0_10px_24px_oklch(0_0_0/0.25)] sm:inline-flex"
        >
          <Plus className="size-3.5" />
          <span>New Booking</span>
        </Link>

        {/* Notifications Button */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              id="top-notifications-button"
              aria-label="Notifications"
              className="glass-apple-subtle relative grid size-9.5 place-items-center rounded-[12px] border border-white/80 text-foreground transition-all duration-200 ease-glass hover:-translate-y-0.5 hover:bg-white/80 focus:outline-none"
            >
              <Bell className="size-4" />
              {isMounted && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#0FA3B1] px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(15,163,177,0.4)] ring-2 ring-white animate-in zoom-in-50">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-auto p-0 border-0 bg-transparent shadow-none"
          >
            <AINotificationCenter />
          </PopoverContent>
        </Popover>

        {/* User Profile Placeholder Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              id="user-profile-button"
              className="glass-apple-subtle flex h-9.5 items-center gap-2 rounded-[14px] border border-white/80 py-1 pl-1.5 pr-2.5 transition-all duration-200 ease-glass hover:-translate-y-0.5 hover:bg-white/80 focus:outline-none"
            >
              <div className="relative">
                <span className="grid size-7 place-items-center rounded-full border border-white/90 bg-primary/16 text-[12px] font-bold text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                  {avatarLetter}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-white bg-sage" />
              </div>

              <div className="hidden text-left sm:block">
                <p className="text-[12.5px] font-semibold leading-tight text-ink truncate max-w-[100px]">
                  {displayName.split(" ")[0]}
                </p>
                <p className="text-[10px] font-medium leading-none text-muted-foreground">
                  {displayRole}
                </p>
              </div>

              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="glass-apple w-56 rounded-[18px] border border-white/80 p-1.5 shadow-xl"
          >
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full border border-white/90 bg-primary/16 text-[13px] font-bold text-primary">
                  {avatarLetter}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink truncate">{displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{displayEmail}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/80" />
            <DropdownMenuItem
              asChild
              className="cursor-pointer gap-2.5 rounded-[10px] px-3 py-2 text-[12.5px] font-medium text-foreground transition-colors focus:bg-white/70"
            >
              <Link to="/settings">
                <User className="size-4 text-muted-foreground" />
                <span>Profile & Account</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer gap-2.5 rounded-[10px] px-3 py-2 text-[12.5px] font-medium text-foreground transition-colors focus:bg-white/70"
            >
              <Link to="/settings">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                <span>System Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/80" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer gap-2.5 rounded-[10px] px-3 py-2 text-[12.5px] font-medium text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User Profile Modal Dialog */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-0 bg-transparent shadow-none sm:rounded-[22px]">
          <DialogTitle className="sr-only">User Profile & Supabase Authentication</DialogTitle>
          <UserProfile onClose={() => setIsProfileModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
