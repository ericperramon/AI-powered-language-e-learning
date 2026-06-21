import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AiAssistantMount } from "@/components/ai-assistant-mount";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single<{ full_name: string | null; email: string | null; role: "admin" | "alumno" | "superadmin" }>();

  const isSuperAdmin = profile?.role === "superadmin";
  const isAdmin = profile?.role === "admin";

  type SidebarCourse = {
    id: string;
    title: string;
    units: Array<{ id: string; title: string; sort_order: number }>;
  };

  let allCourses: SidebarCourse[] = [];
  if (isSuperAdmin) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("courses")
      .select("id, title, units(id, title, sort_order)")
      .eq("is_active", true)
      .order("title")
      .order("sort_order", { foreignTable: "units" })
      .returns<SidebarCourse[]>();
    allCourses = data ?? [];
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <DashboardSidebar profile={profile} courses={isSuperAdmin ? allCourses : []} />
      <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
        {children}
      </div>
      {!isAdmin && <AiAssistantMount />}
    </div>
  );
}
