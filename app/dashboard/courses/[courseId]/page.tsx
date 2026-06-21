import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lock,
  Mic,
  PlayCircle,
  SpellCheck,
  Trophy
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AssistantContextSetter } from "@/components/assistant-context-setter";
import { LessonVideoPlayer } from "@/components/courses/lesson-video-player";
import type { AssistantCourseContext } from "@/lib/assistant/system-prompt";
import { UnitRow } from "./unit-row";

const SKILLS = [
  { label: "Reading", icon: BookOpen },
  { label: "Grammar", icon: SpellCheck },
  { label: "Speaking", icon: Mic }
] as const;

function getSkillForLesson(title: string) {
  const normalized = title.toLowerCase();
  return SKILLS.find((skill) => normalized.includes(skill.label.toLowerCase()));
}

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
  content_json: Record<string, unknown>;
  requires_exam: boolean;
  minimum_score_to_pass: number | string | null;
  exercises: Array<{ count: number }>;
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

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const isPreview = profile?.role === "superadmin";

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("progress_percentage, status")
    .eq("employee_id", user.id)
    .eq("course_id", courseId)
    .single<Enrollment>();

  if (!enrollment && !isPreview) {
    redirect("/dashboard?error=course-not-enrolled");
  }

  const [
    { data: course },
    { data: unitsData },
    { data: lessonProgressData },
    { data: unitProgressData },
    { data: passedAttemptsData },
  ] = await Promise.all([
    admin
      .from("courses")
      .select("id, title, description, target_language, level, estimated_duration_minutes")
      .eq("id", courseId)
      .single<Course>(),
    admin
      .from("units")
      .select(
        "id, title, description, sort_order, lessons(id, title, description, lesson_type, sort_order, video_url, pdf_url, content_json, requires_exam, minimum_score_to_pass, exercises(count))"
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
      .returns<UnitProgress[]>(),
    admin
      .from("exercise_attempts")
      .select("lesson_id, exercise_id")
      .eq("employee_id", user.id)
      .eq("course_id", courseId)
      .eq("passed", true)
      .returns<Array<{ lesson_id: string; exercise_id: string }>>(),
  ]);

  if (!course) {
    redirect("/dashboard?error=course-not-found");
  }

  const units = unitsData ?? [];
  const lessonProgress = new Map((lessonProgressData ?? []).map((p) => [p.lesson_id, p]));
  const unitProgress = new Map((unitProgressData ?? []).map((p) => [p.unit_id, p]));
  const progress = enrollment ? Math.min(Math.max(Number(enrollment.progress_percentage), 0), 100) : 0;

  const passedExercisesByLesson = new Map<string, number>();
  for (const attempt of passedAttemptsData ?? []) {
    passedExercisesByLesson.set(
      attempt.lesson_id,
      (passedExercisesByLesson.get(attempt.lesson_id) ?? 0) + 1
    );
  }

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
        <div className="space-y-3">
          {units.map((unit, unitIndex) => {
            const previousUnit = units[unitIndex - 1];
            const unitIsUnlocked =
              isPreview ||
              unitIndex === 0 ||
              Boolean(previousUnit && unitProgress.get(previousUnit.id)?.is_completed);
            const examLesson = unit.lessons.find((l) => l.lesson_type === "exam" || l.requires_exam);
            const orderedLessons = unit.lessons.filter((l) => l.id !== examLesson?.id);
            const videoLesson = orderedLessons[0]?.lesson_type === "video" ? orderedLessons[0] : null;
            const skillLessons = videoLesson ? orderedLessons.slice(1) : orderedLessons;
            const lessonsCompleted = isPreview || orderedLessons.every((l) => lessonProgress.get(l.id)?.is_completed);
            const unitCompleted = Boolean(unitProgress.get(unit.id)?.is_completed);
            const testUnlocked = isPreview || (unitIsUnlocked && orderedLessons.length > 0 && lessonsCompleted);
            const completedCount = orderedLessons.filter((l) => lessonProgress.get(l.id)?.is_completed).length;
            const isFirstActiveUnit = unitIsUnlocked && !unitCompleted && units.slice(0, unitIndex).every((u) => Boolean(unitProgress.get(u.id)?.is_completed));

            return (
              <UnitRow
                key={unit.id}
                unit={unit}
                locked={!unitIsUnlocked}
                completed={unitCompleted}
                completedCount={completedCount}
                total={orderedLessons.length}
                defaultOpen={isFirstActiveUnit || (unitIndex === 0 && !unitCompleted)}
              >
                {videoLesson && (
                  <div className="mb-4">
                    <LessonVideoPlayer
                      courseId={course.id}
                      unitId={unit.id}
                      lessonId={videoLesson.id}
                      lessonType={videoLesson.lesson_type}
                      videoUrl={videoLesson.video_url}
                      thumbnailUrl={
                        typeof videoLesson.content_json.thumbnail_url === "string"
                          ? videoLesson.content_json.thumbnail_url
                          : null
                      }
                      title={videoLesson.title}
                      nextLessonId={skillLessons[0]?.id ?? null}
                      locked={!unitIsUnlocked}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {skillLessons.map((lesson, lessonIndex) => {
                    const previousLesson = videoLesson
                      ? (lessonIndex === 0 ? videoLesson : skillLessons[lessonIndex - 1])
                      : skillLessons[lessonIndex - 1];
                    const previousCompleted =
                      isPreview ||
                      (lessonIndex === 0 && !videoLesson) ||
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
                        passedExerciseCount={passedExercisesByLesson.get(lesson.id) ?? 0}
                        skill={getSkillForLesson(lesson.title)}
                      />
                    );
                  })}
                </div>

                {/* Final Exam */}
                {examLesson && (
                  <div
                    className={`mt-2 flex items-center gap-4 rounded-2xl border px-4 py-3.5 ${
                      unitCompleted
                        ? "border-emerald-200 bg-emerald-50/30"
                        : testUnlocked
                          ? "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                          : "border-[var(--outline-variant)] bg-[var(--surface-container-low)] opacity-75"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        unitCompleted
                          ? "bg-emerald-100 text-emerald-600"
                          : testUnlocked
                            ? "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                            : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
                      }`}
                    >
                      <Trophy strokeWidth={1.5} size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[var(--outline)]">Final Exam</p>
                      <h3 className="font-bold leading-tight text-[var(--on-surface)]">{examLesson.title}</h3>
                    </div>
                    {testUnlocked || unitCompleted ? (
                      <Link
                        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors ${
                          unitCompleted
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)] hover:bg-[var(--primary-fixed-dim)]"
                        }`}
                        href={`/dashboard/courses/${course.id}/lessons/${examLesson.id}?stage=test`}
                      >
                        {unitCompleted ? "Review exam" : "Start exam"}
                      </Link>
                    ) : (
                      <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container)] px-4 text-xs font-semibold text-[var(--outline)]">
                        Complete the previous lesson
                      </span>
                    )}
                  </div>
                )}
              </UnitRow>
            );
          })}

          {units.length === 0 ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">Content pending</h2>
                <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
                  This course does not have units or lessons loaded yet. Once ready, it will follow this flow: video, exercises, PDF summary and graded test.
                </p>
              </CardHeader>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function LessonCard({
  courseId,
  lesson,
  locked,
  progress,
  passedExerciseCount,
  skill,
}: {
  courseId: string;
  lesson: Lesson;
  locked: boolean;
  progress?: LessonProgress;
  passedExerciseCount: number;
  skill?: (typeof SKILLS)[number];
}) {
  const completed = Boolean(progress?.is_completed);
  const isSummary = lesson.lesson_type === "text" && lesson.pdf_url;
  const totalExercises = lesson.exercises?.[0]?.count ?? 0;

  function getIcon() {
    if (completed) return <CheckCircle2 strokeWidth={1.5} size={17} />;
    if (locked) return <Lock strokeWidth={1.5} size={16} />;
    if (skill) return <skill.icon strokeWidth={1.5} size={17} />;
    if (isSummary) return <FileText strokeWidth={1.5} size={17} />;
    return <PlayCircle strokeWidth={1.5} size={17} />;
  }

  function getHref() {
    if (isSummary) return `/dashboard/courses/${courseId}/lessons/${lesson.id}?stage=summary`;
    return `/dashboard/courses/${courseId}/lessons/${lesson.id}?stage=${progress?.video_completed ? "exercises" : "video"}`;
  }

  function getButtonLabel() {
    if (completed) return "Review";
    if (progress?.video_completed || passedExerciseCount > 0) return "Continue";
    return "Start";
  }

  const iconBg = locked
    ? "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
    : completed
      ? "bg-emerald-100 text-emerald-600"
      : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]";

  const rowBg = locked
    ? "border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
    : completed
      ? "border-emerald-200 bg-emerald-50/30"
      : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]";

  return (
    <div className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 ${rowBg} ${locked ? "opacity-75" : ""}`}>
      {/* Icon */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {getIcon()}
      </div>

      {/* Label + title */}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--outline)]">{skill ? skill.label : `Lesson ${lesson.sort_order}`}</p>
        <h3 className="font-bold text-[var(--on-surface)] leading-tight">{lesson.title}</h3>
        {totalExercises > 0 && (
          <p className="mt-0.5 text-xs text-[var(--on-surface-variant)]">
            {passedExerciseCount}/{totalExercises} exercises
          </p>
        )}
      </div>

      {/* Action */}
      {locked ? (
        <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container)] px-4 text-xs font-semibold text-[var(--outline)]">
          Complete the previous lesson
        </span>
      ) : (
        <Link
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors ${
            completed
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)] hover:bg-[var(--primary-fixed-dim)]"
          }`}
          href={getHref()}
        >
          {getButtonLabel()}
        </Link>
      )}
    </div>
  );
}
