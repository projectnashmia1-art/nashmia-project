import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2, Mail, User } from "lucide-react";
import { AuthCard } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";
import { validatePasswordRules } from "./auth-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export function SignUpForm() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const errs: {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!fullName.trim()) {
      errs.fullName = "Full name is required";
    }

    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    } else {
      const { isComplete } = validatePasswordRules(password);
      if (!isComplete) {
        errs.password = "Password must satisfy all strength criteria";
      }
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Confirm password is required";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = fullName.trim();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (error) {
        setIsLoading(false);
        toast.error("Registration Failed", {
          description: error.message || "Could not complete account creation. Please try again.",
        });
        return;
      }

      // Upsert profile record in database if user is returned
      if (data.user) {
        try {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email: normalizedEmail,
            full_name: trimmedName,
            role: "operations",
            company_name: "Nashmia Industries",
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          console.warn("[SignUp] Profile initial sync note:", profileErr);
        }
      }

      setIsLoading(false);
      setIsSuccess(true);

      // If Supabase has email confirmation enabled and session is not immediately active
      if (!data.session && data.user) {
        toast.success("Account Registered", {
          description: `A confirmation link has been dispatched to ${normalizedEmail}. Please check your inbox to activate your workspace.`,
        });
        setTimeout(() => {
          navigate({ to: "/login" });
        }, 800);
      } else {
        toast.success("Account Created Successfully", {
          description: `Welcome to Nashmia Logistics, ${trimmedName}!`,
        });

        let targetUrl = "/";
        try {
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const redirectParam = params.get("redirect");
            if (
              redirectParam &&
              redirectParam.startsWith("/") &&
              !redirectParam.startsWith("/login") &&
              !redirectParam.startsWith("/signup")
            ) {
              targetUrl = redirectParam;
            }
          }
        } catch {
          targetUrl = "/";
        }

        setTimeout(() => {
          navigate({ to: targetUrl });
        }, 400);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      toast.error("Sign Up Error", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start managing your logistics operations"
      footer={
        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#000000] hover:text-[#6A80A9] hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {/* Full Name */}
        <div className="space-y-1.5 w-full">
          <label
            htmlFor="signup-name"
            className="block text-[13px] font-semibold text-[#000000] tracking-tight"
          >
            Full Name
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <User className="size-4 stroke-[1.8]" aria-hidden="true" />
            </div>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="Enter your full name"
              aria-invalid={errors.fullName ? "true" : "false"}
              aria-describedby={errors.fullName ? "signup-name-error" : undefined}
              className={cn(
                "h-[46px] w-full rounded-[14px] border bg-white/70 pl-10 pr-4 text-[14px] text-[#000000] placeholder:text-slate-400 transition-all duration-200 backdrop-blur-md",
                "focus:bg-[#E8F1F3]/40 focus:outline-none",
                errors.fullName
                  ? "border-red-400/80 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.14)]"
                  : "border-slate-200/80 focus:border-[#6A80A9] focus:shadow-[0_0_0_3px_rgba(106,128,169,0.14)]",
              )}
            />
          </div>
          {errors.fullName && (
            <p
              id="signup-name-error"
              className="text-[11.5px] font-medium text-red-500 animate-in fade-in duration-150"
            >
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5 w-full">
          <label
            htmlFor="signup-email"
            className="block text-[13px] font-semibold text-[#000000] tracking-tight"
          >
            Email
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Mail className="size-4 stroke-[1.8]" aria-hidden="true" />
            </div>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="Enter your email"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              className={cn(
                "h-[46px] w-full rounded-[14px] border bg-white/70 pl-10 pr-4 text-[14px] text-[#000000] placeholder:text-slate-400 transition-all duration-200 backdrop-blur-md",
                "focus:bg-[#E8F1F3]/40 focus:outline-none",
                errors.email
                  ? "border-red-400/80 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.14)]"
                  : "border-slate-200/80 focus:border-[#6A80A9] focus:shadow-[0_0_0_3px_rgba(106,128,169,0.14)]",
              )}
            />
          </div>
          {errors.email && (
            <p
              id="signup-email-error"
              className="text-[11.5px] font-medium text-red-500 animate-in fade-in duration-150"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <PasswordInput
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="Create a password"
            error={errors.password}
          />
          {/* Live Password Strength Indicator */}
          <PasswordStrengthIndicator password={password} />
        </div>

        {/* Confirm Password */}
        <PasswordInput
          id="signup-confirm-password"
          label="Confirm Password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword)
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          placeholder="Confirm your password"
          error={errors.confirmPassword}
        />

        {/* Create Account Primary Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className={cn(
              "group relative flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#000000] px-6 text-[14.5px] font-bold text-[#FFFFFF] shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition-all duration-200",
              "hover:bg-slate-900 hover:scale-[1.01] active:scale-[0.99]",
              "focus:outline-none focus-visible:ring-4 focus-visible:ring-black/20",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="size-4 text-[#C7D5BF]" />
                <span>Account Ready</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
