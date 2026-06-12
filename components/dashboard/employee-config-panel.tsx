"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Settings,
  Trash2,
  X
} from "lucide-react";
import {
  assignEmployeeCourse,
  deleteEmployeeAccount,
  generateEmployeePasswordReset,
  removeEmployeeEnrollment
} from "@/app/dashboard/actions";

type CourseInfo = {
  id: string;
  title: string;
  target_language: string | null;
  level: string | null;
};

type EnrolledCourse = CourseInfo & {
  course_id: string;
  status: string;
  progress_percentage: number;
};

type Props = {
  employee: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  enrolledCourses: EnrolledCourse[];
  companyCourses: CourseInfo[];
};

export function EmployeeConfigPanel({ employee, enrolledCourses, companyCourses }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
        title="Configure employee"
        aria-label="Configure employee"
      >
        <Settings size={16} strokeWidth={1.5} />
      </button>

      {open && (
        <Panel
          employee={employee}
          enrolledCourses={enrolledCourses}
          companyCourses={companyCourses}
          onClose={() => setOpen(false)}
          onDeleted={() => {
            setOpen(false);
            router.refresh();
          }}
          onChanged={() => router.refresh()}
        />
      )}
    </>
  );
}

function Panel({
  employee,
  enrolledCourses: initialEnrollments,
  companyCourses,
  onClose,
  onDeleted,
  onChanged
}: Props & { onClose: () => void; onDeleted: () => void; onChanged: () => void }) {
  const [enrollments, setEnrollments] = useState<EnrolledCourse[]>(initialEnrollments);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initials = employee.full_name
    ? employee.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (employee.email?.[0] ?? "?").toUpperCase();

  function run(key: string, fn: () => Promise<void>) {
    setError(null);
    setPendingAction(key);
    startTransition(async () => {
      await fn();
      setPendingAction(null);
    });
  }

  function handleRemoveEnrollment(courseId: string) {
    run(`remove-${courseId}`, async () => {
      const result = await removeEmployeeEnrollment(employee.id, courseId);
      if (result.error) {
        setError(result.error);
      } else {
        setEnrollments((prev) => prev.filter((e) => e.course_id !== courseId));
        onChanged();
      }
    });
  }

  function handleAssignCourse(courseId: string) {
    run(`assign-${courseId}`, async () => {
      const result = await assignEmployeeCourse(employee.id, courseId);
      if (result.error) {
        setError(result.error);
      } else {
        const course = companyCourses.find((c) => c.id === courseId);
        if (course) {
          setEnrollments((prev) => [
            ...prev,
            {
              id: course.id,
              course_id: courseId,
              title: course.title,
              target_language: course.target_language,
              level: course.level,
              status: "active",
              progress_percentage: 0
            }
          ]);
        }
        onChanged();
      }
    });
  }

  function handleDelete() {
    run("delete", async () => {
      const result = await deleteEmployeeAccount(employee.id);
      if (result.error) {
        setError(result.error);
        setDeleteStep("idle");
      } else {
        onDeleted();
      }
    });
  }

  const enrolledIds = new Set(enrollments.map((e) => e.course_id));
  const availableCourses = companyCourses.filter((c) => !enrolledIds.has(c.id));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-[var(--surface-container-lowest)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--outline-variant)] px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-sm font-bold text-[var(--on-primary-fixed-variant)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[var(--on-surface)]">
              {employee.full_name ?? employee.email ?? "Employee"}
            </p>
            {employee.full_name && employee.email && (
              <p className="truncate text-xs text-[var(--on-surface-variant)]">{employee.email}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
            aria-label="Close panel"
          >
            <X size={17} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {error && (
            <p className="rounded-lg border border-[var(--error-container)] bg-[var(--error-container)] px-4 py-2.5 text-sm text-[var(--on-error-container)]">
              {error}
            </p>
          )}

          {/* ── Enrollments ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--outline)]">
              Course enrollments
            </h3>

            {enrollments.length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">No courses enrolled.</p>
            ) : (
              <div className="space-y-2">
                {enrollments.map((course) => {
                  const isComplete = course.progress_percentage === 100;
                  const removing = pendingAction === `remove-${course.course_id}`;
                  return (
                    <div
                      key={course.course_id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2.5"
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isComplete
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 size={13} strokeWidth={2} />
                        ) : (
                          <BookOpen size={13} strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--on-surface)]">{course.title}</p>
                        <p className="text-xs text-[var(--on-surface-variant)]">
                          {course.progress_percentage.toFixed(0)}% ·{" "}
                          {isComplete ? "Completed" : course.progress_percentage === 0 ? "Not started" : "In progress"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveEnrollment(course.course_id)}
                        disabled={isPending}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="Remove enrollment"
                      >
                        {removing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add course */}
            {availableCourses.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-[var(--on-surface-variant)]">Enroll in another course</p>
                <div className="space-y-1.5">
                  {availableCourses.map((course) => {
                    const assigning = pendingAction === `assign-${course.id}`;
                    return (
                      <button
                        key={course.id}
                        onClick={() => handleAssignCourse(course.id)}
                        disabled={isPending}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-[var(--outline-variant)] px-3 py-2 text-left text-sm text-[var(--on-surface-variant)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-fixed)] hover:text-[var(--on-primary-fixed-variant)] disabled:opacity-40"
                      >
                        {assigning ? (
                          <Loader2 size={14} className="shrink-0 animate-spin" />
                        ) : (
                          <Plus size={14} strokeWidth={1.5} className="shrink-0" />
                        )}
                        <span className="truncate">{course.title}</span>
                        {course.target_language && (
                          <span className="ml-auto shrink-0 text-xs opacity-60">{course.target_language}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ── Password reset ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--outline)]">
              Account
            </h3>
            <PasswordResetBlock employeeId={employee.id} />
          </section>

          {/* ── Delete account ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--outline)]">
              Danger zone
            </h3>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="mb-3 text-sm text-red-800">
                Permanently deletes this employee's account, enrollments, and all progress. This cannot be undone.
              </p>
              {deleteStep === "idle" ? (
                <button
                  onClick={() => setDeleteStep("confirm")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm ring-1 ring-red-200 transition hover:bg-red-600 hover:text-white"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                  Delete account
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-red-800">Are you sure?</p>
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {pendingAction === "delete" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} strokeWidth={1.5} />
                    )}
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setDeleteStep("idle")}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-[var(--on-surface-variant)] shadow-sm ring-1 ring-[var(--outline-variant)] transition hover:bg-[var(--surface-container)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function PasswordResetBlock({ employeeId }: { employeeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setLink(null);
    setError(null);
    startTransition(async () => {
      const result = await generateEmployeePasswordReset(employeeId);
      if (result.error) setError(result.error);
      else if (result.link) setLink(result.link);
    });
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!link) {
    return (
      <div className="space-y-2">
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-1.5 text-sm font-medium text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} strokeWidth={1.5} />}
          {isPending ? "Generating…" : "Generate password reset link"}
        </button>
        {error && <p className="text-xs text-[var(--error)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--on-surface-variant)]">Share this link — it expires after one use.</p>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2">
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--on-surface)]">{link}</p>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded p-1 text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
          title="Copy link"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} strokeWidth={1.5} />}
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
  );
}
