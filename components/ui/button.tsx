import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold tracking-[0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-container)] focus-visible:ring-[var(--brand-accent-ring)]",
        variant === "secondary" &&
          "border-[1.5px] border-[var(--secondary)] bg-transparent text-[var(--secondary)] hover:bg-[var(--secondary-fixed)]",
        variant === "ghost" && "text-[var(--primary)] hover:bg-[var(--primary-fixed)]",
        className
      )}
      {...props}
    />
  );
}
