"use server";

import { redirect } from "next/navigation";
import { correctExerciseAnswer } from "@/lib/exercises/evaluation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Enrollment = {
  id: string;
  company_id: string;
  course_id: string;
};

type ExerciseForCorrection = {
  id: string;
  lesson_id: string;
  content_json: Record<string, unknown>;
  correct_answer_json: Record<string, unknown> | null;
  minimum_score_to_pass: number | string | null;
};

async function getActiveEnrollment(courseId: string): Promise<{ userId: string; enrollment: Enrollment }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  const admin = createSupabaseAdminClient();
  const { data: enrollment, error } = await admin
    .from("enrollments")
    .select("id, company_id, course_id")
    .eq("employee_id", user.id)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .single<Enrollment>();

  if (error || !enrollment) {
    redirect("/dashboard?error=course-not-enrolled");
  }

  return { userId: user.id, enrollment };
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function updateEnrollmentProgress(userId: string, courseId: string, lastLessonId?: string) {
  const admin = createSupabaseAdminClient();

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, units!inner(course_id)")
    .eq("units.course_id", courseId)
    .returns<{ id: string }[]>();

  const totalLessons = lessons?.length ?? 0;

  const { data: completedLessons } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("employee_id", userId)
    .eq("course_id", courseId)
    .eq("is_completed", true)
    .returns<{ lesson_id: string }[]>();

  const completed = completedLessons?.length ?? 0;
  const progress = totalLessons > 0 ? Math.min(100, Math.round((completed / totalLessons) * 100)) : 0;

  const updatePayload: {
    progress_percentage: number;
    updated_at: string;
    last_lesson_id?: string;
    completed_at?: string;
    status?: "completed";
  } = {
    progress_percentage: progress,
    updated_at: new Date().toISOString()
  };

  if (lastLessonId) {
    updatePayload.last_lesson_id = lastLessonId;
  }

  if (totalLessons > 0 && completed >= totalLessons) {
    updatePayload.completed_at = new Date().toISOString();
    updatePayload.status = "completed";
  }

  await admin
    .from("enrollments")
    .update(updatePayload)
    .eq("employee_id", userId)
    .eq("course_id", courseId);
}

export async function completeLessonVideo(formData: FormData) {
  const courseId = readText(formData, "courseId");
  const unitId = readText(formData, "unitId");
  const lessonId = readText(formData, "lessonId");

  if (!courseId || !unitId || !lessonId) {
    redirect("/dashboard?error=missing-learning-context");
  }

  const { userId } = await getActiveEnrollment(courseId);
  const admin = createSupabaseAdminClient();

  await admin.from("lesson_progress").upsert(
    {
      employee_id: userId,
      lesson_id: lessonId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      video_completed: true,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "employee_id,lesson_id" }
  );

  redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=exercises`);
}

export async function submitLessonExercises(formData: FormData) {
  const courseId = readText(formData, "courseId");
  const unitId = readText(formData, "unitId");
  const lessonId = readText(formData, "lessonId");

  if (!courseId || !unitId || !lessonId) {
    redirect("/dashboard?error=missing-learning-context");
  }

  const { userId } = await getActiveEnrollment(courseId);
  const admin = createSupabaseAdminClient();
  const { data: exercises } = await admin
    .from("exercises")
    .select("id, lesson_id, content_json, correct_answer_json, minimum_score_to_pass")
    .eq("lesson_id", lessonId)
    .order("sort_order")
    .returns<ExerciseForCorrection[]>();

  if (!exercises || exercises.length === 0) {
    await markLessonExercisesCompleted(admin, userId, courseId, unitId, lessonId);
    await updateEnrollmentProgress(userId, courseId, lessonId);
    redirect(`/dashboard/courses/${courseId}?success=lesson-completed`);
  }

  const now = new Date().toISOString();
  const attempts = exercises.map((exercise) => {
    const answer = readExerciseAnswer(formData, exercise);
    const correction = correctExerciseAnswer(exercise.correct_answer_json, answer);
    const minimumScore = Number(exercise.minimum_score_to_pass ?? 80);
    const passed = correction.score >= minimumScore;

    return {
      employee_id: userId,
      exercise_id: exercise.id,
      lesson_id: lessonId,
      course_id: courseId,
      answer_json: typeof answer === "string" ? { answer } : answer,
      score: correction.score,
      passed,
      ai_feedback: passed
        ? "You passed. Review the corrections and continue."
        : `You need at least ${minimumScore}%. Repeat the exercise.`,
      ai_analysis_json: {
        expected_answer: correction.expectedAnswer,
        incorrect_answers: correction.incorrectAnswers,
        corrected_by: "local-mvp"
      },
      created_at: now
    };
  });

  await admin.from("exercise_attempts").insert(attempts);

  if (attempts.every((attempt) => attempt.passed)) {
    await markLessonExercisesCompleted(admin, userId, courseId, unitId, lessonId);
    await updateEnrollmentProgress(userId, courseId, lessonId);
    redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=exercises&success=exercise-passed`);
  }

  redirect(`/dashboard/courses/${courseId}/lessons/${lessonId}?stage=exercises&error=exercise-failed`);
}

function readExerciseAnswer(formData: FormData, exercise: ExerciseForCorrection) {
  const itemIds = readExerciseItemIds(exercise.content_json);

  if (itemIds.length === 0) {
    return readText(formData, `answer_${exercise.id}`);
  }

  return {
    answers: Object.fromEntries(
      itemIds.map((itemId) => [itemId, readText(formData, `answer_${exercise.id}_${itemId}`)])
    )
  };
}

function readExerciseItemIds(content: Record<string, unknown>) {
  const source = Array.isArray(content.items) ? content.items : Array.isArray(content.blanks) ? content.blanks : [];

  const fromSource = source.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }
    const itemMap = item as Record<string, unknown>;
    return typeof itemMap.id === "string" ? [itemMap.id] : [];
  });

  if (fromSource.length > 0) return fromSource;

  // Detect text blank IDs from numbered sentence pattern (N. verb) ______
  const sentence =
    typeof content.question === "string"
      ? content.question
      : typeof content.sentence === "string"
        ? content.sentence
        : typeof content.prompt === "string"
          ? content.prompt
          : null;

  if (!sentence) return [];

  const ids: string[] = [];
  const pattern = /\((\d+)(?:\.\s*[^)]*?)?\)\s*_+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sentence)) !== null) {
    ids.push(`blank_${match[1]}`);
  }

  return ids;
}

async function markLessonExercisesCompleted(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  courseId: string,
  unitId: string,
  lessonId: string
) {
  await admin.from("lesson_progress").upsert(
    {
      employee_id: userId,
      lesson_id: lessonId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      video_completed: true,
      exercises_completed: true,
      is_completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "employee_id,lesson_id" }
  );
}

export async function completeSummaryLesson(formData: FormData) {
  const courseId = readText(formData, "courseId");
  const unitId = readText(formData, "unitId");
  const lessonId = readText(formData, "lessonId");

  if (!courseId || !unitId || !lessonId) {
    redirect("/dashboard?error=missing-learning-context");
  }

  const { userId } = await getActiveEnrollment(courseId);
  const admin = createSupabaseAdminClient();

  await admin.from("lesson_progress").upsert(
    {
      employee_id: userId,
      lesson_id: lessonId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      video_completed: true,
      exercises_completed: true,
      is_completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "employee_id,lesson_id" }
  );

  await updateEnrollmentProgress(userId, courseId, lessonId);

  redirect(`/dashboard/courses/${courseId}?success=summary-completed`);
}

export async function submitUnitTestExercises(formData: FormData) {
  const courseId = readText(formData, "courseId");
  const unitId = readText(formData, "unitId");
  const examLessonId = readText(formData, "examLessonId");
  const minimumScore = Number(readText(formData, "minimumScore") || "80");

  if (!courseId || !unitId || !examLessonId) {
    redirect("/dashboard?error=missing-test-context");
  }

  const { userId } = await getActiveEnrollment(courseId);
  const admin = createSupabaseAdminClient();

  const { data: exercises } = await admin
    .from("exercises")
    .select("id, lesson_id, content_json, correct_answer_json, minimum_score_to_pass")
    .eq("lesson_id", examLessonId)
    .order("sort_order")
    .returns<ExerciseForCorrection[]>();

  if (!exercises || exercises.length === 0) {
    redirect(`/dashboard/courses/${courseId}/lessons/${examLessonId}?stage=test`);
  }

  const now = new Date().toISOString();
  const attempts = exercises.map((exercise) => {
    const answer = readExerciseAnswer(formData, exercise);
    const correction = correctExerciseAnswer(exercise.correct_answer_json, answer);

    return {
      employee_id: userId,
      exercise_id: exercise.id,
      lesson_id: examLessonId,
      course_id: courseId,
      answer_json: typeof answer === "string" ? { answer } : answer,
      score: correction.score,
      passed: correction.passed,
      ai_feedback: correction.feedback,
      ai_analysis_json: {
        expected_answer: correction.expectedAnswer,
        incorrect_answers: correction.incorrectAnswers,
        corrected_by: "local-mvp"
      },
      created_at: now
    };
  });

  await admin.from("exercise_attempts").insert(attempts);

  const totalScore = Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length);
  const passed = totalScore >= minimumScore;

  await admin.from("lesson_progress").upsert(
    {
      employee_id: userId,
      lesson_id: examLessonId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      video_completed: true,
      exercises_completed: true,
      exam_passed: passed,
      is_completed: passed,
      score: totalScore,
      completed_at: passed ? now : null,
      updated_at: now
    },
    { onConflict: "employee_id,lesson_id" }
  );

  await admin.from("unit_progress").upsert(
    {
      employee_id: userId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      is_completed: passed,
      progress_percentage: passed ? 100 : 90,
      completed_at: passed ? now : null,
      updated_at: now
    },
    { onConflict: "employee_id,unit_id" }
  );

  await updateEnrollmentProgress(userId, courseId, passed ? examLessonId : undefined);

  redirect(`/dashboard/courses/${courseId}/lessons/${examLessonId}?stage=test`);
}

export async function submitPracticeTask(formData: FormData) {
  const courseId = readText(formData, "courseId");
  const unitId = readText(formData, "unitId");
  const lessonId = readText(formData, "lessonId");
  const response = readText(formData, "response");

  if (!courseId || !unitId || !lessonId) {
    redirect("/dashboard?error=missing-learning-context");
  }

  const { userId } = await getActiveEnrollment(courseId);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  await admin.from("practice_task_submissions").upsert(
    {
      employee_id: userId,
      lesson_id: lessonId,
      unit_id: unitId,
      course_id: courseId,
      content_json: { response },
      status: "pending",
      updated_at: now,
    },
    { onConflict: "employee_id,lesson_id" }
  );

  await admin.from("lesson_progress").upsert(
    {
      employee_id: userId,
      lesson_id: lessonId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      is_completed: true,
      completed_at: now,
      updated_at: now,
    },
    { onConflict: "employee_id,lesson_id" }
  );

  await updateEnrollmentProgress(userId, courseId, lessonId);

  redirect(`/dashboard/courses/${courseId}?success=task-submitted`);
}

export async function submitUnitTest(formData: FormData) {
  const courseId = readText(formData, "courseId");
  const unitId = readText(formData, "unitId");
  const examLessonId = readText(formData, "examLessonId");
  const score = Number(readText(formData, "score"));

  if (!courseId || !unitId || !examLessonId || Number.isNaN(score)) {
    redirect("/dashboard?error=missing-test-context");
  }

  const { userId } = await getActiveEnrollment(courseId);
  const admin = createSupabaseAdminClient();
  const passed = score >= 80;

  await admin.from("lesson_progress").upsert(
    {
      employee_id: userId,
      lesson_id: examLessonId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      video_completed: true,
      exercises_completed: true,
      exam_passed: passed,
      is_completed: passed,
      score,
      completed_at: passed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "employee_id,lesson_id" }
  );

  await admin.from("unit_progress").upsert(
    {
      employee_id: userId,
      unit_id: unitId,
      course_id: courseId,
      is_unlocked: true,
      is_completed: passed,
      progress_percentage: passed ? 100 : 90,
      completed_at: passed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "employee_id,unit_id" }
  );

  await updateEnrollmentProgress(userId, courseId, passed ? examLessonId : undefined);

  redirect(
    passed
      ? `/dashboard/courses/${courseId}?success=unit-passed`
      : `/dashboard/courses/${courseId}/lessons/${examLessonId}?stage=test&error=unit-test-failed`
  );
}
