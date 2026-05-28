import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lock,
  PlayCircle,
  Trophy
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AssistantContextSetter } from "@/components/assistant-context-setter";
import type { AssistantCourseContext } from "@/lib/assistant/system-prompt";

type Course = {
  id: string;
  title: string;
  description: string | null;
  target_language: string;
  level: string | null;
  estimated_duration_minutes: number | null;
};

type Unit = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: Lesson[];
};

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  lesson_type: "video" | "text" | "exercise" | "mixed" | "exam";
  sort_order: number;
  video_url: string | null;
  pdf_url: string | null;
  requires_exam: boolean;
  minimum_score_to_pass: number | string | null;
};

type LessonProgress = {
  lesson_id: string;
  is_completed: boolean;
  video_completed: boolean;
  exercises_completed: boolean;
  exam_passed: boolean;
  score: number | string | null;
};

type UnitProgress = {
  unit_id: string;
  is_completed: boolean;
};

type Enrollment = {
  progress_percentage: number | string;
  status: string;
};

export default async function CoursePage({
  params,
  searchParams
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { courseId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  const admin = createSupabaseAdminClient();
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("progress_percentage, status")
    .eq("employee_id", user.id)
    .eq("course_id", courseId)
    .single<Enrollment>();

  if (!enrollment) {
    redirect("/dashboard?error=course-not-enrolled");
  }

  const [{ data: course }, { data: unitsData }, { data: lessonProgressData }, { data: unitProgressData }] =
    await Promise.all([
      admin
        .from("courses")
        .select("id, title, description, target_language, level, estimated_duration_minutes")
        .eq("id", courseId)
        .single<Course>(),
      admin
        .from("units")
        .select(
          "id, title, description, sort_order, lessons(id, title, description, lesson_type, sort_order, video_url, pdf_url, requires_exam, minimum_score_to_pass)"
        )
        .eq("course_id", courseId)
        .order("sort_order")
        .order("sort_order", { foreignTable: "lessons" })
        .returns<Unit[]>(),
      admin
        .from("lesson_progress")
        .select("lesson_id, is_completed, video_completed, exercises_completed, exam_passed, score")
        .eq("employee_id", user.id)
        .eq("course_id", courseId)
        .returns<LessonProgress[]>(),
      admin
        .from("unit_progress")
        .select("unit_id, is_completed")
        .eq("employee_id", user.id)
        .eq("course_id", courseId)
        .returns<UnitProgress[]>()
    ]);

  if (!course) {
    redirect("/dashboard?error=course-not-found");
  }

  const units = unitsData ?? [];
  const lessonProgress = new Map((lessonProgressData ?? []).map((p) => [p.lesson_id, p]));
  const unitProgress = new Map((unitProgressData ?? []).map((p) => [p.unit_id, p]));
  const progress = Math.min(Math.max(Number(enrollment.progress_percentage), 0), 100);

  const assistantContext: AssistantCourseContext = {
    course: { title: course.title, target_language: course.target_language, level: course.level },
    units: units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      sort_order: unit.sort_order,
      description: unit.description,
      lessons: unit.lessons
        .filter((l) => l.lesson_type !== "exam")
        .map((l) => ({ id: l.id, title: l.title, sort_order: l.sort_order }))
    })),
    currentUnit: null,
    previousUnit: null,
    currentUnitProgress: 0
  };

  return (
    <main className="min-h-screen w-full px-5 py-8 sm:px-8 lg:px-10">
      <AssistantContextSetter courseContext={assistantContext} />

      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-[var(--on-surface-variant)]">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 font-medium transition-colors hover:text-[var(--on-surface)]"
          >
            <ArrowLeft size={15} strokeWidth={1.5} />
            Dashboard
          </Link>
          <ChevronRight size={14} className="text-[var(--outline)]" />
          <span className="truncate text-[var(--on-surface)]">{course.title}</span>
        </nav>

        {/* Course header */}
        <div className="mb-8 overflow-hidden rounded-[var(--r-xl)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="bg-[var(--primary)] px-6 py-8 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90">
                {course.target_language}
              </span>
              {course.level && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {course.level}
                </span>
              )}
              {course.estimated_duration_minutes && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  ~{Math.round(course.estimated_duration_minutes / 60)}h
                </span>
              )}
            </div>
            <h1 className="font-display mt-4 text-3xl font-bold text-white sm:text-4xl">{course.title}</h1>
            {course.description && (
              <p className="mt-2 text-base leading-7 text-white/75">{course.description}</p>
            )}
          </div>
          <div className="px-6 py-5 sm:px-8">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--on-surface-variant)]">Overall progress</span>
              <span className="font-bold text-[var(--on-surface)]">{progress.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {query.success ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Progress saved successfully.
          </div>
        ) : null}
        {query.error ? (
          <div className="mb-6 rounded-lg border border-[var(--error-container)] bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--on-error-container)]">
            {decodeURIComponent(query.error)}
          </div>
        ) : null}

        {/* Units */}
        <div className="space-y-5">
          {units.map((unit, unitIndex) => {
            const previousUnit = units[unitIndex - 1];
            const unitIsUnlocked =
              unitIndex === 0 || Boolean(previousUnit && unitProgress.get(previousUnit.id)?.is_completed);
            const examLesson = unit.lessons.find((l) => l.lesson_type === "exam" || l.requires_exam);
            const orderedLessons = unit.lessons.filter((l) => l.id !== examLesson?.id);
            const lessonsCompleted = orderedLessons.every((l) => lessonProgress.get(l.id)?.is_completed);
            const unitCompleted = Boolean(unitProgress.get(unit.id)?.is_completed);
            const testUnlocked = unitIsUnlocked && orderedLessons.length > 0 && lessonsCompleted;
            const completedCount = orderedLessons.filter((l) => lessonProgress.get(l.id)?.is_completed).length;

            return (
              <Card key={unit.id} className={!unitIsUnlocked ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                          unitCompleted
                            ? "bg-emerald-50 text-emerald-600"
                            : unitIsUnlocked
                              ? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                              : "bg-[var(--surface-container)] text-[var(--outline)]"
                        }`}
                      >
                        {unitCompleted ? (
                          <CheckCircle2 size={16} strokeWidth={2} />
                        ) : !unitIsUnlocked ? (
                          <Lock size={15} strokeWidth={1.5} />
                        ) : (
                          unit.sort_order
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                          Unit {unit.sort_order}
                        </p>
                        <h2 className="font-display text-xl font-semibold text-[var(--on-surface)]">{unit.title}</h2>
                        {unit.description && (
                          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--on-surface-variant)]">
                            {unit.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusBadge locked={!unitIsUnlocked} completed={unitCompleted} total={orderedLessons.length} done={completedCount} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {orderedLessons.map((lesson, lessonIndex) => {
                      const previousLesson = orderedLessons[lessonIndex - 1];
                      const previousCompleted =
                        lessonIndex === 0 ||
                        Boolean(previousLesson && lessonProgress.get(previousLesson.id)?.is_completed);
                      const lessonUnlocked = unitIsUnlocked && previousCompleted;
                      const lProgress = lessonProgress.get(lesson.id);

                      return (
                        <LessonCard
                          courseId={course.id}
                          key={lesson.id}
                          lesson={lesson}
                          locked={!lessonUnlocked}
                          progress={lProgress}
                        />
                      );
                    })}
                  </div>

                  {/* Unit test */}
                  <div className="mt-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            unitCompleted
                              ? "bg-emerald-50 text-emerald-600"
                              : testUnlocked
                                ? "bg-[var(--primary)] text-white"
                                : "bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]"
                          }`}
                        >
                          <Trophy strokeWidth={1.5} size={17} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--on-surface)]">End-of-unit test</h3>
                          <p className="mt-0.5 text-sm leading-6 text-[var(--on-surface-variant)]">
                            Complete all lessons before taking this test. A score of 80% is required to unlock the next unit.
                          </p>
                        </div>
                      </div>
                      {examLesson && (testUnlocked || unitCompleted) ? (
                        <Link
                          className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                            unitCompleted
                              ? "border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
                              : "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-container)]"
                          }`}
                          href={`/dashboard/courses/${course.id}/lessons/${examLesson.id}?stage=test`}
                        >
                          {unitCompleted ? "Review test" : "Start test"}
                        </Link>
                      ) : (
                        <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 text-sm font-semibold text-[var(--outline)]">
                          <Lock strokeWidth={1.5} size={15} />
                          {examLesson ? "Locked" : "Content pending"}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {units.length === 0 ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">Content pending</h2>
                <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
                  This course does not have units or lessons loaded in Supabase yet. Once the content is ready, it can
                  follow this flow: video, exercises, PDF summary and graded test.
                </p>
              </CardHeader>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function StatusBadge({
  locked,
  completed,
  total,
  done
}: {
  locked: boolean;
  completed: boolean;
  total: number;
  done: number;
}) {
  if (completed) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
        <CheckCircle2 strokeWidth={1.5} size={15} />
        Completed
      </span>
    );
  }

  if (locked) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-container)] px-3 py-1.5 text-sm font-medium text-[var(--outline)]">
        <Lock strokeWidth={1.5} size={15} />
        Locked
      </span>
    );
  }

  if (total > 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--primary-fixed)] px-3 py-1.5 text-sm font-medium text-[var(--on-primary-fixed-variant)]">
        {done}/{total} lessons
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--primary-fixed)] px-3 py-1.5 text-sm font-medium text-[var(--on-primary-fixed-variant)]">
      Available
    </span>
  );
}

function LessonCard({
  courseId,
  lesson,
  locked,
  progress
}: {
  courseId: string;
  lesson: Lesson;
  locked: boolean;
  progress?: LessonProgress;
}) {
  const completed = Boolean(progress?.is_completed);
  const isSummary = lesson.lesson_type === "text" && lesson.pdf_url;

  return (
    <div
      className={`flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors ${
        locked
          ? "border-[var(--outline-variant)] bg-[var(--surface-container-low)] opacity-70"
          : completed
            ? "border-emerald-200 bg-emerald-50/40"
            : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] hover:border-[var(--primary-fixed-dim)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            completed
              ? "bg-emerald-100 text-emerald-600"
              : locked
                ? "bg-[var(--surface-container)] text-[var(--outline)]"
                : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
          }`}
        >
          {completed ? (
            <CheckCircle2 strokeWidth={1.5} size={16} />
          ) : locked ? (
            <Lock strokeWidth={1.5} size={15} />
          ) : isSummary ? (
            <FileText strokeWidth={1.5} size={16} />
          ) : (
            <PlayCircle strokeWidth={1.5} size={16} />
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--outline)]">Lesson {lesson.sort_order}</p>
          <h3 className="font-semibold text-[var(--on-surface)]">{lesson.title}</h3>
          {lesson.description && (
            <p className="mt-0.5 text-sm leading-5 text-[var(--on-surface-variant)]">{lesson.description}</p>
          )}
        </div>
      </div>
      {locked ? (
        <span className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--outline-variant)] px-4 text-xs font-semibold text-[var(--outline)]">
          Complete the previous lesson
        </span>
      ) : (
        <Link
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors ${
            completed
              ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] hover:bg-[var(--primary-fixed)] hover:border-[var(--primary-fixed-dim)]"
          }`}
          href={`/dashboard/courses/${courseId}/lessons/${lesson.id}?stage=${
            isSummary ? "summary" : progress?.video_completed ? "exercises" : "video"
          }`}
        >
          {isSummary ? <FileText size={14} /> : <BookOpen size={14} />}
          {completed ? "Review" : progress?.video_completed ? "Continue" : "Start"}
        </Link>
      )}
    </div>
  );
}
