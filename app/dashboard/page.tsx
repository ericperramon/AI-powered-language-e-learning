import Link from "next/link";
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
  course_id: string;
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
  const isAdmin = profile.role === "admin";

  return (
    <main className="min-h-screen w-full bg-[var(--background)] px-5 py-8 text-[var(--on-background)] sm:px-8 lg:px-12">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold leading-tight text-[var(--on-surface)] sm:text-5xl">
            {isAdmin ? "Company Dashboard" : "Student Dashboard"}
          </h1>
          <p className="mt-3 text-base text-[var(--on-surface-variant)]">GlossaAI Learning</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold tracking-[0.01em] text-[var(--on-primary)] transition hover:bg-[var(--primary-container)]"
            href={isAdmin ? "#purchase-course" : "#new-course"}
          >
            {isAdmin ? "New purchase" : "New course"}
          </a>
          <form action={signOut}>
            <Button
              className="h-10"
              variant="secondary"
              type="submit"
            >
              <LogOut strokeWidth={1.5} size={17} />
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {params.success ? (
        <div className="mx-auto mt-8 max-w-6xl rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Operation completed successfully.
        </div>
      ) : null}
      {params.error ? (
        <div className="mx-auto mt-8 max-w-6xl rounded-lg border border-[var(--error-container)] bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--on-error-container)]">
          {decodeURIComponent(params.error)}
        </div>
      ) : null}

      {isAdmin ? (
        <section className="mx-auto grid w-full max-w-6xl gap-6 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="shadow-none" id="purchase-course">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="brand-accent-bg flex h-11 w-11 items-center justify-center rounded-lg text-[var(--on-primary)]">
                  <Building2 strokeWidth={1.5} size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">{profile.full_name ?? profile.email}</h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">Company</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CompanyPanel courses={courses} />
            </CardContent>
          </Card>
          <CompanyKeys companyId={profile.company_id} />
        </section>
      ) : (
        <section className="mx-auto grid w-full max-w-6xl gap-6 py-10 xl:grid-cols-[1fr_340px]">
          <EmployeeEnrollments />
          <Card className="shadow-none" id="new-course">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="brand-accent-bg flex h-11 w-11 items-center justify-center rounded-lg text-[var(--on-primary)]">
                  <ShieldCheck strokeWidth={1.5} size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">{profile.full_name ?? profile.email}</h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">Student</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <EmployeePanel />
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}

function CompanyPanel({ courses }: { courses: Course[] }) {
  return (
    <form action={purchaseCourse} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="courseId">Available course</Label>
        <Select id="courseId" name="courseId" required>
          <option value="">Select a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} · {course.level ?? "Level not set"}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="licenses">Employee keys</Label>
        <Input
          id="licenses"
          min={1}
          max={100}
          name="licenses"
          required
          type="number"
          defaultValue={5}
        />
      </div>
      <Button className="h-11 w-full rounded-lg text-sm font-semibold" disabled={courses.length === 0} type="submit">
        <KeyRound strokeWidth={1.5} size={16} />
        Purchase and generate keys
      </Button>
      {courses.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--on-surface-variant)]">
          There are no active courses in the database. Create a course in Supabase to continue.
        </p>
      ) : null}
    </form>
  );
}

function EmployeePanel() {
  return (
    <form action={redeemAccessKey} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Access key</Label>
        <Input id="code" name="code" placeholder="AB12CD34EF56" required />
      </div>
      <Button className="h-11 w-full rounded-lg text-sm font-semibold" type="submit">
        <KeyRound strokeWidth={1.5} size={16} />
        Redeem key
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
    <Card className="shadow-none">
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--on-surface)]">Generated keys</h2>
        <p className="text-sm text-[var(--on-surface-variant)]">Use an available key to test student registration.</p>
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
                className="flex flex-col gap-3 rounded-lg border border-[var(--outline-variant)] p-3 sm:flex-row sm:items-center sm:justify-between"
                key={key.code}
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-[var(--on-surface)]">{key.code}</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">{course?.title ?? "Course"}</p>
                </div>
                <div className="flex min-w-0 items-start gap-2 text-sm text-[var(--on-surface-variant)] sm:max-w-[260px] sm:justify-end sm:text-right">
                  {key.used_at ? (
                    <CheckCircle2 className="mt-0.5 shrink-0" strokeWidth={1.5} size={16} />
                  ) : (
                    <Copy className="mt-0.5 shrink-0" strokeWidth={1.5} size={16} />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--on-surface)]">{key.used_at ? "Used" : "Available"}</p>
                    {key.used_at ? (
                      <p className="mt-1 break-words leading-5">
                        {usedBy?.full_name ?? "Unnamed user"}
                        {usedBy?.email ? <span className="block">{usedBy.email}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {keys.length === 0 ? <p className="text-sm text-[var(--on-surface-variant)]">No keys have been generated yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

async function EmployeeEnrollments() {
  const supabase = await createSupabaseServerClient();
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("course_id, status, progress_percentage, courses(title, level, target_language)")
    .order("started_at", { ascending: false })
    .returns<EnrollmentRow[]>();
  const enrollments = enrollmentsData ?? [];

  return (
    <section className="rounded-[var(--r-lg)] bg-[var(--primary-container)] px-5 py-6 text-[var(--on-primary-container)] shadow-[0_10px_30px_rgba(109,105,219,0.12)] sm:px-8 sm:py-8">
      <h2 className="font-display text-3xl font-bold">My courses</h2>
      <div className="mt-6 space-y-4">
        {enrollments.map((enrollment) => {
          const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
          const progress = Number(enrollment.progress_percentage);
          return (
            <div className="rounded-lg bg-[var(--primary-fixed)] p-5 text-[var(--on-primary-fixed)] sm:p-6" key={enrollment.course_id}>
              <div className="grid gap-5 lg:grid-cols-[1fr_140px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 shrink-0 text-[var(--on-primary-fixed-variant)]" strokeWidth={1.5} size={20} />
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-[var(--on-primary-fixed)]">{course?.title ?? "Course"}</h3>
                      <p className="mt-1 text-base text-[var(--on-primary-fixed-variant)]">
                        {course?.target_language ?? "Language"} · {course?.level ?? "Level"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--primary-fixed-dim)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs font-semibold text-[var(--on-primary-fixed-variant)]">{progress.toFixed(0)}%</p>
                </div>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-container)]"
                  href={`/dashboard/courses/${enrollment.course_id}`}
                >
                  Continue
                </Link>
              </div>
            </div>
          );
        })}
        {enrollments.length === 0 ? (
          <div className="rounded-lg bg-[var(--primary-fixed)] p-6 text-base font-medium text-[var(--on-primary-fixed-variant)]">
            You do not have active courses yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
