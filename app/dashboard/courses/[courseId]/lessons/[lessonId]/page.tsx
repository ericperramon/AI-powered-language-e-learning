import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Lock, PlayCircle, Trophy } from "lucide-react";
import {
  completeLessonVideo,
  completeSummaryLesson,
  submitLessonExercises,
  submitUnitTest,
  submitUnitTestExercises
} from "@/app/dashboard/courses/[courseId]/actions";
import { FillInBlanksExercise } from "@/components/exercises/fill-in-blanks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Stage = "video" | "exercises" | "summary" | "test";

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
  units:
    | {
        id: string;
        title: string;
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
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("employee_id", user.id)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .single();

  if (!enrollment) {
    redirect("/dashboard?error=course-not-enrolled");
  }

  const [{ data: lesson }, { data: exercisesData }, { data: progress }, { data: exerciseAttemptsData }] =
    await Promise.all([
      admin
        .from("lessons")
        .select(
          "id, title, description, lesson_type, sort_order, video_url, pdf_url, content_json, requires_exam, minimum_score_to_pass, units(id, title, sort_order, course_id, courses(id, title, target_language, level))"
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
        .returns<ExerciseAttempt[]>()
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

  const isSummaryLesson = lesson.lesson_type === "text" && Boolean(lesson.pdf_url);

  if (isSummaryLesson && stage !== "summary") {
    redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=summary`);
  }

  const exercises = exercisesData ?? [];
  const exerciseAttempts = exerciseAttemptsData ?? [];
  const minimumScore = Number(lesson.minimum_score_to_pass ?? 80);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          href={`/dashboard/courses/${courseId}`}
        >
          <ArrowLeft size={16} />
          Back to course
        </Link>
      </div>

      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-slate-500">
          {course.title} · Unit {unit.sort_order}: {unit.title}
        </p>
        <div className="mt-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">{lesson.title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {lesson.description ?? "Lesson content is pending."}
            </p>
          </div>
        </div>
      </header>

      {query.error ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {query.error === "exercise-failed"
            ? "The score is below the minimum required. Repeat the exercise to continue."
            : "The test score is below 80%. Review the summary and try again."}
        </div>
      ) : null}
      {query.success === "exercise-passed" ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Exercise passed. Review the result and corrections below, then continue from the course page.
        </div>
      ) : null}

      <section className="py-6">
        {stage === "summary" ? (
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
      </section>
    </main>
  );
}

function normalizeStage(stage?: string): Stage {
  if (stage === "exercises" || stage === "summary" || stage === "test") {
    return stage;
  }

  return "video";
}

function SummaryStep({ courseId, lesson, unitId }: { courseId: string; lesson: Lesson; unitId: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="brand-accent-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Unit PDF summary</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Review this summary before taking the graded test.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {lesson.pdf_url ? (
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-950 hover:bg-slate-50"
            href={lesson.pdf_url}
            target="_blank"
          >
            <FileText size={16} />
            Open PDF
          </Link>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
            PDF pending. Upload the summary to Supabase Storage and save its public URL in this lesson.
          </div>
        )}

        <form action={completeSummaryLesson} className="mt-5">
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="lessonId" type="hidden" value={lesson.id} />
          <Button type="submit">
            <CheckCircle2 size={16} />
            Mark summary as reviewed
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VideoStep({ courseId, lesson, unitId }: { courseId: string; lesson: Lesson; unitId: string }) {
  const videoEmbedUrl = getVideoEmbedUrl(lesson.video_url);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="brand-accent-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white">
            <PlayCircle size={18} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Lesson video</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Complete this step before opening the exercises.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {videoEmbedUrl ? (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-black">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full"
              src={videoEmbedUrl}
              title={lesson.title}
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm leading-6 text-slate-500">
            Video pending. Once the content is added, the lesson video will appear here.
          </div>
        )}

        <form action={completeLessonVideo} className="mt-5">
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="lessonId" type="hidden" value={lesson.id} />
          <Button type="submit">
            <CheckCircle2 size={16} />
            Mark video as watched and start exercises
          </Button>
        </form>
      </CardContent>
    </Card>
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
  unitId
}: {
  attempts: ExerciseAttempt[];
  courseId: string;
  exercises: Exercise[];
  lesson: Lesson;
  progress: LessonProgress | null;
  unitId: string;
}) {
  if (!progress?.video_completed) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Lock className="mt-1 text-slate-500" size={20} />
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Exercises locked</h2>
              <p className="mt-1 text-sm text-slate-600">Complete the lesson video first.</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const latestAttemptsByExercise = new Map<string, ExerciseAttempt>();

  for (const attempt of attempts) {
    if (!latestAttemptsByExercise.has(attempt.exercise_id)) {
      latestAttemptsByExercise.set(attempt.exercise_id, attempt);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Lesson exercises</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Complete these exercises to unlock the next available lesson.
            </p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/dashboard/courses/${courseId}/lessons/${lesson.id}?stage=video`}
          >
            <PlayCircle size={15} />
            Video lesson
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <form action={submitLessonExercises} className="space-y-5">
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="lessonId" type="hidden" value={lesson.id} />

          <div className="space-y-3">
            {exercises.map((exercise) => {
              const isFillInBlanks = Boolean(
                getExerciseBlanks(exercise.content_json) ??
                  getExerciseBlanksFromItems(exercise.content_json) ??
                  getExerciseTextBlanks(exercise.content_json)
              );

              return (
                <div className="rounded-md border border-slate-200 p-4" key={exercise.id}>
                  <p className="text-sm font-medium text-slate-500">
                    Exercise {exercise.sort_order} · {exercise.exercise_type}
                  </p>
                  <h3 className="mt-1 font-semibold text-slate-950">{exercise.title}</h3>
                  {!isFillInBlanks && (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {formatExerciseContent(exercise.content_json)}
                    </p>
                  )}
                  <ExerciseAnswerControl
                    exercise={exercise}
                    previousAttempt={latestAttemptsByExercise.get(exercise.id)}
                  />
                </div>
              );
            })}
            {exercises.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                Exercises pending. They will appear here once the prepared content is loaded.
              </div>
            ) : null}
          </div>

          <Button type="submit">
            <CheckCircle2 size={16} />
            {exercises.length === 0 ? "Complete exercises and continue" : "Check answers and continue"}
          </Button>
        </form>
        {progress?.is_completed ? (
          <Link
            className="mt-4 inline-flex h-11 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-950 hover:bg-slate-50"
            href={`/dashboard/courses/${courseId}`}
          >
            Continue to next lesson
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ExerciseAnswerControl({
  exercise,
  previousAttempt
}: {
  exercise: Exercise;
  previousAttempt?: ExerciseAttempt;
}) {
  const blanksData = getExerciseBlanks(exercise.content_json) ?? getExerciseBlanksFromItems(exercise.content_json);
  const textBlanksData = !blanksData ? getExerciseTextBlanks(exercise.content_json) : null;
  const items = getExerciseItems(exercise.content_json);
  const options = getExerciseOptions(exercise.content_json);
  const previousAnswer = readPreviousAnswer(previousAttempt);
  const incorrectAnswers = getIncorrectAnswers(previousAttempt);
  const score = formatAttemptScore(previousAttempt);

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
          blankIds={textBlanksData.blankIds}
          exerciseId={exercise.id}
          previousAnswers={previousAnswer}
          sentence={textBlanksData.sentence}
        />
      ) : items.length > 0 && typeof exercise.content_json.question === "string" ? (
        <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{exercise.content_json.question}</p>
      ) : null}

      {blanksData || textBlanksData ? null : items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <fieldset className="space-y-2 rounded-md bg-slate-50 p-3" key={item.id}>
              <legend className="text-sm font-medium leading-6 text-slate-950">
                {item.number ? `${item.number}. ` : ""}
                {item.question}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {item.options.map((option) => (
                  <label
                    className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50"
                    key={option.value}
                  >
                    <input
                      className="h-4 w-4 accent-orange-600"
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
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50"
              key={option.value}
            >
              <input
                className="h-4 w-4 accent-orange-600"
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
            className="brand-accent-focus min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400"
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
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
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
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="brand-accent-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white">
            <Trophy size={18} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Graded test</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Passing score: {minimumScore.toFixed(0)}%. If the score is below that, the next unit remains locked.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {allAttempted && overallScore !== null ? (
          <>
            <div
              className={
                unitCompleted
                  ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-800"
                  : "rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800"
              }
            >
              <p className="text-lg font-semibold">
                Score: {overallScore}% —{" "}
                {unitCompleted ? "Unit passed!" : `Below the ${minimumScore.toFixed(0)}% required.`}
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

            {unitCompleted ? (
              <Link
                className="brand-accent-bg inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white"
                href={`/dashboard/courses/${courseId}`}
              >
                Go to course
              </Link>
            ) : null}
          </>
        ) : null}

        {!unitCompleted && exercises.length > 0 ? (
          <form action={submitUnitTestExercises} className="space-y-5">
            <input name="courseId" type="hidden" value={courseId} />
            <input name="unitId" type="hidden" value={unitId} />
            <input name="examLessonId" type="hidden" value={lesson.id} />
            <input name="minimumScore" type="hidden" value={minimumScore} />

            <div className="space-y-3">
              {exercises.map((exercise) => {
                const isFillInBlanks = Boolean(
                  getExerciseBlanks(exercise.content_json) ??
                    getExerciseBlanksFromItems(exercise.content_json) ??
                    getExerciseTextBlanks(exercise.content_json)
                );

                return (
                  <div className="rounded-md border border-slate-200 p-4" key={exercise.id}>
                    <p className="text-sm font-medium text-slate-500">Question {exercise.sort_order}</p>
                    <h3 className="mt-1 font-semibold text-slate-950">{exercise.title}</h3>
                    {!isFillInBlanks && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {formatExerciseContent(exercise.content_json)}
                      </p>
                    )}
                    <ExerciseAnswerControl exercise={exercise} />
                  </div>
                );
              })}
            </div>

            <Button className="w-full" type="submit">
              <CheckCircle2 size={16} />
              {allAttempted ? "Retry test" : "Submit test"}
            </Button>
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
      </CardContent>
    </Card>
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
  blankIds,
  exerciseId,
  previousAnswers,
  sentence
}: {
  blankIds: string[];
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
    <p className="mt-4 text-base leading-10 text-slate-800">
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.content}</span>
        ) : (
          <input
            key={i}
            className="mx-1 inline-block w-28 border-b-2 border-slate-400 bg-transparent px-1 text-center text-sm text-slate-950 outline-none transition-colors focus:border-orange-500"
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
