import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Key,
  Lock,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Power,
  Check,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminUserRecord {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "inactive";
  isActive: boolean;
  createdAt: string;
  lastSignInAt?: string | null;
}

export function UserManagementSection() {
  const { session, user: currentUser, isAdmin, userRole } = useAuth();

  // Users data state
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Create User Form State
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Status Toggle Confirmation Dialog State
  const [statusTargetUser, setStatusTargetUser] = useState<AdminUserRecord | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Fetch all users from backend API
  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/admin/users", {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { success: boolean; users: AdminUserRecord[] };
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err: unknown) {
      console.error("[UserManagement] Failed to fetch users:", err);
      toast.error("Failed to load user directory", {
        description: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Validate create form
  const validateForm = () => {
    const errs: Record<string, string> = {};
    const trimmedName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!trimmedName || trimmedName.length < 2) {
      errs.fullName = "Full name must be at least 2 characters long.";
    }

    if (!cleanUsername) {
      errs.username = "Username is required.";
    } else if (!/^[a-z0-9_-]{3,30}$/.test(cleanUsername)) {
      errs.username =
        "Username must be 3-30 characters (lowercase letters, numbers, _ or - only).";
    }

    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters long.";
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsCreating(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          password,
          confirmPassword,
          role,
        }),
      });

      const resData = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        user?: AdminUserRecord;
      };

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to create user");
      }

      toast.success("User Created Successfully", {
        description: resData.message || `Account created for ${fullName.trim()} (@${username.trim().toLowerCase()})`,
      });

      // Reset form fields
      setFullName("");
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setRole("user");
      setFormErrors({});

      // Refresh users list
      await fetchUsers(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error("User Creation Failed", { description: msg });
    } finally {
      setIsCreating(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: AdminUserRecord) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditRole(user.role);
    setEditPassword("");
    setShowEditPassword(false);
  };

  // Save Edit User
  const handleSaveEdit = async () => {
    if (!editingUser) return;

    if (!editFullName.trim() || editFullName.trim().length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }

    if (editPassword && editPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setIsSavingEdit(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: editingUser.id,
          fullName: editFullName.trim(),
          role: editRole,
          newPassword: editPassword.trim() || undefined,
        }),
      });

      const resData = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        user?: AdminUserRecord;
      };

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to update user");
      }

      toast.success("User Updated", {
        description: resData.message || `Changes saved for ${editFullName.trim()}`,
      });

      setEditingUser(null);
      await fetchUsers(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update user";
      toast.error("Update Failed", { description: msg });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle Status Confirm
  const handleConfirmToggleStatus = async () => {
    if (!statusTargetUser) return;

    setIsTogglingStatus(true);
    const newStatus = !statusTargetUser.isActive;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/admin/users/toggle-status", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: statusTargetUser.id,
          isActive: newStatus,
        }),
      });

      const resData = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to update account status");
      }

      toast.success(newStatus ? "Account Activated" : "Account Deactivated", {
        description: resData.message,
      });

      setStatusTargetUser(null);
      await fetchUsers(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error("Action Failed", { description: msg });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.isActive) ||
        (statusFilter === "inactive" && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  return (
    <div
      id="user-management-section"
      className="rounded-[24px] border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Users className="size-4.5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                User Management
                {isAdmin ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200/80 uppercase">
                    Admin Access
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200 uppercase">
                    Read-Only
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Provision new operational staff, assign roles (Admin vs. User), and manage account activation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchUsers(true)}
            disabled={refreshing}
            className="h-8.5 rounded-xl border-slate-200 text-xs font-semibold gap-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin text-[#0FA3B1]")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Non-Admin Restriction Notice */}
      {!isAdmin && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs text-amber-800 flex items-start gap-3">
          <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Administrator Privileges Required</p>
            <p className="mt-0.5 text-amber-700">
              You are signed in with the <strong className="capitalize">{userRole}</strong> role. Only administrators can create new accounts, modify team roles, or toggle account activation.
            </p>
          </div>
        </div>
      )}

      {/* PART 1: CREATE USER FORM (Admin only or disabled) */}
      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
          <UserPlus className="size-4 text-[#0FA3B1]" />
          <h4 className="text-sm font-bold text-slate-900">Create New User Account</h4>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (formErrors.fullName) setFormErrors((p) => ({ ...p, fullName: undefined }));
                }}
                disabled={!isAdmin || isCreating}
                placeholder="e.g. Rashid Al-Mansoor"
                className={cn(
                  "h-10 rounded-xl border-slate-200 bg-white text-sm focus:border-[#0FA3B1] focus:ring-[#0FA3B1]",
                  formErrors.fullName && "border-rose-400 focus:border-rose-500",
                )}
              />
              {formErrors.fullName && (
                <p className="text-[11px] text-rose-500">{formErrors.fullName}</p>
              )}
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Username <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-bold text-slate-400">
                  @
                </span>
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                    if (formErrors.username) setFormErrors((p) => ({ ...p, username: undefined }));
                  }}
                  disabled={!isAdmin || isCreating}
                  placeholder="rashid_ops"
                  className={cn(
                    "h-10 rounded-xl border-slate-200 bg-white pl-7 text-sm font-mono focus:border-[#0FA3B1] focus:ring-[#0FA3B1]",
                    formErrors.username && "border-rose-400 focus:border-rose-500",
                  )}
                />
              </div>
              {formErrors.username ? (
                <p className="text-[11px] text-rose-500">{formErrors.username}</p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  User will log in using this username.
                </p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Role <span className="text-rose-500">*</span>
              </Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                disabled={!isAdmin || isCreating}
                aria-label="User Role"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-2xs focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1] disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="user">User (Standard Operations)</option>
                <option value="admin">Admin (Full System Management)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                {role === "admin"
                  ? "Admins can manage team users and settings."
                  : "Users can manage shipments & bookings."}
              </p>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Password <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors((p) => ({ ...p, password: undefined }));
                  }}
                  disabled={!isAdmin || isCreating}
                  placeholder="Min 6 characters"
                  className={cn(
                    "h-10 rounded-xl border-slate-200 bg-white pr-9 text-sm focus:border-[#0FA3B1] focus:ring-[#0FA3B1]",
                    formErrors.password && "border-rose-400 focus:border-rose-500",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-[11px] text-rose-500">{formErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Confirm Password <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (formErrors.confirmPassword)
                      setFormErrors((p) => ({ ...p, confirmPassword: undefined }));
                  }}
                  disabled={!isAdmin || isCreating}
                  placeholder="Repeat password"
                  className={cn(
                    "h-10 rounded-xl border-slate-200 bg-white pr-9 text-sm focus:border-[#0FA3B1] focus:ring-[#0FA3B1]",
                    formErrors.confirmPassword && "border-rose-400 focus:border-rose-500",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {formErrors.confirmPassword && (
                <p className="text-[11px] text-rose-500">{formErrors.confirmPassword}</p>
              )}
            </div>

            {/* Action Button */}
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={!isAdmin || isCreating}
                className="h-10 w-full gap-2 rounded-xl bg-[#0FA3B1] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d8f9c] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4" />
                    <span>Create User</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* PART 2: USERS DIRECTORY TABLE */}
      <div className="space-y-4">
        {/* Table Controls (Search & Filters) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, @username..."
              className="h-9 pl-9 rounded-xl border-slate-200 text-xs bg-white focus:border-[#0FA3B1] focus:ring-[#0FA3B1]"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "all" | "admin" | "user")}
              aria-label="Filter by role"
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-2xs focus:border-[#0FA3B1] focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins only</option>
              <option value="user">Users only</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              aria-label="Filter by status"
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-2xs focus:border-[#0FA3B1] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th scope="col" className="px-4 py-3 sm:px-6">
                    Full Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Username
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Account Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Created Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-right sm:px-6">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto size-5 animate-spin text-[#0FA3B1] mb-2" />
                      <span>Loading team accounts...</span>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      <Users className="mx-auto size-7 stroke-1 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 text-sm">No user accounts found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {searchQuery || roleFilter !== "all" || statusFilter !== "all"
                          ? "Try adjusting your search query or filters."
                          : "Create your first user account above."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const initial = (u.fullName?.[0] || u.username?.[0] || "U").toUpperCase();

                    const formattedDate = (() => {
                      try {
                        return new Date(u.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                      } catch {
                        return "—";
                      }
                    })();

                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          "transition-colors hover:bg-slate-50/60",
                          !u.isActive && "bg-slate-50/40 text-slate-400",
                        )}
                      >
                        {/* Full Name & Avatar */}
                        <td className="px-4 py-3.5 sm:px-6 font-medium text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold shadow-2xs",
                                u.role === "admin"
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-700 border border-slate-200",
                              )}
                            >
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                {u.fullName}
                                {isSelf && (
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-[10.5px] text-slate-400 font-mono">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Username */}
                        <td className="px-4 py-3.5 font-mono text-xs">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            @{u.username}
                          </span>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3.5">
                          {u.role === "admin" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10.5px] font-bold text-blue-700 border border-blue-200/80">
                              <ShieldCheck className="size-3 text-blue-600" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-700 border border-slate-200">
                              <UserIcon className="size-3 text-slate-500" />
                              User
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200/80">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-rose-700 border border-rose-200/80">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                          {formattedDate}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right sm:px-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Action */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(u)}
                              disabled={!isAdmin}
                              className="h-7.5 px-2.5 rounded-lg text-xs font-semibold gap-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                              title="Edit User Details"
                            >
                              <Edit2 className="size-3" />
                              <span>Edit</span>
                            </Button>

                            {/* Activate / Deactivate Action */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setStatusTargetUser(u)}
                              disabled={!isAdmin || isSelf}
                              className={cn(
                                "h-7.5 px-2.5 rounded-lg text-xs font-semibold gap-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                                u.isActive
                                  ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
                              )}
                              title={
                                isSelf
                                  ? "Cannot deactivate your own account"
                                  : u.isActive
                                    ? "Deactivate Account"
                                    : "Activate Account"
                              }
                            >
                              <Power className="size-3" />
                              <span>{u.isActive ? "Deactivate" : "Activate"}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EDIT USER MODAL */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="size-4 text-[#0FA3B1]" />
              Edit User: @{editingUser?.username}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update user display name, administrative role, or reset password credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Full Name</Label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Full Name"
                className="h-10 rounded-xl border-slate-200 text-sm focus:border-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Role</Label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as "admin" | "user")}
                aria-label="Edit Role"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
              >
                <option value="user">User (Standard Operations)</option>
                <option value="admin">Admin (Full System Management)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Reset Password (Optional)
              </Label>
              <div className="relative">
                <Input
                  type={showEditPassword ? "text" : "password"}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="h-10 rounded-xl border-slate-200 pr-9 text-sm focus:border-[#0FA3B1] focus:ring-[#0FA3B1]"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  aria-label={showEditPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showEditPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-[10.5px] text-slate-400">
                If provided, new password must be at least 6 characters.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingUser(null)}
              className="h-9 rounded-xl border-slate-200 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
              className="h-9 gap-1.5 rounded-xl bg-[#0FA3B1] px-4 text-xs font-semibold text-white hover:bg-[#0d8f9c] cursor-pointer"
            >
              {isSavingEdit ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM STATUS TOGGLE MODAL */}
      <Dialog
        open={Boolean(statusTargetUser)}
        onOpenChange={(open) => !open && setStatusTargetUser(null)}
      >
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "grid size-9 place-items-center rounded-xl",
                  statusTargetUser?.isActive
                    ? "bg-rose-100 text-rose-600"
                    : "bg-emerald-100 text-emerald-600",
                )}
              >
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {statusTargetUser?.isActive ? "Deactivate Account?" : "Activate Account?"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Confirm account status modification for{" "}
                  <strong>{statusTargetUser?.fullName}</strong> (@{statusTargetUser?.username}).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 text-xs text-slate-600 space-y-2">
            {statusTargetUser?.isActive ? (
              <p>
                Deactivating this user will <strong>immediately revoke access</strong> and block any subsequent login attempts. Their historical bookings and logged documents will be preserved.
              </p>
            ) : (
              <p>
                Activating this user will allow them to log in immediately with their username and assigned password.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusTargetUser(null)}
              className="h-9 rounded-xl border-slate-200 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmToggleStatus}
              disabled={isTogglingStatus}
              className={cn(
                "h-9 gap-1.5 rounded-xl px-4 text-xs font-semibold text-white cursor-pointer",
                statusTargetUser?.isActive
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              {isTogglingStatus ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Power className="size-3.5" />
                  <span>
                    Confirm {statusTargetUser?.isActive ? "Deactivation" : "Activation"}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
