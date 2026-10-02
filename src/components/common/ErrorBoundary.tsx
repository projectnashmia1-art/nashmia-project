import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { logger } from "@/lib/error-logging-service";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  title?: string;
  description?: string;
  moduleName?: string;
  onReset?: () => void;
  resetKeys?: unknown[];
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Robust React Error Boundary that isolates component failures,
 * logs diagnostics via the centralized logging service, and renders
 * a graceful recovery UI without crashing the rest of the application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error(
      `Unhandled React component error in ${this.props.moduleName || "AnonymousComponent"}`,
      error,
      {
        moduleName: this.props.moduleName,
      },
      errorInfo.componentStack || undefined,
    );
  }

  public override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return;

    // Auto-reset error state when resetKeys change
    if (this.props.resetKeys && prevProps.resetKeys) {
      const hasKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index],
      );
      if (hasKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  private resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  public override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, title, description, moduleName, compact } = this.props;

    if (!hasError) {
      return children;
    }

    if (typeof fallback === "function" && error) {
      return fallback(error, this.resetErrorBoundary);
    }

    if (fallback) {
      return fallback;
    }

    if (compact) {
      return (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-600" />
            <span className="font-medium">
              {title || `Unable to load ${moduleName || "section"}`}
            </span>
          </div>
          <button
            type="button"
            onClick={this.resetErrorBoundary}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-800 shadow-2xs hover:bg-amber-50"
          >
            <RotateCcw className="size-3" />
            Retry
          </button>
        </div>
      );
    }

    return (
      <div
        role="alert"
        className="my-4 flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white/95 p-6 text-center shadow-xs sm:p-8"
      >
        <div className="grid size-12 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 shadow-2xs">
          <AlertCircle className="size-6" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-slate-900">
          {title ||
            (moduleName ? `Error loading ${moduleName}` : "Component temporarily unavailable")}
        </h3>

        <p className="mt-1.5 max-w-md text-sm text-slate-500">
          {description ||
            "An unexpected error occurred while rendering this component. The rest of the dashboard remains operational."}
        </p>

        {error?.message && (
          <div className="mt-3 max-w-lg rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-left text-xs font-mono text-slate-600">
            {error.message}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={this.resetErrorBoundary}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="size-3.5" />
            Retry Component
          </button>
        </div>
      </div>
    );
  }
}
