import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronRight, ClipboardList, FileText, Lock, Play, PlayCircle, Trophy } from "lucide-react";
import {
  completeLessonVideo,
  completeSummaryLesson,
  submitLessonExercises,
  submitSingleExercise,
  submitUnitTest,
  submitUnitTestExercises
} from "@/app/dashboard/courses/[courseId]/actions";
import { FillInBlanksExercise } from "@/components/exercises/fill-in-blanks";
import { PracticeTaskForm } from "@/components/exercises/practice-task-form";
import { PracticeTaskStatus } from "@/components/courses/practice-task-status";
import type { PracticeTaskSubmissionStatus } from "@/components/courses/practice-task-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AssistantContextSetter } from "@/components/assistant-context-setter";
import type { AssistantCourseContext } from "@/lib/assistant/system-prompt";

type Stage = "video" | "exercises" | "summary" | "test" | "practice_task";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  lesson_type: "video" | "text" | "exercise" | "mixed" | "exam" | "practice_task";
  sort_order: number;
  video_url: string | null;
  pdf_url: string | null;
  content_json: Record<string, unknown>;
  requires_exam: boolean;
  minimum_score_to_pass: number | string | null;
  units:
    | {
        id: string;
        title: string;
        description: string | null;
        sort_order: number;
        course_id: string;
        courses:
          | {
              id: string;
              title: string;
              target_language: string;
              level: string | null;
            }
          | {
              id: string;
              title: string;
              target_language: string;
              level: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        title: string;
        description: string | null;
        sort_order: number;
        course_id: string;
        courses:
          | {
              id: string;
              title: string;
              target_language: string;
              level: string | null;
            }
          | {
              id: string;
              title: string;
              target_language: string;
              level: string | null;
            }[]
          | null;
      }[]
    | null;
};

type UnitIndex = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: Array<{ id: string; title: string; sort_order: number }>;
};

type Exercise = {
  id: string;
  title: string;
  exercise_type: string;
  sort_order: number;
  content_json: Record<string, unknown>;
};

type ExerciseAttempt = {
  exercise_id: string;
  answer_json: Record<string, unknown>;
  ai_analysis_json: Record<string, unknown>;
  score: number | string | null;
  passed: boolean;
  ai_feedback: string | null;
  created_at: string;
};

type LessonProgress = {
  video_completed: boolean;
  exercises_completed: boolean;
  exam_passed: boolean;
  is_completed: boolean;
  score: number | string | null;
};

type PracticeTaskSubmission = {
  status: PracticeTaskSubmissionStatus;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  content_json: { response?: string };
};

export default async function LessonPage({
  params,
  searchParams
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ stage?: string; error?: string; success?: string }>;
}) {
  const { courseId, lessonId } = await params;
  const query = await searchParams;
  const stage = normalizeStage(query.stage);
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
    .select("id")
    .eq("employee_id", user.id)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .single();

  if (!enrollment && !isPreview) {
    redirect("/dashboard?error=course-not-enrolled");
  }

  const [
    { data: lesson },
    { data: exercisesData },
    { data: progress },
    { data: exerciseAttemptsData },
    { data: allUnitsData },
    { data: practiceSubmission },
  ] = await Promise.all([
    admin
      .from("lessons")
      .select(
        "id, title, description, lesson_type, sort_order, video_url, pdf_url, content_json, requires_exam, minimum_score_to_pass, units(id, title, description, sort_order, course_id, courses(id, title, target_language, level))"
      )
      .eq("id", lessonId)
      .single<Lesson>(),
    admin
      .from("exercises")
      .select("id, title, exercise_type, sort_order, content_json")
      .eq("lesson_id", lessonId)
      .order("sort_order")
      .returns<Exercise[]>(),
    admin
      .from("lesson_progress")
      .select("video_completed, exercises_completed, exam_passed, is_completed, score")
      .eq("employee_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle<LessonProgress>(),
    admin
      .from("exercise_attempts")
      .select("exercise_id, answer_json, ai_analysis_json, score, passed, ai_feedback, created_at")
      .eq("employee_id", user.id)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false })
      .returns<ExerciseAttempt[]>(),
    admin
      .from("units")
      .select("id, title, description, sort_order, lessons(id, title, sort_order)")
      .eq("course_id", courseId)
      .order("sort_order")
      .order("sort_order", { foreignTable: "lessons" })
      .returns<UnitIndex[]>(),
    admin
      .from("practice_task_submissions")
      .select("status, reviewer_notes, reviewed_at, content_json")
      .eq("employee_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle<PracticeTaskSubmission>(),
  ]);

  if (!lesson) {
    redirect(`/dashboard/courses/${courseId}?error=lesson-not-found`);
  }

  const unit = Array.isArray(lesson.units) ? lesson.units[0] : lesson.units;
  const course = Array.isArray(unit?.courses) ? unit?.courses[0] : unit?.courses;

  if (!unit || unit.course_id !== courseId || !course) {
    redirect("/dashboard?error=invalid-learning-context");
  }

  if (lesson.lesson_type === "exam" && stage !== "test") {
    redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=test`);
  }

  if (lesson.lesson_type === "video" && stage === "exercises") {
    redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=video`);
  }

  if (lesson.lesson_type === "exercise" && stage === "video") {
    redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=exercises`);
  }

  const isSummaryLesson = lesson.lesson_type === "text" && Boolean(lesson.pdf_url);
  const isPracticeTaskLesson = lesson.lesson_type === "practice_task";

  if (isSummaryLesson && stage !== "summary") {
    redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=summary`);
  }

  if (isPracticeTaskLesson && stage !== "practice_task") {
    redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=practice_task`);
  }

  const exercises = exercisesData ?? [];
  const exerciseAttempts = exerciseAttemptsData ?? [];
  const minimumScore = Number(lesson.minimum_score_to_pass ?? 80);

  const allUnits = allUnitsData ?? [];
  const previousUnit = allUnits.find((u) => u.sort_order === unit.sort_order - 1) ?? null;

  const assistantContext: AssistantCourseContext = {
    course: { title: course.title, target_language: course.target_language, level: course.level },
    units: allUnits.map((u) => ({
      id: u.id,
      title: u.title,
      sort_order: u.sort_order,
      description: u.description,
      lessons: (u.lessons ?? []).map((l) => ({ id: l.id, title: l.title, sort_order: l.sort_order }))
    })),
    currentUnit: {
      id: unit.id,
      sort_order: unit.sort_order,
      description: unit.description ?? null,
      title: unit.title
    },
    previousUnit: previousUnit
      ? {
          id: previousUnit.id,
          sort_order: previousUnit.sort_order,
          description: previousUnit.description,
          title: previousUnit.title
        }
      : null,
    currentUnitProgress: 0
  };

  const stageSteps =
    lesson.lesson_type === "text" && Boolean(lesson.pdf_url)
      ? null
      : lesson.lesson_type === "exam"
        ? null
        : lesson.lesson_type === "practice_task"
          ? [{ key: "practice_task", label: "Practice Task", icon: ClipboardList }]
          : lesson.lesson_type === "video"
            ? [{ key: "video", label: "Video", icon: PlayCircle }]
            : lesson.lesson_type === "exercise"
              ? [{ key: "exercises", label: "Exercises", icon: CheckCircle2 }]
              : [
                  { key: "video", label: "Video", icon: PlayCircle },
                  { key: "exercises", label: "Exercises", icon: CheckCircle2 }
                ];

  return (
    <main className="min-h-screen w-full px-5 py-8 sm:px-8 lg:px-10">
      <AssistantContextSetter courseContext={assistantContext} />

      <div className="mx-auto max-w-5xl">
        {/* Breadcrumb */}
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-[var(--on-surface-variant)]">
          <Link href="/dashboard" className="font-medium transition-colors hover:text-[var(--on-surface)]">
            Dashboard
          </Link>
          <ChevronRight size={14} className="text-[var(--outline)]" />
          <Link
            href={`/dashboard/courses/${courseId}`}
            className="flex items-center gap-1 font-medium transition-colors hover:text-[var(--on-surface)]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            {course.title}
          </Link>
          <ChevronRight size={14} className="text-[var(--outline)]" />
          <span className="text-[var(--on-surface)]">Unit {unit.sort_order}</span>
        </nav>

        {/* Lesson header — flat, no box */}
        <div className="mb-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
            {unit.title} · Lesson {lesson.sort_order}
          </p>
          <h1 className="font-display mt-2 text-2xl font-bold text-[var(--on-surface)] sm:text-3xl">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">{lesson.description}</p>
          )}

          {/* Stage tabs — underline style */}
          {stageSteps && (
            <div className="mt-6 flex border-b border-[var(--outline-variant)]">
              {stageSteps.map((step) => {
                const isActive = stage === step.key;
                const isDone =
                  step.key === "video"
                    ? Boolean(progress?.video_completed)
                    : step.key === "exercises"
                      ? Boolean(progress?.exercises_completed)
                      : false;
                return (
                  <Link
                    key={step.key}
                    href={`/dashboard/courses/${courseId}/lessons/${lesson.id}?stage=${step.key}`}
                    className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : isDone
                          ? "border-transparent text-emerald-600 hover:text-[var(--on-surface)]"
                          : "border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <step.icon size={14} strokeWidth={1.5} />
                    {step.label}
                    {isDone && !isActive && <CheckCircle2 size={12} className="text-emerald-500" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {query.error ? (
          <div className="mt-5 rounded-md border-l-4 border-[var(--error)] bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--on-error-container)]">
            {query.error === "exercise-failed"
              ? "The score is below the minimum required. Repeat the exercise to continue."
              : "The test score is below 80%. Review the summary and try again."}
          </div>
        ) : null}
        {query.success === "exercise-passed" ? (
          <div className="mt-5 rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Exercise passed. Review the result and corrections below, then continue from the course page.
          </div>
        ) : null}

        <div className="mt-8">
          {stage === "practice_task" ? (
            <PracticeTaskStep
              courseId={courseId}
              lesson={lesson}
              unitId={unit.id}
              submission={practiceSubmission}
            />
          ) : stage === "summary" ? (
            <SummaryStep courseId={courseId} lesson={lesson} unitId={unit.id} />
          ) : stage === "video" ? (
            <VideoStep courseId={courseId} lesson={lesson} unitId={unit.id} />
          ) : stage === "exercises" ? (
            <ExercisesStep
              attempts={exerciseAttempts}
              courseId={courseId}
              exercises={exercises}
              lesson={lesson}
              progress={progress}
              unitId={unit.id}
              videoRequired={!isPreview && lesson.lesson_type !== "exercise"}
            />
          ) : (
            <TestStep
              attempts={exerciseAttempts}
              courseId={courseId}
              exercises={exercises}
              lesson={lesson}
              minimumScore={minimumScore}
              unitCompleted={Boolean(progress?.exam_passed)}
              unitId={unit.id}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function normalizeStage(stage?: string): Stage {
  if (stage === "exercises" || stage === "summary" || stage === "test" || stage === "practice_task") {
    return stage;
  }

  return "video";
}

function PracticeTaskStep({
  courseId,
  lesson,
  unitId,
  submission,
}: {
  courseId: string;
  lesson: Lesson;
  unitId: string;
  submission: PracticeTaskSubmission | null;
}) {
  const instructions =
    typeof (lesson.content_json as Record<string, unknown>).instructions === "string"
      ? (lesson.content_json as Record<string, unknown>).instructions as string
      : "Complete the task described below and submit your written response. Your tutor will review it and provide personalised feedback.";

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-[var(--on-surface-variant)]">
        <ClipboardList strokeWidth={1.5} size={16} />
        <span className="text-sm">Submit your response. Your tutor will review it and provide feedback.</span>
      </div>
      {submission ? (
        <div className="space-y-6">
          <PracticeTaskStatus
            status={submission.status}
            reviewerNotes={submission.reviewer_notes}
            reviewedAt={submission.reviewed_at}
          />
          {submission.content_json?.response && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                Your submission
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--on-surface)]">
                {submission.content_json.response}
              </p>
            </div>
          )}
          {submission.status === "revision_needed" && (
            <PracticeTaskForm courseId={courseId} unitId={unitId} lessonId={lesson.id} instructions={instructions} />
          )}
        </div>
      ) : (
        <PracticeTaskForm courseId={courseId} unitId={unitId} lessonId={lesson.id} instructions={instructions} />
      )}
    </div>
  );
}

function SummaryStep({ courseId, lesson, unitId }: { courseId: string; lesson: Lesson; unitId: string }) {
  return (
    <div>
      <p className="mb-5 text-sm leading-6 text-[var(--on-surface-variant)]">
        Review this summary before taking the graded test.
      </p>
      {lesson.pdf_url ? (
        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--outline-variant)] px-4 text-sm font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] transition-colors"
          href={lesson.pdf_url}
          target="_blank"
        >
          <FileText strokeWidth={1.5} size={16} />
          Open PDF
        </Link>
      ) : (
        <div className="rounded-md border border-dashed border-[var(--outline-variant)] p-4 text-sm text-[var(--outline)]">
          PDF pending. Upload the summary to Supabase Storage and save its public URL in this lesson.
        </div>
      )}
      <div className="mt-8 border-t border-[var(--outline-variant)] pt-6">
        <form action={completeSummaryLesson}>
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="lessonId" type="hidden" value={lesson.id} />
          <Button type="submit">
            <CheckCircle2 strokeWidth={1.5} size={16} />
            Mark summary as reviewed
          </Button>
        </form>
      </div>
    </div>
  );
}

function VideoStep({ courseId, lesson, unitId }: { courseId: string; lesson: Lesson; unitId: string }) {
  const videoEmbedUrl = getVideoEmbedUrl(lesson.video_url);

  return (
    <div>
      {videoEmbedUrl ? (
        <div className="overflow-hidden rounded-md bg-black">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
            src={videoEmbedUrl}
            title={lesson.title}
          />
        </div>
      ) : (
        <figure className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-[var(--outline-variant)] bg-gradient-to-br from-[var(--surface-container-low)] via-[var(--surface-container)] to-[var(--surface-container-high)] p-6 text-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "linear-gradient(var(--outline-variant) 1px, transparent 1px), linear-gradient(90deg, var(--outline-variant) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at center, black 35%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 78%)"
            }}
          />
          <span className="ds-chip absolute left-4 top-4">Coming soon</span>
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_14px_36px_rgba(42,111,151,0.30)]">
            <Play size={24} strokeWidth={1.5} className="translate-x-0.5" />
          </span>
          <figcaption className="relative max-w-xs text-sm leading-6 text-[var(--on-surface-variant)]">
            Video pending. Once the content is added, the lesson video will appear here.
          </figcaption>
        </figure>
      )}

      <div className="mt-8 border-t border-[var(--outline-variant)] pt-6">
        <form action={completeLessonVideo}>
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="lessonId" type="hidden" value={lesson.id} />
          <input name="lessonType" type="hidden" value={lesson.lesson_type} />
          <Button type="submit">
            <CheckCircle2 strokeWidth={1.5} size={16} />
            {lesson.lesson_type === "video" ? "Mark video as watched and continue" : "Mark video as watched and start exercises"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function getVideoEmbedUrl(videoUrl: string | null) {
  if (!videoUrl) {
    return null;
  }

  try {
    const url = new URL(videoUrl);

    if (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : videoUrl;
    }

    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
    }

    if (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
    }

    return videoUrl;
  } catch {
    return videoUrl;
  }
}

function ExercisesStep({
  attempts,
  courseId,
  exercises,
  lesson,
  progress,
  unitId,
  videoRequired = true
}: {
  attempts: ExerciseAttempt[];
  courseId: string;
  exercises: Exercise[];
  lesson: Lesson;
  progress: LessonProgress | null;
  unitId: string;
  videoRequired?: boolean;
}) {
  if (videoRequired && !progress?.video_completed) {
    return (
      <div className="flex items-center gap-3 py-6 text-[var(--on-surface-variant)]">
        <Lock strokeWidth={1.5} size={18} />
        <div>
          <p className="font-medium text-[var(--on-surface)]">Exercises locked</p>
          <p className="text-sm">Complete the lesson video first.</p>
        </div>
      </div>
    );
  }

  // No exercises loaded yet
  if (exercises.length === 0) {
    return (
      <div>
        <div className="rounded-md border border-dashed border-[var(--outline-variant)] p-4 text-sm text-[var(--outline)]">
          Exercises pending. They will appear here once the prepared content is loaded.
        </div>
        <div className="mt-8 border-t border-[var(--outline-variant)] pt-6">
          <form action={submitLessonExercises}>
            <input name="courseId" type="hidden" value={courseId} />
            <input name="unitId" type="hidden" value={unitId} />
            <input name="lessonId" type="hidden" value={lesson.id} />
            <Button type="submit">
              <CheckCircle2 strokeWidth={1.5} size={16} />
              Mark as complete and continue
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Build latest attempt per exercise (attempts already ordered by created_at DESC)
  const latestAttempts = new Map<string, ExerciseAttempt>();
  for (const attempt of attempts) {
    if (!latestAttempts.has(attempt.exercise_id)) {
      latestAttempts.set(attempt.exercise_id, attempt);
    }
  }

  const passedIds = new Set(
    [...latestAttempts.entries()].filter(([, a]) => a.passed).map(([id]) => id)
  );

  const currentIdx = exercises.findIndex((e) => !passedIds.has(e.id));
  const allPassed = currentIdx === -1;

  // All passed but action hasn't redirected yet (edge case)
  if (allPassed) {
    return (
      <div className="py-8 text-center">
        <p className="font-semibold text-[var(--on-surface)]">All exercises completed!</p>
        <Link
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-[var(--outline-variant)] px-4 text-sm font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] transition-colors"
          href={`/dashboard/courses/${courseId}`}
        >
          Back to course
        </Link>
      </div>
    );
  }

  const currentExercise = exercises[currentIdx];
  const currentAttempt = latestAttempts.get(currentExercise.id) ?? null;
  const isFillInBlanks =
    Boolean(
      getExerciseBlanks(currentExercise.content_json) ??
        getExerciseBlanksFromItems(currentExercise.content_json) ??
        getExerciseTextBlanks(currentExercise.content_json)
    ) || getExerciseQuestions(currentExercise.content_json).length > 0;

  return (
    <div>
      {/* Exercise header + progress */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
            Exercise {currentIdx + 1} of {exercises.length} · {currentExercise.exercise_type}
          </p>
          <h2 className="font-display mt-1 text-xl font-semibold text-[var(--on-surface)]">
            {currentExercise.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-1">
          {exercises.map((ex, i) => (
            <div
              key={ex.id}
              className={`h-2 w-2 rounded-full transition-colors ${
                passedIds.has(ex.id)
                  ? "bg-emerald-500"
                  : i === currentIdx
                    ? "bg-[var(--primary)]"
                    : "bg-[var(--outline-variant)]"
              }`}
            />
          ))}
        </div>
      </div>

      {currentAttempt && !currentAttempt.passed && (
        <div className="mb-5 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">{currentAttempt.ai_feedback ?? "Incorrect answer. Try again."}</p>
        </div>
      )}

      <form action={submitSingleExercise} className="space-y-6">
        <input name="courseId" type="hidden" value={courseId} />
        <input name="unitId" type="hidden" value={unitId} />
        <input name="lessonId" type="hidden" value={lesson.id} />
        <input name="exerciseId" type="hidden" value={currentExercise.id} />

        {!isFillInBlanks && (
          <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
            {formatExerciseContent(currentExercise.content_json)}
          </p>
        )}

        <ExerciseAnswerControl exercise={currentExercise} previousAttempt={currentAttempt ?? undefined} />

        <div className="border-t border-[var(--outline-variant)] pt-6">
          <Button type="submit">
            <CheckCircle2 strokeWidth={1.5} size={16} />
            {currentAttempt && !currentAttempt.passed ? "Try again" : "Submit answer"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ExerciseAnswerControl({
  exercise,
  previousAttempt
}: {
  exercise: Exercise;
  previousAttempt?: ExerciseAttempt;
}) {
  const questions = getExerciseQuestions(exercise.content_json);

  if (questions.length > 0) {
    return (
      <QuestionsExercise
        exercise={exercise}
        questions={questions}
        previousAttempt={previousAttempt}
      />
    );
  }

  const freeWritingData = getFreeWritingData(exercise.content_json);
  const sentencesData = !freeWritingData ? getExerciseSentences(exercise.content_json) : null;
  const pairs = getExercisePairs(exercise.content_json);
  const blanksData = getExerciseBlanks(exercise.content_json) ?? getExerciseBlanksFromItems(exercise.content_json);
  const textBlanksData = !blanksData ? getExerciseTextBlanks(exercise.content_json) : null;
  const items = getExerciseItems(exercise.content_json);
  const options = getExerciseOptions(exercise.content_json);
  const previousAnswer = readPreviousAnswer(previousAttempt);
  const incorrectAnswers = getIncorrectAnswers(previousAttempt);
  const incorrectIds = new Set(incorrectAnswers.map((a) => a.itemId));
  const score = formatAttemptScore(previousAttempt);

  if (freeWritingData) {
    return (
      <div className="mt-4 space-y-3">
        <FreeWritingExercise
          exerciseId={exercise.id}
          data={freeWritingData}
          previousAnswer={previousAnswer.answer}
        />
        {previousAttempt && (
          <div className={previousAttempt.passed
            ? "border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            : "border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800"}>
            <p className="font-medium whitespace-pre-wrap">{previousAttempt.ai_feedback ?? (previousAttempt.passed ? "Submitted." : "Review and try again.")}</p>
          </div>
        )}
      </div>
    );
  }

  if (sentencesData) {
    return (
      <div className="mt-4 space-y-3">
        {typeof exercise.content_json.instructions === "string" && (
          <p className="text-sm text-[var(--on-surface-variant)]">{exercise.content_json.instructions as string}</p>
        )}
        <SentenceTransformExercise
          exerciseId={exercise.id}
          sentences={sentencesData.sentences}
          example={sentencesData.example}
          previousAnswers={previousAnswer}
          incorrectIds={incorrectIds}
        />
        {previousAttempt && (
          <div className={previousAttempt.passed
            ? "border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            : "border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800"}>
            <p className="font-medium">{score ? `Score: ${score}%. ` : ""}{previousAttempt.ai_feedback ?? (previousAttempt.passed ? "Correct!" : "Review and try again.")}</p>
          </div>
        )}
      </div>
    );
  }

  if (pairs) {
    return (
      <div className="mt-4 space-y-3">
        {typeof exercise.content_json.instructions === "string" && (
          <p className="text-sm text-[var(--on-surface-variant)]">{exercise.content_json.instructions as string}</p>
        )}
        <MatchingExercise
          exerciseId={exercise.id}
          pairs={pairs}
          previousAnswers={previousAnswer}
          incorrectIds={incorrectIds}
        />
        {previousAttempt && (
          <div className={previousAttempt.passed
            ? "border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            : "border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800"}>
            <p className="font-medium">{score ? `Score: ${score}%. ` : ""}{previousAttempt.ai_feedback ?? (previousAttempt.passed ? "All answers correct!" : "Review the marked terms and try again.")}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {blanksData ? (
        <FillInBlanksExercise
          blanks={blanksData.blanks}
          exerciseId={exercise.id}
          previousAnswers={previousAnswer}
          sentence={blanksData.sentence}
        />
      ) : textBlanksData ? (
        <TextBlanksExercise
          exerciseId={exercise.id}
          previousAnswers={previousAnswer}
          sentence={textBlanksData.sentence}
        />
      ) : items.length > 0 && typeof exercise.content_json.question === "string" ? (
        <p className="rounded-lg bg-[var(--surface-container-low)] p-3 text-sm leading-6 text-[var(--on-surface-variant)]">
          {exercise.content_json.question}
        </p>
      ) : null}

      {blanksData || textBlanksData ? null : items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <fieldset key={item.id}>
              <legend className="mb-2 text-sm font-medium leading-6 text-[var(--on-surface)]">
                {item.number ? `${item.number}. ` : ""}
                {item.question}
              </legend>
              <div className="divide-y divide-[var(--outline-variant)] rounded-md border border-[var(--outline-variant)]">
                {item.options.map((option) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container-low)] has-[:checked]:bg-[var(--primary-fixed)] has-[:checked]:text-[var(--on-surface)]"
                    key={option.value}
                  >
                    <input
                      className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                      defaultChecked={previousAnswer[item.id] === option.value}
                      name={`answer_${exercise.id}_${item.id}`}
                      required
                      type="radio"
                      value={option.value}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : options.length > 0 ? (
        <div className="divide-y divide-[var(--outline-variant)] rounded-md border border-[var(--outline-variant)]">
          {options.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container-low)] has-[:checked]:bg-[var(--primary-fixed)] has-[:checked]:text-[var(--on-surface)]"
              key={option.value}
            >
              <input
                className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                defaultChecked={previousAnswer.answer === option.value}
                name={`answer_${exercise.id}`}
                required
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`answer_${exercise.id}`}>Your answer</Label>
          <textarea
            className="brand-accent-focus min-h-24 w-full rounded-lg border-[1.5px] border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3.5 py-2 text-base text-[var(--on-surface)] outline-none transition-colors placeholder:text-[var(--outline)]"
            defaultValue={previousAnswer.answer}
            id={`answer_${exercise.id}`}
            name={`answer_${exercise.id}`}
            placeholder="Write your answer"
            required
          />
        </div>
      )}

      {previousAttempt ? (
        <div
          className={
            previousAttempt.passed
              ? "border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          }
        >
          <p className="font-medium">
            {score ? `Score: ${score}%. ` : ""}
            {previousAttempt.ai_feedback ?? (previousAttempt.passed ? "Exercise passed." : "Repeat the exercise.")}
          </p>
          {previousAttempt.passed && incorrectAnswers.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="font-medium">Corrections</p>
              <ul className="space-y-1">
                {incorrectAnswers.map((incorrectAnswer) => (
                  <li key={incorrectAnswer.itemId}>
                    {incorrectAnswer.itemId}: your answer was{" "}
                    <span className="font-medium">{incorrectAnswer.submittedAnswer || "-"}</span>; correct answer is{" "}
                    <span className="font-medium">{incorrectAnswer.correctText ?? incorrectAnswer.correctAnswer}</span>.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TestStep({
  attempts,
  courseId,
  exercises,
  lesson,
  minimumScore,
  unitCompleted,
  unitId
}: {
  attempts: ExerciseAttempt[];
  courseId: string;
  exercises: Exercise[];
  lesson: Lesson;
  minimumScore: number;
  unitCompleted: boolean;
  unitId: string;
}) {
  const latestAttemptsByExercise = new Map<string, ExerciseAttempt>();

  for (const attempt of attempts) {
    if (!latestAttemptsByExercise.has(attempt.exercise_id)) {
      latestAttemptsByExercise.set(attempt.exercise_id, attempt);
    }
  }

  const allAttempted = exercises.length > 0 && exercises.every((e) => latestAttemptsByExercise.has(e.id));
  const overallScore = allAttempted
    ? Math.round(
        exercises.reduce((sum, e) => sum + Number(latestAttemptsByExercise.get(e.id)?.score ?? 0), 0) / exercises.length
      )
    : null;

  const incorrectByExercise = allAttempted
    ? exercises.flatMap((e) => {
        const attempt = latestAttemptsByExercise.get(e.id);
        const incorrect = getIncorrectAnswers(attempt);
        return incorrect.length > 0 ? [{ exercise: e, incorrect }] : [];
      })
    : [];

  return (
    <div>
      <p className="mb-6 text-sm text-[var(--on-surface-variant)]">
        Passing score: {minimumScore.toFixed(0)}%. If the score is below that, the next unit remains locked.
      </p>

      {allAttempted && overallScore !== null ? (
        <div className="mb-8">
          <div
            className={
              unitCompleted
                ? "border-l-4 border-emerald-500 bg-emerald-50 px-4 py-4 text-emerald-800"
                : "border-l-4 border-amber-400 bg-amber-50 px-4 py-4 text-amber-800"
            }
          >
            <p className="text-lg font-semibold">
              Score: {overallScore}% — {unitCompleted ? "Unit passed!" : `Below the ${minimumScore.toFixed(0)}% required.`}
            </p>
            {incorrectByExercise.length > 0 && (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium">Corrections</p>
                {incorrectByExercise.map(({ exercise: ex, incorrect }) => (
                  <div key={ex.id}>
                    <p className="text-sm font-medium">{ex.title}</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {incorrect.map((item) => (
                        <li key={item.itemId}>
                          {item.itemId}: your answer was{" "}
                          <span className="font-semibold">{item.submittedAnswer || "—"}</span>; correct answer is{" "}
                          <span className="font-semibold">{item.correctText ?? item.correctAnswer}</span>.
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          {unitCompleted && (
            <div className="mt-5">
              <Link
                className="brand-accent-bg inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold"
                href={`/dashboard/courses/${courseId}`}
              >
                Go to course
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {!unitCompleted && exercises.length > 0 ? (
        <form action={submitUnitTestExercises} className="space-y-0">
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="examLessonId" type="hidden" value={lesson.id} />
          <input name="minimumScore" type="hidden" value={minimumScore} />

          <div className="divide-y divide-[var(--outline-variant)]">
            {exercises.map((exercise) => {
              const isFillInBlanks = Boolean(
                getExerciseBlanks(exercise.content_json) ??
                  getExerciseBlanksFromItems(exercise.content_json) ??
                  getExerciseTextBlanks(exercise.content_json)
              );
              return (
                <div className="py-6" key={exercise.id}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                    Question {exercise.sort_order}
                  </p>
                  <h3 className="mb-3 font-semibold text-[var(--on-surface)]">{exercise.title}</h3>
                  {!isFillInBlanks && getExerciseQuestions(exercise.content_json).length === 0 && (
                    <p className="mb-3 text-sm leading-6 text-[var(--on-surface-variant)]">
                      {formatExerciseContent(exercise.content_json)}
                    </p>
                  )}
                  <ExerciseAnswerControl exercise={exercise} />
                </div>
              );
            })}
          </div>

          <div className="border-t border-[var(--outline-variant)] pt-6">
            <Button className="w-full" type="submit">
              <CheckCircle2 strokeWidth={1.5} size={16} />
              {allAttempted ? "Retry test" : "Submit test"}
            </Button>
          </div>
        </form>
      ) : !unitCompleted && exercises.length === 0 ? (
        <form action={submitUnitTest} className="space-y-4">
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="examLessonId" type="hidden" value={lesson.id} />
          <div className="space-y-2">
            <Label htmlFor="score">Score achieved</Label>
            <Input id="score" max={100} min={0} name="score" required step="1" type="number" />
          </div>
          <Button className="w-full" type="submit">
            Submit test
          </Button>
        </form>
      ) : null}
    </div>
  );
}

// ── Questions format helpers ───────────────────────────────────────────────

type QuestionItem = {
  id: string;
  text: string;
  type: "single" | "multiple";
  options: string[];
};

function getExerciseQuestions(content: Record<string, unknown>): QuestionItem[] {
  if (!Array.isArray(content.questions)) return [];
  return content.questions.flatMap((q) => {
    if (typeof q !== "object" || q === null || Array.isArray(q)) return [];
    const qMap = q as Record<string, unknown>;
    if (typeof qMap.id !== "string" || typeof qMap.text !== "string") return [];
    const options = Array.isArray(qMap.options)
      ? qMap.options.flatMap((o) => (typeof o === "string" ? [o] : []))
      : [];
    return [
      {
        id: qMap.id,
        text: qMap.text,
        type: qMap.type === "multiple" ? "multiple" : "single",
        options
      }
    ];
  });
}

function readPreviousQuestionsAnswers(
  attempt?: ExerciseAttempt
): Record<string, string | string[]> {
  if (!attempt) return {};
  const answers = attempt.answer_json.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) return {};
  const map = answers as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [
      k,
      Array.isArray(v)
        ? (v as unknown[]).map(String)
        : typeof v === "string"
          ? v
          : ""
    ])
  );
}

function QuestionsExercise({
  exercise,
  questions,
  previousAttempt
}: {
  exercise: Exercise;
  questions: QuestionItem[];
  previousAttempt?: ExerciseAttempt;
}) {
  const instructions =
    typeof exercise.content_json.instructions === "string"
      ? exercise.content_json.instructions
      : null;
  const modelText =
    typeof exercise.content_json.model_text === "object" &&
    exercise.content_json.model_text !== null &&
    !Array.isArray(exercise.content_json.model_text)
      ? (exercise.content_json.model_text as Record<string, unknown>)
      : null;

  const previousAnswers = readPreviousQuestionsAnswers(previousAttempt);
  const incorrectIds = new Set(
    getIncorrectAnswers(previousAttempt).map((a) => a.itemId)
  );

  return (
    <div className="space-y-5">
      {instructions && (
        <p className="text-sm font-medium text-[var(--on-surface-variant)]">{instructions}</p>
      )}

      {modelText && <ModelTextBlock modelText={modelText} />}

      <div className="space-y-5">
        {questions.map((q) => {
          const prevAnswer = previousAnswers[q.id];
          const isWrong = incorrectIds.has(q.id);

          return (
            <fieldset key={q.id}>
              <legend
                className={`mb-2 text-sm font-semibold leading-6 ${isWrong ? "text-amber-700" : "text-[var(--on-surface)]"}`}
              >
                {q.text}
                {q.type === "multiple" && (
                  <span className="ml-2 text-xs font-normal text-[var(--outline)]">(Select all that apply)</span>
                )}
              </legend>
              <div className={`divide-y rounded-md border ${isWrong ? "divide-amber-200 border-amber-300" : "divide-[var(--outline-variant)] border-[var(--outline-variant)]"}`}>
                {q.options.map((option) => {
                  const isChecked = Array.isArray(prevAnswer)
                    ? prevAnswer.includes(option)
                    : prevAnswer === option;
                  return (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container-low)] has-[:checked]:bg-[var(--primary-fixed)] has-[:checked]:text-[var(--on-surface)]"
                    >
                      <input
                        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                        defaultChecked={isChecked}
                        name={`answer_${exercise.id}_${q.id}`}
                        type={q.type === "multiple" ? "checkbox" : "radio"}
                        value={option}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

const MODEL_TEXT_KNOWN_KEYS = new Set([
  "profile",
  "education",
  "current_employer",
  "responsibilities",
  "previous_employer",
]);

function ModelTextBlock({ modelText }: { modelText: Record<string, unknown> }) {
  const profile = typeof modelText.profile === "string" ? modelText.profile : null;
  const education = typeof modelText.education === "string" ? modelText.education : null;
  const currentEmployer =
    typeof modelText.current_employer === "string" ? modelText.current_employer : null;
  const responsibilities = Array.isArray(modelText.responsibilities)
    ? (modelText.responsibilities as unknown[]).flatMap((r) =>
        typeof r === "string" ? [r] : []
      )
    : [];
  const previousEmployer =
    typeof modelText.previous_employer === "string" ? modelText.previous_employer : null;

  const extraEntries = Object.entries(modelText).filter(
    ([k]) => !MODEL_TEXT_KNOWN_KEYS.has(k)
  );

  return (
    <div className="space-y-3 rounded-sm border-l-4 border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-4 pl-5 pr-4 text-sm leading-6">
      {profile && <p className="italic text-[var(--on-surface)]">{profile}</p>}
      {education && (
        <div>
          <p className="font-semibold text-[var(--on-surface)]">Education</p>
          <p className="text-[var(--on-surface-variant)]">{education}</p>
        </div>
      )}
      {currentEmployer && (
        <div>
          <p className="font-semibold text-[var(--on-surface)]">Current position</p>
          <p className="text-[var(--on-surface-variant)]">{currentEmployer}</p>
          {responsibilities.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--on-surface-variant)]">
              {responsibilities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {previousEmployer && (
        <div>
          <p className="font-semibold text-[var(--on-surface)]">Previous position</p>
          <p className="text-[var(--on-surface-variant)]">{previousEmployer}</p>
        </div>
      )}
      {extraEntries.map(([key, value]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        if (typeof value === "string") {
          return (
            <div key={key}>
              <p className="font-semibold text-[var(--on-surface)]">{label}</p>
              <p className="text-[var(--on-surface-variant)]">{value}</p>
            </div>
          );
        }
        if (Array.isArray(value)) {
          const items = value.flatMap((r) => (typeof r === "string" ? [r] : []));
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <p className="font-semibold text-[var(--on-surface)]">{label}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--on-surface-variant)]">
                {items.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function formatExerciseContent(content: Record<string, unknown>) {
  if (typeof content.prompt === "string") {
    return content.prompt;
  }

  if (typeof content.question === "string") {
    return content.question;
  }

  return "Prompt pending.";
}

function getExerciseOptions(content: Record<string, unknown>) {
  const rawOptions = content.options ?? content.choices;

  if (!Array.isArray(rawOptions)) {
    return [];
  }

  return rawOptions.flatMap((option) => {
    if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
      const value = String(option);
      return [{ label: value, value }];
    }

    if (typeof option === "object" && option !== null && !Array.isArray(option)) {
      const optionMap = option as Record<string, unknown>;
      const value = optionMap.value ?? optionMap.id ?? optionMap.label ?? optionMap.text;
      const label = optionMap.label ?? optionMap.text ?? optionMap.value ?? optionMap.id;

      if (typeof value === "string" && typeof label === "string") {
        return [{ label, value }];
      }
    }

    return [];
  });
}

function readPreviousAnswer(attempt?: ExerciseAttempt): Record<string, string> & { answer: string } {
  const answer = attempt?.answer_json.answer;
  const answers = attempt?.answer_json.answers;

  return {
    answer: typeof answer === "string" ? answer : "",
    ...(typeof answers === "object" && answers !== null && !Array.isArray(answers)
      ? Object.fromEntries(
          Object.entries(answers).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : []))
        )
      : {})
  };
}

function formatAttemptScore(attempt?: ExerciseAttempt) {
  if (attempt?.score === null || attempt?.score === undefined) {
    return null;
  }

  const score = Number(attempt.score);
  return Number.isFinite(score) ? score.toFixed(0) : null;
}

function getIncorrectAnswers(attempt?: ExerciseAttempt) {
  const incorrectAnswers = attempt?.ai_analysis_json.incorrect_answers;

  if (!Array.isArray(incorrectAnswers)) {
    return [];
  }

  return incorrectAnswers.flatMap((incorrectAnswer) => {
    if (typeof incorrectAnswer !== "object" || incorrectAnswer === null || Array.isArray(incorrectAnswer)) {
      return [];
    }

    const answerMap = incorrectAnswer as Record<string, unknown>;
    const itemId = answerMap.itemId;
    const submittedAnswer = answerMap.submittedAnswer;
    const correctAnswer = answerMap.correctAnswer;
    const correctText = answerMap.correctText;

    if (typeof itemId !== "string" || typeof correctAnswer !== "string") {
      return [];
    }

    return [
      {
        itemId,
        submittedAnswer: typeof submittedAnswer === "string" ? submittedAnswer : "",
        correctAnswer,
        correctText: typeof correctText === "string" ? correctText : null
      }
    ];
  });
}

// ── Free writing exercise (job_ad / survey_data / report tasks) ──────────────

type SurveyIssue = { rank: number; issue: string; percentage: string };
type SurveyData = {
  overall_satisfaction?: Record<string, string>;
  specific_issues?: SurveyIssue[];
};

type FreeWritingData = {
  instructions: string;
  minWords: number | null;
  jobAd: string | null;
  surveyData: SurveyData | null;
  checklist: string[];
  requiredSections: string[];
};

function getFreeWritingData(content: Record<string, unknown>): FreeWritingData | null {
  if (typeof content.min_words !== "number" && typeof content.min_words !== "string") return null;
  const instructions = typeof content.instructions === "string" ? content.instructions : null;
  if (!instructions) return null;
  const jobAd = typeof content.job_ad === "string" ? content.job_ad : null;
  const rawSurvey = content.survey_data;
  const surveyData =
    typeof rawSurvey === "object" && rawSurvey !== null && !Array.isArray(rawSurvey)
      ? (rawSurvey as SurveyData)
      : null;
  const checklist = Array.isArray(content.checklist)
    ? content.checklist.flatMap((c) => (typeof c === "string" ? [c] : []))
    : [];
  const requiredSections = Array.isArray(content.required_sections)
    ? content.required_sections.flatMap((s) => (typeof s === "string" ? [s] : []))
    : [];
  return {
    instructions,
    minWords: Number(content.min_words) || null,
    jobAd,
    surveyData,
    checklist,
    requiredSections,
  };
}

function FreeWritingExercise({
  exerciseId,
  data,
  previousAnswer,
}: {
  exerciseId: string;
  data: FreeWritingData;
  previousAnswer: string;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-[var(--on-surface-variant)]">{data.instructions}</p>

      {data.jobAd && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">Job advertisement</p>
          <div className="rounded-sm border-l-4 border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-3 pl-4 pr-4 text-sm leading-6 text-[var(--on-surface)]">
            {data.jobAd}
          </div>
        </div>
      )}

      {data.surveyData && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">Survey results</p>
          <div className="overflow-hidden rounded-sm border border-[var(--outline-variant)]">
            {data.surveyData.overall_satisfaction && (
              <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3">
                <p className="mb-2 text-xs font-semibold text-[var(--on-surface)]">Overall satisfaction</p>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(data.surveyData.overall_satisfaction).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <p className="text-lg font-bold text-[var(--primary)]">{v}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">{k.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.surveyData.specific_issues && (
              <div className="divide-y divide-[var(--outline-variant)]">
                {data.surveyData.specific_issues.map((issue) => (
                  <div key={issue.rank} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                    <span className="w-6 shrink-0 text-xs font-bold text-[var(--outline)]">{issue.rank}.</span>
                    <span className="flex-1 text-[var(--on-surface)]">{issue.issue}</span>
                    <span className="shrink-0 font-semibold text-[var(--primary)]">{issue.percentage}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {data.requiredSections.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">Required sections</p>
          <div className="flex flex-wrap gap-2">
            {data.requiredSections.map((s) => (
              <span key={s} className="rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-1 text-xs font-medium text-[var(--on-surface)]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.checklist.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">Self-check before submitting</p>
          <ul className="space-y-1.5">
            {data.checklist.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[var(--on-surface-variant)]">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--outline-variant)]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.minWords && (
        <p className="text-xs text-[var(--outline)]">Minimum {data.minWords} words.</p>
      )}

      <textarea
        name={`answer_${exerciseId}`}
        defaultValue={previousAnswer}
        required
        rows={12}
        placeholder="Write your answer here…"
        className="w-full rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--on-surface)] outline-none transition-colors placeholder:text-[var(--outline)] focus:border-[var(--primary)]"
      />
    </div>
  );
}

type ExerciseSentence = { id: string; original: string; prompt?: string };
type ExerciseExample = { original: string; transformed: string };

function getExerciseSentences(content: Record<string, unknown>): { sentences: ExerciseSentence[]; example: ExerciseExample | null } | null {
  if (!Array.isArray(content.sentences)) return null;
  const sentences = content.sentences.flatMap((s) => {
    if (typeof s !== "object" || s === null || Array.isArray(s)) return [];
    const sm = s as Record<string, unknown>;
    if (typeof sm.id !== "string" || typeof sm.original !== "string") return [];
    return [{ id: sm.id, original: sm.original, prompt: typeof sm.prompt === "string" ? sm.prompt : undefined }];
  });
  if (sentences.length === 0) return null;
  const ex = content.example as Record<string, unknown> | undefined;
  const example =
    ex && typeof ex.original === "string" && typeof ex.transformed === "string"
      ? { original: ex.original, transformed: ex.transformed }
      : null;
  return { sentences, example };
}

function SentenceTransformExercise({
  exerciseId,
  sentences,
  example,
  previousAnswers,
  incorrectIds,
}: {
  exerciseId: string;
  sentences: ExerciseSentence[];
  example: ExerciseExample | null;
  previousAnswers: Record<string, string>;
  incorrectIds: Set<string>;
}) {
  return (
    <div className="space-y-6">
      {example && (
        <div className="rounded-md border-l-4 border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-3 pl-4 pr-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">Example</p>
          <p className="text-[var(--on-surface-variant)] line-through decoration-[var(--outline)]">{example.original}</p>
          <p className="mt-1 font-medium text-[var(--on-surface)]">{example.transformed}</p>
        </div>
      )}
      <div className="divide-y divide-[var(--outline-variant)]">
        {sentences.map((s, idx) => {
          const isWrong = incorrectIds.has(s.id);
          return (
            <div key={s.id} className="py-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--outline)]">
                {idx + 1}.
              </p>
              <p className="mb-3 text-sm leading-6 text-[var(--on-surface-variant)]">{s.original}</p>
              <textarea
                name={`answer_${exerciseId}_${s.id}`}
                defaultValue={previousAnswers[s.id] ?? ""}
                required
                rows={2}
                placeholder={s.prompt ? `${s.prompt.replace(/___.*/, "").trim()} …` : "Write the transformed sentence…"}
                className={`w-full rounded-md border px-3 py-2 text-sm text-[var(--on-surface)] outline-none transition-colors placeholder:text-[var(--outline)] focus:border-[var(--primary)] ${
                  isWrong
                    ? "border-amber-400 bg-amber-50"
                    : "border-[var(--outline-variant)] bg-[var(--surface-container-low)]"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ExercisePair = { id: string; term: string; options: string[] };

function getExercisePairs(content: Record<string, unknown>): ExercisePair[] | null {
  if (!Array.isArray(content.pairs)) return null;
  const pairs = content.pairs.flatMap((p) => {
    if (typeof p !== "object" || p === null || Array.isArray(p)) return [];
    const pm = p as Record<string, unknown>;
    if ((typeof pm.id !== "number" && typeof pm.id !== "string") || typeof pm.term !== "string") return [];
    const options = Array.isArray(pm.options)
      ? pm.options.flatMap((o) => (typeof o === "string" ? [o] : []))
      : [];
    return [{ id: String(pm.id), term: pm.term, options }];
  });
  return pairs.length > 0 ? pairs : null;
}

function MatchingExercise({
  exerciseId,
  pairs,
  previousAnswers,
  incorrectIds,
}: {
  exerciseId: string;
  pairs: ExercisePair[];
  previousAnswers: Record<string, string>;
  incorrectIds: Set<string>;
}) {
  const allOptions = pairs[0]?.options ?? [];
  return (
    <div className="divide-y divide-[var(--outline-variant)]">
      {pairs.map((pair, idx) => {
        const isWrong = incorrectIds.has(pair.id);
        return (
          <div key={pair.id} className="flex flex-wrap items-baseline gap-x-8 gap-y-3 py-4">
            <span
              className={`w-44 shrink-0 text-sm font-bold uppercase tracking-wide ${
                isWrong ? "text-amber-600" : "text-[var(--on-surface)]"
              }`}
            >
              {idx + 1}. {pair.term}
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {allOptions.map((opt) => (
                <label
                  key={opt}
                  className="cursor-pointer text-sm text-[var(--on-surface-variant)] transition-colors hover:text-[var(--on-surface)] has-[:checked]:font-semibold has-[:checked]:text-[var(--primary)] has-[:checked]:[text-decoration:underline]"
                >
                  <input
                    type="radio"
                    name={`answer_${exerciseId}_${pair.id}`}
                    value={opt}
                    defaultChecked={previousAnswers[pair.id] === opt}
                    required
                    className="sr-only"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getExerciseTextBlanks(content: Record<string, unknown>) {
  if (getExerciseBlanks(content) || getExerciseBlanksFromItems(content)) {
    return null;
  }

  const sentence =
    typeof content.question === "string"
      ? content.question
      : typeof content.sentence === "string"
        ? content.sentence
        : typeof content.prompt === "string"
          ? content.prompt
          : null;

  if (!sentence) return null;

  const blankIds: string[] = [];
  const pattern = /\((\d+)(?:\.\s*[^)]*?)?\)\s*_+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sentence)) !== null) {
    blankIds.push(`blank_${match[1]}`);
  }

  if (blankIds.length === 0) return null;

  let idx = 0;
  const convertedSentence = sentence.replace(/(\(\d+(?:\.\s*[^)]*?)?\))\s*(_+)/g, (_, hint) => {
    const id = blankIds[idx++];
    return `${hint} {{${id}}}`;
  });

  return { sentence: convertedSentence, blankIds };
}

function TextBlanksExercise({
  exerciseId,
  previousAnswers,
  sentence
}: {
  exerciseId: string;
  previousAnswers: Record<string, string>;
  sentence: string;
}) {
  const parts: Array<{ type: "text"; content: string } | { type: "blank"; id: string }> = [];
  let lastIndex = 0;
  const regex = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sentence)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: sentence.slice(lastIndex, match.index) });
    }
    parts.push({ type: "blank", id: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < sentence.length) {
    parts.push({ type: "text", content: sentence.slice(lastIndex) });
  }

  return (
    <p className="mt-4 text-base leading-10 text-[var(--on-surface)]">
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.content}</span>
        ) : (
          <input
            key={i}
            className="mx-1 inline-block w-28 border-b-2 border-[var(--outline)] bg-transparent px-1 text-center text-sm text-[var(--on-surface)] outline-none transition-colors focus:border-[var(--primary)]"
            defaultValue={previousAnswers[part.id] ?? ""}
            name={`answer_${exerciseId}_${part.id}`}
            placeholder="..."
            type="text"
          />
        )
      )}
    </p>
  );
}

function getExerciseBlanksFromItems(content: Record<string, unknown>) {
  const sentence =
    typeof content.question === "string"
      ? content.question
      : typeof content.sentence === "string"
        ? content.sentence
        : null;

  if (!sentence || !Array.isArray(content.items)) {
    return null;
  }

  const items = getExerciseItems(content);
  if (items.length === 0) {
    return null;
  }

  const hasNumberedBlanks = /\(\d+\)\s*_+/.test(sentence);

  if (hasNumberedBlanks) {
    const itemsByNumber = new Map(items.filter((i) => i.number !== null).map((i) => [i.number!, i]));

    if (itemsByNumber.size === 0) {
      return null;
    }

    const convertedSentence = sentence.replace(/\((\d+)\)\s*_+/g, (_, n) => {
      const item = itemsByNumber.get(parseInt(n));
      return item ? `{{${item.id}}}` : `(${n}) ______`;
    });

    const blanks = [...itemsByNumber.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, item]) => ({ id: item.id, options: item.options.map((o) => ({ label: o.label, value: o.value })) }));

    return blanks.length > 0 ? { sentence: convertedSentence, blanks } : null;
  }

  const underscoreGroups = sentence.match(/_+/g) ?? [];
  if (underscoreGroups.length > 0 && underscoreGroups.length === items.length) {
    let i = 0;
    const convertedSentence = sentence.replace(/_+/g, () => {
      const item = items[i++];
      return item ? `{{${item.id}}}` : "______";
    });

    const blanks = items.map((item) => ({
      id: item.id,
      options: item.options.map((o) => ({ label: o.label, value: o.value }))
    }));
    return { sentence: convertedSentence, blanks };
  }

  return null;
}

function getExerciseBlanks(content: Record<string, unknown>) {
  if (typeof content.sentence !== "string" || !Array.isArray(content.blanks)) {
    return null;
  }

  const blanks = content.blanks.flatMap((blank) => {
    if (typeof blank !== "object" || blank === null || Array.isArray(blank)) {
      return [];
    }

    const b = blank as Record<string, unknown>;
    const id = b.id;
    const options = Array.isArray(b.options)
      ? b.options.flatMap((o) => {
          if (typeof o === "string") return [{ label: o, value: o }];
          if (typeof o === "object" && o !== null && !Array.isArray(o)) {
            const om = o as Record<string, unknown>;
            const label = String(om.label ?? om.text ?? om.value ?? "");
            const value = String(om.value ?? om.id ?? om.label ?? "");
            return label && value ? [{ label, value }] : [];
          }
          return [];
        })
      : [];

    if (typeof id !== "string" || options.length === 0) {
      return [];
    }

    return [{ id, options }];
  });

  return blanks.length > 0 ? { sentence: content.sentence, blanks } : null;
}

function getExerciseItems(content: Record<string, unknown>) {
  if (!Array.isArray(content.items)) {
    return [];
  }

  return content.items.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }

    const itemMap = item as Record<string, unknown>;
    const id = itemMap.id;
    const question = itemMap.question;
    const number = itemMap.number;
    const options = getExerciseOptions(itemMap);

    if (typeof id !== "string" || options.length === 0) {
      return [];
    }

    return [
      {
        id,
        number: typeof number === "number" ? number : null,
        question: typeof question === "string" ? question : "Choose the correct option",
        options
      }
    ];
  });
}
