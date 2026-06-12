import { redirect } from "next/navigation";
import { BookOpen, CheckCircle2, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmployeeConfigPanel } from "@/components/dashboard/employee-config-panel";

type UsedKeyRow = {
  used_by: string | null;
  course_id: string;
  courses:
    | { id: string; title: string; target_language: string | null; level: string | null }
    | { id: string; title: string; target_language: string | null; level: string | null }[]
    | null;
  employee:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
};

type EnrollmentRow = {
  employee_id: string;
  course_id: string;
  status: string;
  progress_percentage: number | string;
  started_at: string | null;
  completed_at: string | null;
};

type CourseInfo = {
  id: string;
  title: string;
  target_language: string | null;
  level: string | null;
};

type EmployeeData = {
  id: string;
  full_name: string | null;
  email: string | null;
  courses: {
    course_id: string;
    id: string;
    title: string;
    target_language: string | null;
    level: string | null;
    status: string;
    progress_percentage: number;
    started_at: string | null;
    completed_at: string | null;
  }[];
};

export default async function EmployeesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?mode=signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single<{ company_id: string | null; role: "admin" | "alumno" }>();

  if (!profile || profile.role !== "admin") redirect("/dashboard");
  if (!profile.company_id) redirect("/dashboard");

  const [usedKeysResult, companyCoursesResult] = await Promise.all([
    supabase
      .from("course_access_keys")
      .select(
        "used_by, course_id, courses(id, title, target_language, level), employee:profiles!course_access_keys_used_by_fkey(id, full_name, email)"
      )
      .eq("company_id", profile.company_id)
      .not("used_at", "is", null)
      .returns<UsedKeyRow[]>(),
    supabase
      .from("company_course_packages")
      .select("courses(id, title, target_language, level)")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
  ]);

  const usedKeys = usedKeysResult.data ?? [];

  const rawPackageCourses = (companyCoursesResult.data ?? []).flatMap((row) => {
    const c = (row as { courses: CourseInfo | CourseInfo[] | null }).courses;
    if (!c) return [];
    return Array.isArray(c) ? c : [c];
  });
  const companyCourseMap = new Map<string, CourseInfo>(rawPackageCourses.map((c) => [c.id, c]));
  const companyCourses = [...companyCourseMap.values()];

  const employeeInfoMap = new Map<string, { id: string; full_name: string | null; email: string | null }>();
  const courseInfoMap = new Map<string, CourseInfo>();
  const keyCoursesByEmployee = new Map<string, Set<string>>();

  for (const key of usedKeys) {
    const emp = Array.isArray(key.employee) ? key.employee[0] : key.employee;
    const course = Array.isArray(key.courses) ? key.courses[0] : key.courses;

    if (!emp?.id || !key.course_id) continue;

    employeeInfoMap.set(emp.id, emp);
    if (course) courseInfoMap.set(key.course_id, course);
    if (!keyCoursesByEmployee.has(emp.id)) keyCoursesByEmployee.set(emp.id, new Set());
    keyCoursesByEmployee.get(emp.id)!.add(key.course_id);
  }

  const employeeIds = [...employeeInfoMap.keys()];

  const { data: enrollmentsData } =
    employeeIds.length > 0
      ? await supabase
          .from("enrollments")
          .select("employee_id, course_id, status, progress_percentage, started_at, completed_at")
          .in("employee_id", employeeIds)
          .returns<EnrollmentRow[]>()
      : { data: [] as EnrollmentRow[] };

  const enrollments = enrollmentsData ?? [];

  const employeeDataMap = new Map<string, EmployeeData>();
  for (const [id, info] of employeeInfoMap) {
    employeeDataMap.set(id, { ...info, courses: [] });
  }

  for (const enrollment of enrollments) {
    const emp = employeeDataMap.get(enrollment.employee_id);
    if (!emp) continue;

    const allowedCourses = keyCoursesByEmployee.get(enrollment.employee_id);
    if (!allowedCourses?.has(enrollment.course_id)) continue;

    const course = courseInfoMap.get(enrollment.course_id);
    emp.courses.push({
      course_id: enrollment.course_id,
      id: enrollment.course_id,
      title: course?.title ?? "Course",
      target_language: course?.target_language ?? null,
      level: course?.level ?? null,
      status: enrollment.status,
      progress_percentage: Math.min(Math.max(Number(enrollment.progress_percentage), 0), 100),
      started_at: enrollment.started_at,
      completed_at: enrollment.completed_at
    });
  }

  const employees = [...employeeDataMap.values()];

  const totalEnrolled = employees.reduce((acc, e) => acc + e.courses.length, 0);
  const avgProgress =
    totalEnrolled > 0
      ? Math.round(
          employees.reduce((acc, e) => acc + e.courses.reduce((a, c) => a + c.progress_percentage, 0), 0) /
            totalEnrolled
        )
      : 0;

  return (
    <main className="min-h-screen w-full px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-[var(--outline)]">Company Dashboard</p>
          <h1 className="font-display mt-1 text-3xl font-bold leading-tight text-[var(--on-surface)] sm:text-4xl">
            Employees
          </h1>
        </div>

        {/* Stats */}
        {employees.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-bold text-[var(--on-surface)]">{employees.length}</p>
                <p className="mt-0.5 text-sm text-[var(--on-surface-variant)]">Active employees</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-bold text-[var(--primary)]">{avgProgress}%</p>
                <p className="mt-0.5 text-sm text-[var(--on-surface-variant)]">Avg. progress</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employee list */}
        {employees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-fixed)]">
                <Users size={26} strokeWidth={1.5} className="text-[var(--on-primary-fixed-variant)]" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--on-surface)]">No employees yet</p>
                <p className="mt-1.5 text-sm leading-6 text-[var(--on-surface-variant)]">
                  Employees will appear here once they redeem an access key.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {employees.map((employee) => {
              const initials = employee.full_name
                ? employee.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : (employee.email?.[0] ?? "?").toUpperCase();

              const empProgress =
                employee.courses.length > 0
                  ? Math.round(
                      employee.courses.reduce((acc, c) => acc + c.progress_percentage, 0) / employee.courses.length
                    )
                  : 0;

              return (
                <Card key={employee.id}>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-sm font-bold text-[var(--on-primary-fixed-variant)]">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--on-surface)]">
                          {employee.full_name ?? employee.email ?? "Unnamed employee"}
                        </p>
                        {employee.full_name && employee.email && (
                          <p className="truncate text-sm text-[var(--on-surface-variant)]">{employee.email}</p>
                        )}
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-lg font-bold text-[var(--primary)]">{empProgress}%</p>
                        <p className="text-xs text-[var(--on-surface-variant)]">avg progress</p>
                      </div>
                      <EmployeeConfigPanel
                        employee={{ id: employee.id, full_name: employee.full_name, email: employee.email }}
                        enrolledCourses={employee.courses}
                        companyCourses={companyCourses}
                      />
                    </div>
                  </CardHeader>

                  {employee.courses.length > 0 && (
                    <CardContent>
                      <div className="space-y-3">
                        {employee.courses.map((course) => {
                          const isComplete = course.progress_percentage === 100;
                          return (
                            <div
                              key={course.course_id}
                              className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3"
                            >
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                      isComplete
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]"
                                    }`}
                                  >
                                    {isComplete ? (
                                      <CheckCircle2 size={14} strokeWidth={2} />
                                    ) : (
                                      <BookOpen size={14} strokeWidth={1.5} />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--on-surface)]">{course.title}</p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                      {course.target_language && (
                                        <span className="ds-chip">{course.target_language}</span>
                                      )}
                                      {course.level && (
                                        <span className="text-xs text-[var(--on-surface-variant)]">{course.level}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className={`shrink-0 text-sm font-semibold ${
                                    isComplete ? "text-emerald-600" : "text-[var(--primary)]"
                                  }`}
                                >
                                  {course.progress_percentage.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--primary-fixed-dim)]">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isComplete ? "bg-emerald-500" : "bg-[var(--primary)]"
                                  }`}
                                  style={{ width: `${course.progress_percentage}%` }}
                                />
                              </div>
                              <p className="mt-1.5 text-xs text-[var(--on-surface-variant)]">
                                {isComplete
                                  ? "Completed"
                                  : course.progress_percentage === 0
                                    ? "Not started"
                                    : "In progress"}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                    </CardContent>
                  )}

                  {employee.courses.length === 0 && (
                    <CardContent>
                      <p className="text-sm text-[var(--on-surface-variant)]">No courses enrolled yet.</p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
