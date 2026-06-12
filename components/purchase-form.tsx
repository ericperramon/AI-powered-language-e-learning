"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { purchaseCourseAction, PurchaseState } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PurchaseSuccessModal } from "@/components/purchase-success-modal";

type Course = { id: string; title: string; level: string | null };

const initialState: PurchaseState = { status: "idle" };

export function PurchaseForm({ courses }: { courses: Course[] }) {
  const [state, formAction, isPending] = useActionState(purchaseCourseAction, initialState);

  return (
    <>
      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="courseId">Available course</Label>
          <Select id="courseId" name="courseId" required>
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} · {course.level ?? "Level not set"}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="licenses">Employee keys</Label>
          <Input id="licenses" min={1} max={100} name="licenses" required type="number" defaultValue={5} />
        </div>
        {state.status === "error" && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}
        <Button
          className="h-11 w-full rounded-lg text-sm font-semibold"
          disabled={courses.length === 0 || isPending}
          type="submit"
        >
          <KeyRound strokeWidth={1.5} size={16} />
          {isPending ? "Generating keys…" : "Purchase and generate keys"}
        </Button>
        {courses.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
            There are no active courses in the database. Create a course in Supabase to continue.
          </p>
        ) : null}
      </form>

      {state.status === "success" && (
        <PurchaseSuccessModal
          keys={state.keys}
          courseTitle={state.courseTitle}
          onClose={() => {
            // Reset is handled by the modal closing — Next.js will re-render
            // CompanyKeys via router refresh initiated from the modal's onClose
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
