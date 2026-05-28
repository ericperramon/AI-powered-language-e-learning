import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Copy,
  KeyRound,
  ShieldCheck
} from "lucide-react";
import { purchaseCourse, redeemAccessKey } from "@/app/dashboard/actions";
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
  const firstName = profile.full_name?.split(" ")[0] ?? profile.email ?? "there";

  return (
    <main className="min-h-screen w-full px-5 py-8 sm:px-8 lg:px-10">
      {/* Page header */}
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--outline)]">{isAdmin ? "Company" : "Student"} Dashboard</p>
            <h1 className="font-display mt-1 text-3xl font-bold leading-tight text-[var(--on-surface)] sm:text-4xl">
              Welcome back, {firstName}
            </h1>
          </div>
          {isAdmin && (
            <a
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-container)]"
              href="#purchase-course"
            >
              <KeyRound strokeWidth={1.5} size={16} />
              New purchase
            </a>
          )}
        </div>

        {params.success ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Operation completed successfully.
          </div>
        ) : null}
        {params.error ? (
          <div className="mt-6 rounded-lg border border-[var(--error-container)] bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--on-error-container)]">
            {decodeURIComponent(params.error)}
          </div>
        ) : null}
      </div>

      {isAdmin ? (
        <AdminDashboard courses={courses} companyId={profile.company_id} profile={profile} />
      ) : (
        <StudentDashboard profile={profile} />
      )}
    </main>
  );
}

/* ─── Admin ─────────────────────────────────────────────────────────────── */

function AdminDashboard({
  courses,
  companyId,
  profile
}: {
  courses: Course[];
  companyId: string | null;
  profile: Profile;
}) {
  return (
    <section className="mx-auto mt-8 grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card id="purchase-course">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)]">
              <Building2 strokeWidth={1.5} size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--on-surface)]">
                {profile.full_name ?? profile.email}
              </h2>
              <p className="text-sm text-[var(--on-surface-variant)]">Purchase courses &amp; generate keys</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              <Input id="licenses" min={1} max={100} name="licenses" required type="number" defaultValue={5} />
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
        </CardContent>
      </Card>

      <CompanyKeys companyId={companyId} />
    </section>
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

  const available = keys.filter((k) => !k.used_at).length;
  const used = keys.filter((k) => k.used_at).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--on-surface)]">Generated keys</h2>
            <p className="text-sm text-[var(--on-surface-variant)]">Share available keys with your employees.</p>
          </div>
          {keys.length > 0 && (
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm text-[var(--on-surface-variant)]">
                <span className="font-semibold text-emerald-600">{available}</span> available
              </span>
              <span className="text-sm text-[var(--on-surface-variant)]">
                <span className="font-semibold text-[var(--on-surface)]">{used}</span> used
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {keys.map((key) => {
            const course = Array.isArray(key.courses) ? key.courses[0] : key.courses;
            const usedBy = Array.isArray(key.used_by_profile) ? key.used_by_profile[0] : key.used_by_profile;
            return (
              <div
                className="flex flex-col gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 sm:flex-row sm:items-center sm:justify-between"
                key={key.code}
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-[var(--on-surface)]">{key.code}</p>
                  <p className="text-xs text-[var(--on-surface-variant)]">{course?.title ?? "Course"}</p>
                </div>
                <div className="flex min-w-0 items-start gap-2 text-sm text-[var(--on-surface-variant)] sm:max-w-[260px] sm:justify-end sm:text-right">
                  {key.used_at ? (
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={1.5} size={15} />
                  ) : (
                    <Copy className="mt-0.5 shrink-0" strokeWidth={1.5} size={15} />
                  )}
                  <div className="min-w-0">
                    <p className={`font-medium ${key.used_at ? "text-emerald-700" : "text-[var(--on-surface)]"}`}>
                      {key.used_at ? "Used" : "Available"}
                    </p>
                    {key.used_at ? (
                      <p className="mt-0.5 break-words text-xs leading-5">
                        {usedBy?.full_name ?? "Unnamed user"}
                        {usedBy?.email ? <span className="block">{usedBy.email}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {keys.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--on-surface-variant)]">
              No keys have been generated yet.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Student ────────────────────────────────────────────────────────────── */

function StudentDashboard({ profile }: { profile: Profile }) {
  return (
    <div className="mx-auto mt-8 w-full max-w-6xl">
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <EmployeeEnrollments />
        <div className="space-y-6">
          <Card id="new-course">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)]">
                  <ShieldCheck strokeWidth={1.5} size={19} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--on-surface)]">
                    {profile.full_name ?? profile.email}
                  </h2>
                  <p className="text-sm text-[var(--on-surface-variant)]">Student account</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-6 text-[var(--on-surface-variant)]">
                Have an access key from your company? Redeem it below to unlock a course.
              </p>
              <EmployeePanel />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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

async function EmployeeEnrollments() {
  const supabase = await createSupabaseServerClient();
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("course_id, status, progress_percentage, courses(title, level, target_language)")
    .order("started_at", { ascending: false })
    .returns<EnrollmentRow[]>();
  const enrollments = enrollmentsData ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-[var(--on-surface)]">My Courses</h2>
        {enrollments.length > 0 && (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {enrollments.length} course{enrollments.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-fixed)]">
            <BookOpen size={26} strokeWidth={1.5} className="text-[var(--on-primary-fixed-variant)]" />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--on-surface)]">No active courses yet</p>
            <p className="mt-1.5 text-sm leading-6 text-[var(--on-surface-variant)]">
              Redeem an access key from your company to start learning.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enrollments.map((enrollment) => {
            const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
            const progress = Math.min(Math.max(Number(enrollment.progress_percentage), 0), 100);
            const isComplete = progress === 100;

            return (
              <Link
                className="surface-card group flex flex-col gap-4 p-5 transition-shadow hover:shadow-[0_10px_30px_rgba(109,105,219,0.12)]"
                href={`/dashboard/courses/${enrollment.course_id}`}
                key={enrollment.course_id}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isComplete
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 strokeWidth={1.5} size={19} />
                    ) : (
                      <BookOpen strokeWidth={1.5} size={19} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {course?.target_language && (
                        <span className="ds-chip">{course.target_language}</span>
                      )}
                      {course?.level && (
                        <span className="text-xs text-[var(--on-surface-variant)]">{course.level}</span>
                      )}
                    </div>
                    <h3 className="font-display mt-1.5 text-lg font-semibold leading-tight text-[var(--on-surface)]">
                      {course?.title ?? "Course"}
                    </h3>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--on-surface-variant)]">Progress</span>
                    <span className="font-semibold text-[var(--on-surface)]">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--primary-fixed-dim)]">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-[var(--primary)]"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--on-surface-variant)]">
                    {isComplete ? "Completed" : progress === 0 ? "Not started" : "In progress"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] transition-colors group-hover:text-[var(--primary-container)]">
                    {isComplete ? "Review" : progress === 0 ? "Start" : "Continue"}
                    <ArrowRight size={15} strokeWidth={2} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
