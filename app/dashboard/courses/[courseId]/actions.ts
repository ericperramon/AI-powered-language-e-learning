"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Enrollment = {
  id: string;
  company_id: string;
  course_id: string;
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
    .eq("status", "active")
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

export async function completeLessonExercises(formData: FormData) {
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

  redirect(`/dashboard/courses/${courseId}?success=lesson-completed`);
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
