import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "brand-accent-focus h-11 w-full rounded-lg border-[1.5px] border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3.5 text-base text-[var(--on-surface)] outline-none transition-colors",
        className
      )}
      {...props}
    />
  );
}
