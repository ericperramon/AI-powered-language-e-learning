import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AiAssistant } from "@/components/ai-assistant";
import { AssistantContextSetter } from "@/components/assistant-context-setter";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssistantCourseContext } from "@/lib/assistant/system-prompt";

type UnitWithLessons = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: Array<{ id: string; title: string; sort_order: number }>;
};

export default async function AssistantPage({
  searchParams
}: {
  searchParams: Promise<{ courseId?: string; lessonId?: string }>;
}) {
  const { courseId, lessonId } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  const courseContext = await buildCourseContext(courseId, lessonId);
  const backHref = courseId ? `/dashboard/courses/${courseId}` : "/dashboard";

  return (
    <main className="flex min-h-screen w-full flex-col items-center px-5 py-8 sm:px-8 lg:px-10">
      <AssistantContextSetter courseContext={courseContext} />
      <div className="mb-6 w-full max-w-2xl">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--on-surface-variant)] transition-colors hover:text-[var(--on-surface)]"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Back to course
        </Link>
      </div>
      <div className="flex w-full max-w-2xl flex-1">
        <AiAssistant variant="page" />
      </div>
    </main>
  );
}

async function buildCourseContext(
  courseId: string | undefined,
  lessonId: string | undefined
): Promise<AssistantCourseContext> {
  if (!courseId) return null;

  const admin = createSupabaseAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("title, target_language, level")
    .eq("id", courseId)
    .single<{ title: string; target_language: string; level: string | null }>();

  if (!course) return null;

  const { data: unitsData } = await admin
    .from("units")
    .select("id, title, description, sort_order, lessons(id, title, sort_order)")
    .eq("course_id", courseId)
    .order("sort_order")
    .order("sort_order", { foreignTable: "lessons" })
    .returns<UnitWithLessons[]>();

  const units = unitsData ?? [];

  let currentUnit: NonNullable<AssistantCourseContext>["currentUnit"] = null;
  if (lessonId) {
    const match = units.find((u) => u.lessons.some((l) => l.id === lessonId));
    if (match) {
      currentUnit = {
        id: match.id,
        sort_order: match.sort_order,
        description: match.description,
        title: match.title
      };
    }
  }

  return {
    course: { title: course.title, target_language: course.target_language, level: course.level },
    units: units.map((u) => ({
      id: u.id,
      title: u.title,
      sort_order: u.sort_order,
      description: u.description,
      lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, sort_order: l.sort_order }))
    })),
    currentUnit,
    previousUnit: null,
    currentUnitProgress: 0
  };
}
