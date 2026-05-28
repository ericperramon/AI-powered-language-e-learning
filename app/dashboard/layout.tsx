import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AiAssistant } from "@/components/ai-assistant";
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
    .single<{ full_name: string | null; email: string | null; role: "admin" | "alumno" }>();

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <DashboardSidebar profile={profile} />
      <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
        {children}
      </div>
      <AiAssistant />
    </div>
  );
}
