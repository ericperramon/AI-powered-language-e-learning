"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Lock } from "lucide-react";

export function UnitRow({
  unit,
  locked,
  completed,
  completedCount,
  total,
  defaultOpen,
  children,
}: {
  unit: { id: string; title: string; description: string | null; sort_order: number };
  locked: boolean;
  completed: boolean;
  completedCount: number;
  total: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const anchorId = `unit-${unit.sort_order}`;

  // Abre la unidad si se llega con el ancla #unit-N (p. ej. desde el sidebar).
  // Solo en cliente tras montar, para no provocar hydration mismatch.
  useEffect(() => {
    if (!locked && window.location.hash === `#${anchorId}`) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza una vez con el hash de la URL (estado externo del navegador)
      setOpen(true);
    }
  }, [anchorId, locked]);

  return (
    <div
      id={anchorId}
      className={`scroll-mt-20 overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-sm transition-opacity ${locked ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={() => !locked && setOpen((o) => !o)}
        disabled={locked}
        className="flex w-full items-center gap-4 px-5 py-4 text-left disabled:cursor-not-allowed"
      >
        {/* Number badge */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            completed
              ? "bg-emerald-50 text-emerald-600"
              : locked
                ? "bg-[var(--surface-container)] text-[var(--outline)]"
                : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
          }`}
        >
          {completed ? (
            <CheckCircle2 size={18} strokeWidth={2} />
          ) : locked ? (
            <Lock size={16} strokeWidth={1.5} />
          ) : (
            unit.sort_order
          )}
        </div>

        {/* Title + description */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-[var(--on-surface)]">
            {unit.title}
          </p>
          {unit.description && (
            <p className="truncate text-sm text-[var(--on-surface-variant)]">{unit.description}</p>
          )}
        </div>

        {/* Progress pill + chevron */}
        <div className="flex shrink-0 items-center gap-3">
          {locked ? (
            <span className="rounded-full bg-[var(--surface-container)] px-3 py-1 text-sm font-semibold text-[var(--outline)]">
              Locked
            </span>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                completed
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
              }`}
            >
              {completedCount}/{total}
            </span>
          )}
          <ChevronDown
            size={20}
            strokeWidth={2.5}
            className={`text-[var(--on-surface-variant)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
