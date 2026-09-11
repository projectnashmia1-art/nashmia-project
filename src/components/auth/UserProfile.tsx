import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfileProps {
  className?: string;
  onClose?: () => void;
}

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

export function UserProfile({ className, onClose }: UserProfileProps) {
  const { user: contextUser, refreshProfile: refreshAuthContext } = useAuth();
  const [user, setUser] = useState<User | null>(contextUser);
  const [profileRecord, setProfileRecord] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Edit form state
  const [editFullName, setEditFullName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");

  const fetchUserData = useCallback(async (showToast = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      if (showToast) setRefreshing(true);

      // 1. Fetch live authenticated user from Supabase Auth
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setUser(null);
        setProfileRecord(null);
        if (showToast) {
          toast.error("Auth Session Expired", {
            description: authError?.message || "Please sign in again.",
          });
        }
        return;
      }

      setUser(authUser);

      // Pre-fill editable fields
      const meta = authUser.user_metadata || {};
      setEditFullName((meta.full_name as string) || "");
      setEditCompany(
        (meta.company_name as string) || (meta.company as string) || "Nashmia Industries",
      );
      setEditPhone((meta.phone as string) || (authUser.phone as string) || "");
      setEditRole((meta.role as string) || "Operations Officer");

      // 2. Fetch database profile record from public.profiles
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
        console.warn("[UserProfile] Profile table query notice:", err);
      }

      if (showToast) {
        toast.success("Profile Synchronized", {
          description: "Latest Supabase authentication data retrieved.",
        });
      }
    } catch (err: unknown) {
      console.error("[UserProfile] Error fetching user profile:", err);
      if (showToast) {
        toast.error("Failed to fetch profile", {
          description: err instanceof Error ? err.message : "Unknown error occurred.",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchUserData(false);
  }, [fetchUserData]);

  const handleCopyUserId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      toast.success("User ID copied to clipboard");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.info("User ID: " + user.id);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const updatedMetadata = {
        ...user.user_metadata,
        full_name: editFullName.trim(),
        company_name: editCompany.trim(),
        phone: editPhone.trim(),
        role: editRole.trim(),
      };

      // 1. Update Supabase Auth user metadata
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
          full_name: editFullName.trim() || user.email?.split("@")[0] || "User",
          company_name: editCompany.trim(),
          role: editRole.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn("[UserProfile] Profile table update note:", dbErr);
      }

      await refreshAuthContext();
      setIsEditing(false);
      toast.success("Profile Updated", {
        description: "Your Supabase user metadata has been saved successfully.",
      });
      void fetchUserData(false);
    } catch (err: unknown) {
      toast.error("Update Failed", {
        description: err instanceof Error ? err.message : "Could not update user metadata.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Extract display properties
  const userMetadata = user?.user_metadata || {};
  const appMetadata = user?.app_metadata || {};
  const fullName =
    (userMetadata.full_name as string) ||
    profileRecord?.full_name ||
    (user?.email ? user.email.split("@")[0] : "Authenticated User");
  const email = user?.email || profileRecord?.email || "No email provided";
  const role = (userMetadata.role as string) || profileRecord?.role || "Operations Officer";
  const company =
    (userMetadata.company_name as string) || profileRecord?.company_name || "Nashmia Industries";
  const phone = (userMetadata.phone as string) || user?.phone || "Not set";
  const provider = (appMetadata.provider as string) || "email";
  const isEmailConfirmed = !!user?.email_confirmed_at;
  const createdAtFormatted = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recent";
  const lastSignInFormatted = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Active session";

  const avatarLetter = (fullName[0] || email[0] || "U").toUpperCase();

  if (loading) {
    return (
      <div
        id="user-profile-loading"
        className={cn("flex flex-col items-center justify-center p-8 text-center", className)}
      >
        <RefreshCw className="size-6 animate-spin text-primary mb-3" />
        <p className="text-[13px] font-medium text-muted-foreground">
          Fetching authenticated user from Supabase...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        id="user-profile-unauthenticated"
        className={cn(
          "rounded-[20px] border border-border/80 bg-card/80 p-6 text-center shadow-sm",
          className,
        )}
      >
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Sign In Required</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Please sign in to your Supabase account to access live container operations and user
          settings.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="rounded-[12px] bg-primary text-white"
          >
            Sign In to Account
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void fetchUserData(true)}
            className="rounded-[12px]"
          >
            Refresh Status
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="user-profile-card"
      className={cn(
        "relative rounded-[22px] border border-border/70 bg-card text-card-foreground shadow-lg overflow-hidden",
        className,
      )}
    >
      {/* Decorative top accent header */}
      <div className="h-20 bg-gradient-to-r from-primary/90 via-primary to-accent/90 p-4 relative flex items-start justify-between text-white">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-90">
          <Shield className="size-3.5" />
          <span>Supabase Authenticated Profile</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            id="refresh-profile-button"
            type="button"
            onClick={() => void fetchUserData(true)}
            disabled={refreshing}
            className="grid size-7 place-items-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-xs disabled:opacity-50"
            title="Refresh Supabase Data"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          </button>
          {onClose && (
            <button
              id="close-profile-button"
              type="button"
              onClick={onClose}
              className="grid size-7 place-items-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-xs"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Profile Info Section */}
      <div className="px-6 pb-6 pt-0">
        {/* Floating Avatar & Actions */}
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="relative">
            <div className="grid size-20 place-items-center rounded-[20px] border-4 border-card bg-primary text-2xl font-bold text-white shadow-md">
              {avatarLetter}
            </div>
            <span
              className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-card bg-emerald-500"
              title="Supabase Session Active"
            />
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button
                id="edit-profile-btn"
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="h-8 gap-1.5 rounded-[12px] border-border/80 text-xs font-semibold"
              >
                <Edit3 className="size-3.5" />
                <span>Edit Metadata</span>
              </Button>
            ) : (
              <Button
                id="cancel-edit-profile-btn"
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                className="h-8 gap-1 rounded-[12px] text-xs"
              >
                <X className="size-3.5" />
                <span>Cancel</span>
              </Button>
            )}
          </div>
        </div>

        {/* User Identity Header */}
        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">{fullName}</h2>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              {role}
            </span>
            {isEmailConfirmed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                <span>Verified</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground flex items-center gap-1.5">
            <Mail className="size-3.5 text-muted-foreground/70" />
            <span>{email}</span>
          </p>
        </div>

        {/* Editing Mode */}
        {isEditing ? (
          <form
            onSubmit={handleSaveProfile}
            className="space-y-3.5 rounded-[16px] border border-primary/20 bg-primary/5 p-4 mb-4"
          >
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">
              Update User Metadata (`user_metadata`)
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full Name</Label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="e.g. Ahmed Al-Mansoor"
                className="h-9 rounded-[10px] bg-background text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Role / Title</Label>
                <Input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="e.g. Operations Officer"
                  className="h-9 rounded-[10px] bg-background text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Organization / Company</Label>
                <Input
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  placeholder="e.g. Nashmia Industries"
                  className="h-9 rounded-[10px] bg-background text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone Number</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="e.g. +971 4 123 4567"
                className="h-9 rounded-[10px] bg-background text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-8 rounded-[10px] text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="h-8 gap-1.5 rounded-[10px] bg-primary text-white text-xs"
              >
                {saving ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                <span>Save to Supabase</span>
              </Button>
            </div>
          </form>
        ) : null}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* User ID */}
          <div className="flex items-center justify-between rounded-[14px] border border-border/60 bg-muted/30 p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-background text-muted-foreground border border-border/50">
                <Fingerprint className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  User ID
                </p>
                <p
                  className="text-xs font-mono font-medium text-foreground truncate max-w-[150px]"
                  title={user.id}
                >
                  {user.id}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopyUserId}
              className="size-7 shrink-0 rounded-[8px] text-muted-foreground hover:text-foreground"
              title="Copy User ID"
            >
              {copiedId ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>

          {/* Company */}
          <div className="flex items-center gap-2 rounded-[14px] border border-border/60 bg-muted/30 p-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-background text-muted-foreground border border-border/50">
              <Building2 className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Company
              </p>
              <p className="text-xs font-semibold text-foreground truncate">{company}</p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-2 rounded-[14px] border border-border/60 bg-muted/30 p-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-background text-muted-foreground border border-border/50">
              <Phone className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Phone
              </p>
              <p className="text-xs font-medium text-foreground truncate">{phone}</p>
            </div>
          </div>

          {/* Auth Provider */}
          <div className="flex items-center gap-2 rounded-[14px] border border-border/60 bg-muted/30 p-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-background text-muted-foreground border border-border/50">
              <Key className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Provider
              </p>
              <p className="text-xs font-semibold text-foreground capitalize">{provider}</p>
            </div>
          </div>

          {/* Member Since */}
          <div className="flex items-center gap-2 rounded-[14px] border border-border/60 bg-muted/30 p-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-background text-muted-foreground border border-border/50">
              <Calendar className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </p>
              <p className="text-xs font-medium text-foreground">{createdAtFormatted}</p>
            </div>
          </div>

          {/* Last Sign In */}
          <div className="flex items-center gap-2 rounded-[14px] border border-border/60 bg-muted/30 p-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-background text-muted-foreground border border-border/50">
              <Clock className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Last Active
              </p>
              <p className="text-xs font-medium text-foreground truncate">{lastSignInFormatted}</p>
            </div>
          </div>
        </div>

        {/* Supabase Raw Metadata Collapsible Preview */}
        <div className="mt-4 rounded-[14px] border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Database className="size-3.5 text-primary" />
              <span>Supabase Session Metadata (`user_metadata`)</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/70">
              {Object.keys(userMetadata).length} attributes
            </span>
          </div>

          <pre className="mt-2 max-h-28 overflow-auto rounded-[10px] bg-background/80 p-2.5 text-[11px] font-mono text-muted-foreground border border-border/40">
            {JSON.stringify(userMetadata, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
