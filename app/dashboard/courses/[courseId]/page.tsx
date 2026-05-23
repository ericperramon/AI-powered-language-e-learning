import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, FileText, Lock, PlayCircle, Trophy } from "lucide-react";
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
  const lessonProgress = new Map((lessonProgressData ?? []).map((progress) => [progress.lesson_id, progress]));
  const unitProgress = new Map((unitProgressData ?? []).map((progress) => [progress.unit_id, progress]));

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
    <main className="app-container min-h-screen py-8">
      <AssistantContextSetter courseContext={assistantContext} />
      <div className="mb-5">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]" href="/dashboard">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </div>

      <header className="border-b border-[var(--outline-variant)] pb-8">
        <p className="text-sm font-medium text-[var(--outline)]">
          {course.target_language} · {course.level ?? "Level not set"}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl font-bold text-[var(--on-surface)]">{course.title}</h1>
            <p className="mt-3 text-base leading-7 text-[var(--on-surface-variant)]">
              {course.description ?? "Course content is pending."}
            </p>
          </div>
          <div className="rounded-[var(--r-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <p className="text-sm text-[var(--outline)]">Course progress</p>
            <p className="font-display mt-1 text-2xl font-bold text-[var(--on-surface)]">
              {Number(enrollment.progress_percentage).toFixed(0)}%
            </p>
          </div>
        </div>
      </header>

      {query.success ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Progress saved successfully.
        </div>
      ) : null}
      {query.error ? (
        <div className="mt-5 rounded-lg border border-[var(--error-container)] bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--on-error-container)]">
          {decodeURIComponent(query.error)}
        </div>
      ) : null}

      <section className="space-y-5 py-6">
        {units.map((unit, unitIndex) => {
          const previousUnit = units[unitIndex - 1];
          const unitIsUnlocked = unitIndex === 0 || Boolean(previousUnit && unitProgress.get(previousUnit.id)?.is_completed);
          const examLesson = unit.lessons.find((lesson) => lesson.lesson_type === "exam" || lesson.requires_exam);
          const orderedLessons = unit.lessons.filter((lesson) => lesson.id !== examLesson?.id);
          const lessonsCompleted = orderedLessons.every((lesson) => lessonProgress.get(lesson.id)?.is_completed);
          const unitCompleted = Boolean(unitProgress.get(unit.id)?.is_completed);
          const testUnlocked = unitIsUnlocked && orderedLessons.length > 0 && lessonsCompleted;

          return (
            <Card key={unit.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--outline)]">Unit {unit.sort_order}</p>
                    <h2 className="font-display text-2xl font-semibold text-[var(--on-surface)]">{unit.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">
                      {unit.description ?? "Unit overview is pending."}
                    </p>
                  </div>
                  <StatusBadge locked={!unitIsUnlocked} completed={unitCompleted} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 lg:grid-cols-2">
                  {orderedLessons.map((lesson, lessonIndex) => {
                    const previousLesson = orderedLessons[lessonIndex - 1];
                    const previousCompleted =
                      lessonIndex === 0 || Boolean(previousLesson && lessonProgress.get(previousLesson.id)?.is_completed);
                    const lessonUnlocked = unitIsUnlocked && previousCompleted;
                    const progress = lessonProgress.get(lesson.id);

                    return (
                      <LessonCard
                        courseId={course.id}
                        key={lesson.id}
                        lesson={lesson}
                        locked={!lessonUnlocked}
                        progress={progress}
                      />
                    );
                  })}
                </div>

                <div className="mt-4 rounded-[var(--r-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]">
                        <Trophy strokeWidth={1.5} size={18} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--on-surface)]">End-of-unit test</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">
                          Complete all lessons and the summary before taking this test. A score of 80% is required to unlock the next unit.
                        </p>
                      </div>
                    </div>
                    {examLesson && (testUnlocked || unitCompleted) ? (
                      <Link
                        className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold ${
                          unitCompleted
                            ? "border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
                            : "brand-accent-bg text-[var(--on-primary)]"
                        }`}
                        href={`/dashboard/courses/${course.id}/lessons/${examLesson.id}?stage=test`}
                      >
                        {unitCompleted ? "Review test" : "Start test"}
                      </Link>
                    ) : (
                      <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 text-sm font-semibold text-[var(--outline)]">
                        <Lock strokeWidth={1.5} size={16} />
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
      </section>
    </main>
  );
}

function StatusBadge({ locked, completed }: { locked: boolean; completed: boolean }) {
  if (completed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
        <CheckCircle2 strokeWidth={1.5} size={16} />
        Completed
      </span>
    );
  }

  if (locked) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-container)] px-3 py-1.5 text-sm font-medium text-[var(--outline)]">
        <Lock strokeWidth={1.5} size={16} />
        Locked
      </span>
    );
  }

  return (
    <span className="rounded-full bg-[var(--primary-fixed)] px-3 py-1.5 text-sm font-medium text-[var(--on-primary-fixed-variant)]">
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

  return (
    <div className="flex flex-col justify-between gap-4 rounded-[var(--r-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
          {completed ? (
            <CheckCircle2 strokeWidth={1.5} size={18} />
          ) : locked ? (
            <Lock strokeWidth={1.5} size={18} />
          ) : lesson.lesson_type === "text" && lesson.pdf_url ? (
            <FileText strokeWidth={1.5} size={18} />
          ) : (
            <PlayCircle strokeWidth={1.5} size={18} />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--outline)]">Lesson {lesson.sort_order}</p>
          <h3 className="font-semibold text-[var(--on-surface)]">{lesson.title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]">
            {lesson.description ?? "Lesson content is pending."}
          </p>
        </div>
      </div>
      {locked ? (
        <span className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--outline-variant)] px-4 text-sm font-semibold text-[var(--outline)]">
          Complete the previous lesson
        </span>
      ) : (
        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--outline-variant)] px-4 text-sm font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
          href={`/dashboard/courses/${courseId}/lessons/${lesson.id}?stage=${
            lesson.lesson_type === "text" && lesson.pdf_url ? "summary" : progress?.video_completed ? "exercises" : "video"
          }`}
        >
          {lesson.lesson_type === "text" && lesson.pdf_url ? <FileText size={16} /> : <BookOpen size={16} />}
          {completed ? "Review" : "Continue"}
        </Link>
      )}
    </div>
  );
}
