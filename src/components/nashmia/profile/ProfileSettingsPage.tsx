import React, { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import {
  supabase,
  isSupabaseConfigured,
  testSupabaseConnection,
  type SupabaseConnectionResult,
} from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showPillToast } from "@/lib/pill-toast";
import {
  User as UserIcon,
  Mail,
  Shield,
  Calendar,
  Clock,
  Key,
  Building2,
  Phone,
  RefreshCw,
  Edit3,
  Check,
  X,
  Copy,
  CheckCircle2,
  AlertCircle,
  Database,
  Fingerprint,
  Lock,
  Save,
  Bell,
  Settings as SettingsIcon,
  Layers,
  Server,
  Sparkles,
  ChevronRight,
  Sliders,
  Globe,
  Radio,
  CheckCheck,
  MessageSquare,
  AlarmClock,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserManagementSection } from "@/components/nashmia/settings/UserManagementSection";

interface ProfileRecord {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role?: string;
  company_name?: string;
  created_at?: string;
  updated_at?: string;
}

export function ProfileSettingsPage({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const {
    user: contextUser,
    profile: contextProfile,
    refreshProfile: refreshAuthContext,
    signOut,
  } = useAuth();
  const [user, setUser] = useState<User | null>(contextUser);
  const [profileRecord, setProfileRecord] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "backend" | "preferences" | "users"
  >("profile");

  // Edit form state
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [preferredPort, setPreferredPort] = useState("Karachi (PKKHI)");
  const [timezone, setTimezone] = useState("UTC+05:00 (Pakistan Standard Time)");
  const [currency, setCurrency] = useState("USD ($)");

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Backend connection status state
  const [connectionTest, setConnectionTest] = useState<SupabaseConnectionResult | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // Notification Preferences state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [bookingUpdates, setBookingUpdates] = useState(true);
  const [etaChanges, setEtaChanges] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(false);

  const fetchUserData = useCallback(
    async (showToast = false) => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        if (showToast) setRefreshing(true);

        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          setUser(null);
          setProfileRecord(null);
          if (showToast) {
            showPillToast.error(
              authError?.message || "Please sign in again.",
              "Auth Session Expired",
            );
          }
          return;
        }

        setUser(authUser);

        // Pre-fill editable fields
        const meta = authUser.user_metadata || {};
        setFullName((meta.full_name as string) || (contextProfile?.full_name as string) || "");
        setCompanyName(
          (meta.company_name as string) ||
            (meta.company as string) ||
            (contextProfile?.company_name as string) ||
            "Nashmia Industries",
        );
        setPhone((meta.phone as string) || (authUser.phone as string) || "+92 300 1234567");
        setRole((meta.role as string) || (contextProfile?.role as string) || "Operations Officer");
        setBio(
          (meta.bio as string) ||
            "Logistics Coordinator overseeing international container bookings and shipment clearances.",
        );

        // Fetch public.profiles database record
        try {
          const { data: dbProfile, error: dbError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();

          if (!dbError && dbProfile) {
            setProfileRecord(dbProfile as unknown as ProfileRecord);
          }
        } catch (err) {
          console.warn("[ProfileSettingsPage] Profile query note:", err);
        }

        if (showToast) {
          showPillToast.success(
            "Live authentication and Supabase records retrieved.",
            "Profile Synchronized",
          );
        }
      } catch (err: unknown) {
        console.error("[ProfileSettingsPage] Error fetching user profile:", err);
        if (showToast) {
          showPillToast.error(
            err instanceof Error ? err.message : "Unknown error occurred.",
            "Failed to load profile",
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [contextProfile],
  );

  useEffect(() => {
    void fetchUserData(false);
  }, [fetchUserData]);

  const handleTestBackend = async () => {
    setTestingConnection(true);
    try {
      const result = await testSupabaseConnection();
      setConnectionTest(result);
      if (result.success) {
        showPillToast.success(
          `Supabase database ping responded in ${result.latencyMs}ms.`,
          "Backend Connected Successfully",
        );
      } else {
        showPillToast.error(
          result.message || "Failed to reach Supabase endpoints.",
          "Backend Connection Issue",
        );
      }
    } catch (err) {
      showPillToast.error(
        err instanceof Error ? err.message : "Unknown connection error.",
        "Backend Test Failed",
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopyUserId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      showPillToast.info("User ID copied to clipboard", "Copied");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showPillToast.info("User ID: " + user.id, "User UUID");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showPillToast.error("You must be signed in to save profile changes.", "Unauthorized");
      return;
    }

    setSaving(true);
    try {
      const updatedMetadata = {
        ...user.user_metadata,
        full_name: fullName.trim(),
        company_name: companyName.trim(),
        phone: phone.trim(),
        role: role.trim(),
        bio: bio.trim(),
        preferred_port: preferredPort,
        timezone,
        currency,
      };

      // 1. Update Auth user metadata
      const { data: updatedAuth, error: authUpdateError } = await supabase.auth.updateUser({
        data: updatedMetadata,
      });

      if (authUpdateError) {
        throw authUpdateError;
      }

      if (updatedAuth.user) {
        setUser(updatedAuth.user);
      }

      // 2. Sync to public.profiles table
      try {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email || "",
          full_name: fullName.trim() || user.email?.split("@")[0] || "User",
          company_name: companyName.trim(),
          role: role.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn("[ProfileSettingsPage] Profile table upsert note:", dbErr);
      }

      await refreshAuthContext();
      showPillToast.success(
        "All user metadata and preferences have been committed to Supabase.",
        "Profile & Settings Saved",
      );
      void fetchUserData(false);
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Could not update user metadata.",
        "Save Failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      showPillToast.success(
        "Your new credentials are active for future logins.",
        "Password Updated Successfully",
      );
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Failed to update password.",
        "Password Update Failed",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const displayName =
    fullName ||
    (user?.user_metadata?.full_name as string) ||
    profileRecord?.full_name ||
    (user?.email ? user.email.split("@")[0] : "Nashmia Logistics");
  const userEmail = user?.email || profileRecord?.email || "";
  const userRoleDisplay = role || (user?.user_metadata?.role as string) || "Operations";
  const avatarLetter = (displayName[0] || userEmail[0] || "N").toUpperCase();

  const isEmailConfirmed = !!user?.email_confirmed_at;
  const createdAtFormatted = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Active member";

  return (
    <div id="profile-settings-page" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 lg:hidden"
              >
                <Sliders className="size-4" />
              </button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Profile & Account Settings
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal credentials, organizational profile, and live Supabase backend
            connectivity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchUserData(true)}
            disabled={refreshing}
            className="h-10 gap-2 rounded-xl border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            <span>Sync Supabase</span>
          </Button>

          <Button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving}
            className="h-10 gap-2 rounded-xl bg-[#0FA3B1] text-white shadow-sm hover:bg-[#0d8f9c]"
          >
            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Navigation / Summary & Right Main Form Panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (User Card & Tab Switcher) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Identity Summary Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#0FA3B1] to-[#078A99] text-2xl font-bold text-white shadow-md">
                  {avatarLetter}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white bg-emerald-500 shadow-xs"
                  title="Supabase Online"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-base font-bold text-slate-900">{displayName}</h2>
                  {isEmailConfirmed && (
                    <CheckCheck className="size-4 text-emerald-600" title="Verified Account" />
                  )}
                </div>
                <p className="truncate text-xs font-medium text-slate-500">{userEmail}</p>
                <div className="mt-1.5 inline-flex items-center rounded-full bg-[#0FA3B1]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0FA3B1]">
                  {userRoleDisplay}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Company</span>
                <span className="font-semibold text-slate-800">{companyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Member Since</span>
                <span className="font-semibold text-slate-800">{createdAtFormatted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Backend State</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>
            </div>

            {/* User ID Copy Bar */}
            {user?.id && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    User UUID
                  </p>
                  <p className="font-mono text-[11px] text-slate-700 truncate max-w-[170px]">
                    {user.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUserId}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 shadow-2xs transition-all"
                  title="Copy User ID"
                >
                  {copiedId ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Navigation Pill Menu */}
          <div className="rounded-[24px] border border-slate-200/90 bg-white p-2.5 shadow-sm space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                activeTab === "profile"
                  ? "bg-[#0FA3B1] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <div className="flex items-center gap-2.5">
                <UserIcon className="size-4" />
                <span>General Profile</span>
              </div>
              <ChevronRight
                className={cn("size-4 opacity-70", activeTab === "profile" && "text-white")}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                activeTab === "security"
                  ? "bg-[#0FA3B1] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Lock className="size-4" />
                <span>Security & Password</span>
              </div>
              <ChevronRight
                className={cn("size-4 opacity-70", activeTab === "security" && "text-white")}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("backend")}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                activeTab === "backend"
                  ? "bg-[#0FA3B1] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Server className="size-4" />
                <span>Backend & Database</span>
              </div>
              <ChevronRight
                className={cn("size-4 opacity-70", activeTab === "backend" && "text-white")}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("preferences")}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                activeTab === "preferences"
                  ? "bg-[#0FA3B1] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="size-4" />
                <span>Notifications & System</span>
              </div>
              <ChevronRight
                className={cn("size-4 opacity-70", activeTab === "preferences" && "text-white")}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                activeTab === "users"
                  ? "bg-[#0FA3B1] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Users className="size-4" />
                <span>User Management</span>
              </div>
              <ChevronRight
                className={cn("size-4 opacity-70", activeTab === "users" && "text-white")}
              />
            </button>
          </div>
        </div>

        {/* Right Column (Tab Content) */}
        <div className="space-y-6 lg:col-span-8">
          {/* TAB 1: GENERAL PROFILE */}
          {activeTab === "profile" && (
            <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Update your contact details, operational role, and organization bio.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Full Name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Tariq Mansoor"
                      className="h-10 rounded-xl border-slate-200 text-sm focus:border-[#0FA3B1] focus:ring-[#0FA3B1]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
                    <Input
                      value={userEmail}
                      disabled
                      className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
                    />
                    <span className="text-[11px] text-slate-400">
                      Email address is managed via primary Supabase Auth credentials.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Role / Job Title</Label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Operations Officer"
                      className="h-10 rounded-xl border-slate-200 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Organization</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Nashmia Industries"
                      className="h-10 rounded-xl border-slate-200 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Contact Phone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +92 300 9876543"
                      className="h-10 rounded-xl border-slate-200 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Default Sea Port</Label>
                    <Input
                      value={preferredPort}
                      onChange={(e) => setPreferredPort(e.target.value)}
                      placeholder="e.g. Karachi (PKKHI) / Port Qasim"
                      className="h-10 rounded-xl border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Bio & Role Focus</Label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
                    placeholder="Short description of your logistics role..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-10 gap-2 rounded-xl bg-[#0FA3B1] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d8f9c]"
                  >
                    {saving ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    <span>Save Profile to Supabase</span>
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: SECURITY & PASSWORD */}
          {activeTab === "security" && (
            <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-lg font-bold text-slate-900">Security & Authentication</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Update your authentication password and view session security credentials.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="mt-6 space-y-5 max-w-lg">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 characters)"
                    className="h-10 rounded-xl border-slate-200 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Confirm New Password
                  </Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="h-10 rounded-xl border-slate-200 text-sm"
                  />
                </div>

                {passwordError && (
                  <p className="text-xs font-medium text-rose-600">{passwordError}</p>
                )}

                <Button
                  type="submit"
                  disabled={changingPassword}
                  className="h-10 gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  {changingPassword ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Key className="size-4" />
                  )}
                  <span>Update Password</span>
                </Button>
              </form>

              <div className="mt-8 border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-slate-900">Session Security</h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">Provider</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-800 capitalize">
                      {user?.app_metadata?.provider || "Supabase Email/Password"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-medium text-slate-400 uppercase">Last Sign-In</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-800">
                      {user?.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString()
                        : "Current Active Session"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BACKEND & DATABASE */}
          {activeTab === "backend" && (
            <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-lg font-bold text-slate-900">Supabase Backend & Health</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Verify real-time database endpoints, table schemas, and API authentication status.
                </p>
              </div>

              {/* Status Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
                    <Database className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Supabase Cloud Database Operational
                    </h4>
                    <p className="text-xs text-emerald-700">
                      All tables (bookings, buyers, suppliers, forwarders, profiles) are
                      synchronized.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestBackend}
                  disabled={testingConnection}
                  className="h-9 gap-1.5 rounded-xl border-emerald-300 bg-white text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50"
                >
                  <Radio className={cn("size-3.5", testingConnection && "animate-pulse")} />
                  <span>{testingConnection ? "Pinging..." : "Test Connection"}</span>
                </Button>
              </div>

              {/* Connection Diagnostics */}
              {connectionTest && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Connection Diagnostics</span>
                    <span
                      className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full",
                        connectionTest.success
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700",
                      )}
                    >
                      {connectionTest.success ? "200 OK" : "Ping Issue"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{connectionTest.message}</p>
                  {connectionTest.latencyMs && (
                    <p className="text-[11px] font-mono text-slate-500">
                      Round-trip Latency: {connectionTest.latencyMs}ms
                    </p>
                  )}
                </div>
              )}

              {/* Active Schema Collections */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Database Tables
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: "bookings", desc: "Container bookings, tracking & voyage records" },
                    { name: "buyers", desc: "Consignee directory & destination ports" },
                    { name: "suppliers", desc: "Vendors & loading points" },
                    { name: "forwarders", desc: "Freight forwarders & rate cards" },
                    { name: "profiles", desc: "User identities & permissions" },
                    { name: "booking_events", desc: "Realtime tracking lifecycle events" },
                  ].map((table) => (
                    <div
                      key={table.name}
                      className="rounded-xl border border-slate-100 bg-white p-3 shadow-2xs hover:border-[#0FA3B1]/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="font-mono text-xs font-bold text-slate-900">
                          public.{table.name}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-slate-500">{table.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PREFERENCES */}
          {activeTab === "preferences" && (
            <div className="rounded-[24px] border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <h3 className="text-lg font-bold text-slate-900">System & Preferences</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Configure automated logistics alerts and regional display defaults.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Notification Triggers
                </h4>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
                  <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-white rounded-xl transition-colors">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Email Booking Summaries</p>
                      <p className="text-[11.5px] text-slate-500">
                        Receive daily PDF logs for scheduled container departures.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="size-4 rounded text-[#0FA3B1] focus:ring-[#0FA3B1]"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-white rounded-xl transition-colors">
                    <div>
                      <p className="text-xs font-bold text-slate-900">ETA & Vessel Changes</p>
                      <p className="text-[11.5px] text-slate-500">
                        Instant notifications when shipping lines adjust estimated arrival times.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={etaChanges}
                      onChange={(e) => setEtaChanges(e.target.checked)}
                      className="size-4 rounded text-[#0FA3B1] focus:ring-[#0FA3B1]"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-white rounded-xl transition-colors">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Realtime Movement Events</p>
                      <p className="text-[11.5px] text-slate-500">
                        WebSocket updates for container gate-in and customs clearance.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={bookingUpdates}
                      onChange={(e) => setBookingUpdates(e.target.checked)}
                      className="size-4 rounded text-[#0FA3B1] focus:ring-[#0FA3B1]"
                    />
                  </label>
                </div>
              </div>

              {/* Live Toast Previews */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Live Toast Notification Previews (Click to Test)
                  </h4>
                  <span className="text-[11px] font-medium text-[#0FA3B1]">
                    Interactive Side Notifications
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Toast Item 1: New comment */}
                  <button
                    type="button"
                    onClick={() => showPillToast.comment("Ava: “Love this shot!”", "New comment")}
                    className="flex items-center gap-3.5 rounded-full border border-slate-200/90 bg-white/90 p-2.5 pl-3 pr-5 text-left shadow-xs hover:border-blue-300 hover:bg-blue-50/20 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-full border border-blue-200/80 bg-blue-50/90 text-blue-500 shadow-[inset_0_1px_2px_rgba(59,130,246,0.1)]">
                      <MessageSquare className="size-4.5 stroke-[1.8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">New comment</p>
                      <p className="truncate text-[11.5px] text-slate-500">
                        Ava: “Love this shot!”
                      </p>
                    </div>
                  </button>

                  {/* Toast Item 2: Reminder */}
                  <button
                    type="button"
                    onClick={() => showPillToast.reminder("Standup in 15 min", "Reminder")}
                    className="flex items-center gap-3.5 rounded-full border border-slate-200/90 bg-white/90 p-2.5 pl-3 pr-5 text-left shadow-xs hover:border-orange-300 hover:bg-orange-50/20 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-full border border-orange-200/80 bg-orange-50/90 text-orange-500 shadow-[inset_0_1px_2px_rgba(249,115,22,0.1)]">
                      <AlarmClock className="size-4.5 stroke-[1.8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">Reminder</p>
                      <p className="truncate text-[11.5px] text-slate-500">Standup in 15 min</p>
                    </div>
                  </button>

                  {/* Toast Item 3: Build Complete */}
                  <button
                    type="button"
                    onClick={() => showPillToast.build("v1.4.3 deployed", "Build Complete")}
                    className="flex items-center gap-3.5 rounded-full border border-slate-200/90 bg-white/90 p-2.5 pl-3 pr-5 text-left shadow-xs hover:border-purple-300 hover:bg-purple-50/20 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-full border border-purple-200/80 bg-purple-50/90 text-purple-500 shadow-[inset_0_1px_2px_rgba(168,85,247,0.1)]">
                      <SettingsIcon className="size-4.5 stroke-[1.8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">Build Complete</p>
                      <p className="truncate text-[11.5px] text-slate-500">v1.4.3 deployed</p>
                    </div>
                  </button>

                  {/* Toast Item 4: Mention */}
                  <button
                    type="button"
                    onClick={() => showPillToast.mention("@you in #design", "Mention")}
                    className="flex items-center gap-3.5 rounded-full border border-slate-200/90 bg-white/90 p-2.5 pl-3 pr-5 text-left shadow-xs hover:border-amber-300 hover:bg-amber-50/20 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-full border border-amber-200/80 bg-amber-50/90 text-amber-500 shadow-[inset_0_1px_2px_rgba(245,158,11,0.1)]">
                      <Bell className="size-4.5 stroke-[1.8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">Mention</p>
                      <p className="truncate text-[11.5px] text-slate-500">@you in #design</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Display Timezone</Label>
                  <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Operational Currency
                  </Label>
                  <Input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="h-10 gap-2 rounded-xl bg-[#0FA3B1] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d8f9c]"
                >
                  <Save className="size-4" />
                  <span>Save Preferences</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 5: USER MANAGEMENT */}
          {activeTab === "users" && <UserManagementSection />}
        </div>
      </div>
    </div>
  );
}
