import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Lock, PlayCircle, Trophy } from "lucide-react";
import {
  completeLessonExercises,
  completeLessonVideo,
  completeSummaryLesson,
  submitUnitTest
} from "@/app/dashboard/courses/[courseId]/actions";
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
  searchParams: Promise<{ stage?: string; error?: string }>;
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
    .eq("status", "active")
    .single();

  if (!enrollment) {
    redirect("/dashboard?error=course-not-enrolled");
  }

  const [{ data: lesson }, { data: exercisesData }, { data: progress }] = await Promise.all([
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
      .maybeSingle<LessonProgress>()
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
          The test score is below 80%. Review the summary and try again.
        </div>
      ) : null}

      <section className="py-6">
        {stage === "summary" ? (
          <SummaryStep courseId={courseId} lesson={lesson} unitId={unit.id} />
        ) : stage === "video" ? (
          <VideoStep courseId={courseId} lesson={lesson} unitId={unit.id} />
        ) : stage === "exercises" ? (
          <ExercisesStep courseId={courseId} exercises={exercises} lesson={lesson} progress={progress} unitId={unit.id} />
        ) : (
          <TestStep
            courseId={courseId}
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
  courseId,
  exercises,
  lesson,
  progress,
  unitId
}: {
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

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-slate-950">Lesson exercises</h2>
        <p className="text-sm leading-6 text-slate-600">
          Complete these exercises to unlock the next available lesson.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <div className="rounded-md border border-slate-200 p-4" key={exercise.id}>
              <p className="text-sm font-medium text-slate-500">
                Exercise {exercise.sort_order} · {exercise.exercise_type}
              </p>
              <h3 className="mt-1 font-semibold text-slate-950">{exercise.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{formatExerciseContent(exercise.content_json)}</p>
            </div>
          ))}
          {exercises.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              Exercises pending. They will appear here once the prepared content is loaded.
            </div>
          ) : null}
        </div>

        <form action={completeLessonExercises} className="mt-5">
          <input name="courseId" type="hidden" value={courseId} />
          <input name="unitId" type="hidden" value={unitId} />
          <input name="lessonId" type="hidden" value={lesson.id} />
          <Button type="submit">
            <CheckCircle2 size={16} />
            Complete exercises and continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TestStep({
  courseId,
  lesson,
  minimumScore,
  unitCompleted,
  unitId
}: {
  courseId: string;
  lesson: Lesson;
  minimumScore: number;
  unitCompleted: boolean;
  unitId: string;
}) {
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
                Passing score: {minimumScore.toFixed(0)}%. If the score is below 80%, the next unit remains locked.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {unitCompleted ? (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Unit passed. The next unit is now available from the course page.
            </div>
          ) : null}
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
