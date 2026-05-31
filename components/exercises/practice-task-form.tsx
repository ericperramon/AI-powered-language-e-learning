import { ClipboardList, Send } from "lucide-react";
import { submitPracticeTask } from "@/app/dashboard/courses/[courseId]/actions";
import { Button } from "@/components/ui/button";

export function PracticeTaskForm({
  courseId,
  unitId,
  lessonId,
  instructions,
}: {
  courseId: string;
  unitId: string;
  lessonId: string;
  instructions: string;
}) {
  return (
    <form action={submitPracticeTask} className="space-y-5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="lessonId" value={lessonId} />

      <div className="rounded-xl border border-[var(--secondary-container)] bg-[var(--secondary-fixed)] p-4 text-sm leading-6 text-[var(--on-secondary-fixed)]">
        <div className="flex items-start gap-2.5">
          <ClipboardList strokeWidth={1.5} size={16} className="mt-0.5 shrink-0 text-[var(--secondary)]" />
          <p>{instructions}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="practice-response"
          className="text-sm font-semibold text-[var(--on-surface)]"
        >
          Your response
        </label>
        <textarea
          id="practice-response"
          name="response"
          required
          rows={8}
          placeholder="Write your response here…"
          className="brand-accent-focus w-full resize-y rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--on-surface)] placeholder:text-[var(--outline)] focus:outline-none"
        />
        <p className="text-xs text-[var(--on-surface-variant)]">
          Your tutor will review and provide personalised feedback. This does not block your progress.
        </p>
      </div>

      <Button type="submit">
        <Send strokeWidth={1.5} size={15} />
        Submit Practice Task
      </Button>
    </form>
  );
}
