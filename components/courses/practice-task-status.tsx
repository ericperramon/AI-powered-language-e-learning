import { CheckCircle2, Clock, RefreshCw } from "lucide-react";

export type PracticeTaskSubmissionStatus = "pending" | "reviewed" | "revision_needed";

const STATUS_CONFIG: Record<
  PracticeTaskSubmissionStatus,
  { label: string; icon: typeof Clock; badgeCls: string; cardCls: string }
> = {
  pending: {
    label: "Pending review",
    icon: Clock,
    badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
    cardCls: "border-amber-200 bg-amber-50/40",
  },
  reviewed: {
    label: "Reviewed",
    icon: CheckCircle2,
    badgeCls: "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)] border-[var(--primary-fixed-dim)]",
    cardCls: "border-[var(--primary-fixed-dim)] bg-[var(--primary-fixed)]",
  },
  revision_needed: {
    label: "Revision needed",
    icon: RefreshCw,
    badgeCls: "bg-orange-50 text-orange-700 border-orange-200",
    cardCls: "border-orange-200 bg-orange-50/40",
  },
};

export function PracticeTaskStatus({
  status,
  reviewerNotes,
  reviewedAt,
}: {
  status: PracticeTaskSubmissionStatus;
  reviewerNotes?: string | null;
  reviewedAt?: string | null;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border p-5 ${config.cardCls}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${config.badgeCls}`}>
          <Icon strokeWidth={1.5} size={12} />
          {config.label}
        </span>
        {reviewedAt && (
          <span className="text-xs text-[var(--on-surface-variant)]">
            {new Date(reviewedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {status === "pending" && (
        <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">
          Your submission has been received. Your tutor will provide feedback shortly.
        </p>
      )}

      {(status === "reviewed" || status === "revision_needed") && reviewerNotes && (
        <blockquote className="mt-3 border-l-2 border-[var(--outline-variant)] pl-4 text-sm leading-6 text-[var(--on-surface)]">
          {reviewerNotes}
        </blockquote>
      )}

      {status === "revision_needed" && (
        <p className="mt-3 text-xs font-medium text-orange-700">
          Please review the feedback above and resubmit your response.
        </p>
      )}
    </div>
  );
}
