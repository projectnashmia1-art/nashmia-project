import React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-slate-200/70 animate-skeleton-shimmer dark:bg-slate-800",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
