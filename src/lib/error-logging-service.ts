import { reportLovableError } from "./lovable-error-reporting";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
  componentStack?: string;
  url: string;
}

const MAX_LOG_ENTRIES = 100;
const logHistory: LogEntry[] = [];
const logSubscribers = new Set<(entry: LogEntry) => void>();

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function normalizeError(
  error: unknown,
): { name: string; message: string; stack?: string } | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }
  return {
    name: "UnknownError",
    message: String(error),
  };
}

/**
 * Centralized logging and error tracking service.
 * Gracefully records errors, warnings, and informational diagnostics with full context.
 */
class ErrorLoggingService {
  private initialized = false;

  public init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    // Global uncaught error listener
    window.addEventListener("error", (event) => {
      this.error("Uncaught global window error", event.error || event.message, {
        source: "window.onerror",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Global unhandled promise rejection listener
    window.addEventListener("unhandledrejection", (event) => {
      this.error("Unhandled promise rejection", event.reason, {
        source: "window.unhandledrejection",
      });
    });
  }

  private addEntry(
    level: LogLevel,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
    componentStack?: string,
  ): LogEntry {
    const entry: LogEntry = {
      id: createLogId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      error: normalizeError(error),
      context: {
        ...context,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
      componentStack,
      url: typeof window !== "undefined" ? window.location.href : "",
    };

    logHistory.push(entry);
    if (logHistory.length > MAX_LOG_ENTRIES) {
      logHistory.shift();
    }

    logSubscribers.forEach((subscriber) => {
      try {
        subscriber(entry);
      } catch (err) {
        console.warn("[ErrorLoggingService] Subscriber error:", err);
      }
    });

    return entry;
  }

  public error(
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
    componentStack?: string,
  ): LogEntry {
    const entry = this.addEntry("error", message, error, context, componentStack);

    // Forward to console in development
    console.error(`[Nashmia:Error] ${message}`, error, context);

    // Forward to Lovable telemetry & reporting
    if (error) {
      reportLovableError(error, {
        logMessage: message,
        componentStack,
        ...context,
      });
    }

    return entry;
  }

  public warn(message: string, context?: Record<string, unknown>): LogEntry {
    const entry = this.addEntry("warn", message, undefined, context);
    console.warn(`[Nashmia:Warn] ${message}`, context);
    return entry;
  }

  public info(message: string, context?: Record<string, unknown>): LogEntry {
    const entry = this.addEntry("info", message, undefined, context);
    return entry;
  }

  public debug(message: string, context?: Record<string, unknown>): LogEntry {
    const entry = this.addEntry("debug", message, undefined, context);
    return entry;
  }

  public getHistory(): readonly LogEntry[] {
    return [...logHistory];
  }

  public clearHistory(): void {
    logHistory.length = 0;
  }

  public subscribe(callback: (entry: LogEntry) => void): () => void {
    logSubscribers.add(callback);
    return () => {
      logSubscribers.delete(callback);
    };
  }
}

export const logger = new ErrorLoggingService();

// Auto-initialize in browser environments
if (typeof window !== "undefined") {
  logger.init();
}
