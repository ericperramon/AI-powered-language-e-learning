import { redirect } from "next/navigation";
import { BookOpen, Building2, CheckCircle2, Copy, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { purchaseCourse, redeemAccessKey, signOut } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Course = {
  id: string;
  title: string;
  description: string | null;
  target_language: string;
  level: string | null;
  estimated_duration_minutes: number | null;
};

type Profile = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  email: string | null;
  role: "admin" | "alumno";
};

type AccessKeyRow = {
  code: string;
  used_at: string | null;
  created_at: string;
  courses: { title: string } | { title: string }[] | null;
  used_by_profile:
    | {
        full_name: string | null;
        email: string | null;
      }
    | {
        full_name: string | null;
        email: string | null;
      }[]
    | null;
};

type EnrollmentRow = {
  status: string;
  progress_percentage: number | string;
  courses:
    | {
        title: string;
        level: string | null;
        target_language: string | null;
      }
    | {
        title: string;
        level: string | null;
        target_language: string | null;
      }[]
    | null;
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, email, role")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/auth?mode=signin");
  }

  const { data: coursesData } = await supabase
    .from("courses")
    .select("id, title, description, target_language, level, estimated_duration_minutes")
    .eq("is_active", true)
    .order("title")
    .returns<Course[]>();
  const courses = coursesData ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">GlossaAI Learning</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {profile.role === "admin" ? "Panel de empresa" : "Panel de empleado"}
          </h1>
        </div>
        <form action={signOut}>
          <Button variant="secondary" type="submit">
            <LogOut size={16} />
            Salir
          </Button>
        </form>
      </header>

      {params.success ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Operación completada correctamente.
        </div>
      ) : null}
      {params.error ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(params.error)}
        </div>
      ) : null}

      <section className="grid gap-5 py-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                {profile.role === "admin" ? <Building2 size={18} /> : <ShieldCheck size={18} />}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {profile.full_name ?? profile.email}
                </h2>
                <p className="text-sm text-slate-500">{profile.role === "admin" ? "Empresa" : "Empleado"}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profile.role === "admin" ? <CompanyPanel courses={courses} /> : <EmployeePanel />}
          </CardContent>
        </Card>

        {profile.role === "admin" ? (
          <CompanyKeys companyId={profile.company_id} />
        ) : (
          <EmployeeEnrollments />
        )}
      </section>
    </main>
  );
}

function CompanyPanel({ courses }: { courses: Course[] }) {
  return (
    <form action={purchaseCourse} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="courseId">Curso disponible</Label>
        <Select id="courseId" name="courseId" required>
          <option value="">Selecciona un curso</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} · {course.level ?? "Nivel sin definir"}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="licenses">Keys para empleados</Label>
        <Input id="licenses" min={1} max={100} name="licenses" required type="number" defaultValue={5} />
      </div>
      <Button className="w-full" disabled={courses.length === 0} type="submit">
        <KeyRound size={16} />
        Comprar y generar keys
      </Button>
      {courses.length === 0 ? (
        <p className="text-sm leading-6 text-slate-500">
          No hay cursos activos en la base de datos. Crea un curso en Supabase para continuar.
        </p>
      ) : null}
    </form>
  );
}

function EmployeePanel() {
  return (
    <form action={redeemAccessKey} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Clave de acceso</Label>
        <Input id="code" name="code" placeholder="AB12CD34EF56" required />
      </div>
      <Button className="w-full" type="submit">
        <KeyRound size={16} />
        Canjear clave
      </Button>
    </form>
  );
}

async function CompanyKeys({ companyId }: { companyId: string | null }) {
  const supabase = await createSupabaseServerClient();
  const { data: keysData } = companyId
    ? await supabase
        .from("course_access_keys")
        .select(
          "code, used_at, created_at, courses(title), used_by_profile:profiles!course_access_keys_used_by_fkey(full_name, email)"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<AccessKeyRow[]>()
    : { data: [] as AccessKeyRow[] };
  const keys = keysData ?? [];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-slate-950">Keys generadas</h2>
        <p className="text-sm text-slate-500">Usa una key libre para probar el registro de empleado.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {keys.map((key) => {
            const course = Array.isArray(key.courses) ? key.courses[0] : key.courses;
            const usedBy = Array.isArray(key.used_by_profile)
              ? key.used_by_profile[0]
              : key.used_by_profile;
            return (
              <div
                className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                key={key.code}
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-950">{key.code}</p>
                  <p className="text-sm text-slate-500">{course?.title ?? "Curso"}</p>
                </div>
                <div className="flex min-w-0 items-start gap-2 text-sm text-slate-500 sm:max-w-[260px] sm:justify-end sm:text-right">
                  {key.used_at ? (
                    <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
                  ) : (
                    <Copy className="mt-0.5 shrink-0" size={16} />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700">{key.used_at ? "Usada" : "Libre"}</p>
                    {key.used_at ? (
                      <p className="mt-1 break-words leading-5">
                        {usedBy?.full_name ?? "Usuario sin nombre"}
                        {usedBy?.email ? <span className="block">{usedBy.email}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {keys.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay keys generadas.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

async function EmployeeEnrollments() {
  const supabase = await createSupabaseServerClient();
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("status, progress_percentage, courses(title, level, target_language)")
    .order("started_at", { ascending: false })
    .returns<EnrollmentRow[]>();
  const enrollments = enrollmentsData ?? [];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-slate-950">Mis cursos</h2>
        <p className="text-sm text-slate-500">Aquí aparecerá el curso al canjear una key válida.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {enrollments.map((enrollment, index) => {
            const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
            return (
              <div className="rounded-md border border-slate-200 p-4" key={index}>
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 text-slate-500" size={18} />
                  <div>
                    <h3 className="font-semibold text-slate-950">{course?.title ?? "Curso"}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {course?.target_language ?? "Idioma"} · {course?.level ?? "Nivel"} ·{" "}
                      {Number(enrollment.progress_percentage).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {enrollments.length === 0 ? <p className="text-sm text-slate-500">No tienes cursos activos todavía.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
