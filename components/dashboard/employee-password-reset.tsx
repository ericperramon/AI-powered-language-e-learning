"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { generateEmployeePasswordReset } from "@/app/dashboard/actions";

export function EmployeePasswordReset({ employeeId }: { employeeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setLink(null);
    setError(null);
    startTransition(async () => {
      const result = await generateEmployeePasswordReset(employeeId);
      if (result.error) {
        setError(result.error);
      } else if (result.link) {
        setLink(result.link);
      }
    });
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 border-t border-[var(--outline-variant)] pt-3">
      {!link ? (
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <KeyRound size={13} strokeWidth={1.5} />
            )}
            {isPending ? "Generating…" : "Generate password reset link"}
          </button>
          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--on-surface-variant)]">
            Share this link with the employee — it expires after one use.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--on-surface)]">{link}</p>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded p-1 text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
              title="Copy link"
            >
              {copied ? (
                <Check size={14} className="text-emerald-600" />
              ) : (
                <Copy size={14} strokeWidth={1.5} />
              )}
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="text-xs text-[var(--on-surface-variant)] underline-offset-2 hover:underline disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
