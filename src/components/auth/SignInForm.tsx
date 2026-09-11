import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { AuthCard } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setIsLoading(false);
        toast.error("Sign In Failed", {
          description:
            error.message || "Invalid login credentials. Please check your email and password.",
        });
        return;
      }

      setIsLoading(false);
      setIsSuccess(true);
      toast.success("Welcome back to Nashmia Logistics", {
        description: `Signed in as ${data.user?.email || email}`,
      });

      setTimeout(() => {
        navigate({ to: "/" });
      }, 400);
    } catch (err: unknown) {
      setIsLoading(false);
      toast.error("Sign In Error", {
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.info("Password Reset", {
        description:
          "Please enter your email address above to receive password reset instructions.",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        toast.error("Reset Failed", {
          description: error.message,
        });
      } else {
        toast.success("Password Reset Email Sent", {
          description: `A password reset link has been dispatched to ${email}.`,
        });
      }
    } catch (err: unknown) {
      toast.error("Reset Error", {
        description: err instanceof Error ? err.message : "Failed to send reset link.",
      });
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your logistics workspace"
      footer={
        <p>
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-[#000000] hover:text-[#6A80A9] hover:underline transition-colors"
          >
            Create one
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email field */}
        <div className="space-y-1.5 w-full">
          <label
            htmlFor="signin-email"
            className="block text-[13px] font-semibold text-[#000000] tracking-tight"
          >
            Email
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Mail className="size-4 stroke-[1.8]" aria-hidden="true" />
            </div>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="Enter your email"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "signin-email-error" : undefined}
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
              id="signin-email-error"
              className="text-[11.5px] font-medium text-red-500 animate-in fade-in duration-150"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Password field */}
        <PasswordInput
          id="signin-password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          placeholder="Enter your password"
          error={errors.password}
        />

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded-[5px] border-slate-300 text-[#000000] accent-black focus:ring-[#6A80A9]/30"
            />
            <span className="text-[13px] font-medium text-slate-600">Remember me</span>
          </label>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-[12.5px] font-semibold text-slate-600 hover:text-[#000000] hover:underline transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Sign In Primary Button */}
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
                <span>Signing in...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="size-4 text-[#C7D5BF]" />
                <span>Verified</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
