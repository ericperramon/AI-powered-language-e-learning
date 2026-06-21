import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createSpeakingSessionToken,
  LiveAvatarApiError,
  LiveAvatarConfigError
} from "@/lib/liveavatar/server";

export const runtime = "nodejs";

type LessonRow = {
  title: string;
  units:
    | { course_id: string; courses: { target_language: string; level: string | null } | { target_language: string; level: string | null }[] | null }
    | { course_id: string; courses: { target_language: string; level: string | null } | { target_language: string; level: string | null }[] | null }[]
    | null;
};

// Mints a LiveAvatar FULL-Mode session token for the Speaking lesson.
// Only the session_token is returned to the browser — never the API key.
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { lessonId, courseId } = (await request.json().catch(() => ({}))) as {
      lessonId?: string;
      courseId?: string;
    };

    if (!lessonId || !courseId) {
      return NextResponse.json({ error: "lessonId and courseId are required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Authorize: superadmin (preview) or an active/completed enrollment in the course.
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    const isPreview = profile?.role === "superadmin";

    if (!isPreview) {
      const { data: enrollment } = await admin
        .from("enrollments")
        .select("id")
        .eq("employee_id", user.id)
        .eq("course_id", courseId)
        .in("status", ["active", "completed"])
        .maybeSingle();

      if (!enrollment) {
        return NextResponse.json({ error: "Not enrolled in this course." }, { status: 403 });
      }
    }

    const { data: lesson } = await admin
      .from("lessons")
      .select("title, units(course_id, courses(target_language, level))")
      .eq("id", lessonId)
      .single<LessonRow>();

    const unit = Array.isArray(lesson?.units) ? lesson?.units[0] : lesson?.units;
    if (!lesson || !unit || unit.course_id !== courseId) {
      return NextResponse.json({ error: "Lesson not found in this course." }, { status: 404 });
    }
    const course = Array.isArray(unit.courses) ? unit.courses[0] : unit.courses;

    const { sessionToken, sessionId } = await createSpeakingSessionToken({
      languageName: course?.target_language ?? "English",
      level: course?.level ?? null
    });

    return NextResponse.json({ sessionToken, sessionId });
  } catch (error) {
    if (error instanceof LiveAvatarConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof LiveAvatarApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start avatar session." },
      { status: 500 }
    );
  }
}
