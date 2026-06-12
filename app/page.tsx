import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Brain, GraduationCap, MessageSquare, Play } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCourseRequest } from "@/app/explore-actions";

type Course = {
  id: string;
  title: string;
  description: string | null;
  target_language: string;
  level: string | null;
  estimated_duration_minutes: number | null;
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Redirect authenticated users straight to the dashboard
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch {
    // Env vars not set or other error — continue showing landing page
  }

  let courses: Course[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("courses")
      .select("id, title, description, target_language, level, estimated_duration_minutes")
      .eq("is_active", true)
      .order("title")
      .returns<Course[]>();
    courses = data ?? [];
  } catch {
    // Supabase unavailable — show page without courses
  }

  const courseRequestSuccess = params.success === "course-request";
  const courseRequestError = params.error === "missing-fields";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* ── Navbar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]/90 backdrop-blur">
        <div className="app-container flex h-16 items-center justify-between">
          <span className="font-display text-xl font-bold text-[var(--primary)]">GlossaAI</span>
          <Link href="/auth?mode=signin">
            <Button variant="primary" className="h-9 px-4 text-sm">
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="app-container py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="ds-chip mb-4 inline-flex">Plataforma e-learning con IA</span>
          <h1 className="font-display mt-4 text-4xl font-bold leading-tight text-[var(--on-surface)] sm:text-5xl">
            Aprende idiomas con IA,<br className="hidden sm:block" /> a tu ritmo
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--on-surface-variant)]">
            Contenido educativo de calidad, un asistente IA disponible 24/7 y seguimiento
            de tu progreso. Todo en una sola plataforma.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#cursos">
              <Button variant="primary" className="h-11 gap-2 px-6">
                Ver cursos disponibles
                <ArrowRight size={16} strokeWidth={2} />
              </Button>
            </a>
            <Link href="/auth?mode=signin">
              <Button variant="secondary" className="h-11 px-6">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
        </div>

        {/* Demo video placeholder */}
        <div className="mx-auto mt-14 max-w-4xl">
          <VideoPlaceholder label="Vídeo de demostración de la plataforma" tall />
        </div>
      </section>

      {/* ── Profesores ────────────────────────────────────────── */}
      <section className="bg-[var(--surface-container-low)] py-16 sm:py-20">
        <div className="app-container">
          <SectionHeader
            icon={<GraduationCap strokeWidth={1.5} size={22} />}
            title="Conoce a tu equipo docente"
            subtitle="Profesores nativos y expertos en metodología de aprendizaje de idiomas con IA."
          />
          <div className="mx-auto mt-10 max-w-3xl">
            <VideoPlaceholder label="Vídeo de presentación de los profesores" />
          </div>
        </div>
      </section>

      {/* ── Asistente IA ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="app-container">
          <SectionHeader
            icon={<Brain strokeWidth={1.5} size={22} />}
            title="Tu asistente IA"
            subtitle="Practica conversación, resuelve dudas y recibe correcciones instantáneas en cualquier momento."
          />
          <div className="mx-auto mt-10 max-w-3xl">
            <VideoPlaceholder label="Vídeo de presentación del asistente IA" />
          </div>
        </div>
      </section>

      {/* ── Cursos ────────────────────────────────────────────── */}
      <section id="cursos" className="bg-[var(--surface-container-low)] py-16 sm:py-20">
        <div className="app-container">
          <SectionHeader
            icon={<BookOpen strokeWidth={1.5} size={22} />}
            title="Cursos disponibles"
            subtitle="Explora nuestra oferta actual. Regístrate para obtener más información y acceder al contenido."
          />

          {courses.length === 0 ? (
            <p className="mt-10 text-center text-sm text-[var(--on-surface-variant)]">
              Próximamente — los cursos estarán disponibles muy pronto.
            </p>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── No encuentras tu curso ────────────────────────────── */}
      <section id="no-encuentras" className="py-16 sm:py-20">
        <div className="app-container">
          <div className="mx-auto max-w-xl">
            <div className="surface-card p-8">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-fixed)]">
                <MessageSquare size={20} strokeWidth={1.5} className="text-[var(--on-primary-fixed-variant)]" />
              </div>
              <h2 className="font-display mt-4 text-2xl font-bold text-[var(--on-surface)]">
                ¿No encuentras tu curso?
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                Dinos qué curso te gustaría que ofrecieramos. En un plazo de 24&nbsp;h te responderemos.
              </p>

              {courseRequestSuccess ? (
                <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  ¡Recibido! Te contactaremos en menos de 24 horas.
                </div>
              ) : (
                <form action={submitCourseRequest} className="mt-6 space-y-4">
                  {courseRequestError && (
                    <div className="rounded-lg border border-[var(--error-container)] bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--on-error-container)]">
                      Por favor, rellena todos los campos.
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" name="name" placeholder="Tu nombre" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact">Email o teléfono</Label>
                    <Input
                      id="contact"
                      name="contact"
                      placeholder="correo@ejemplo.com · +34 600 000 000"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sector">¿Qué curso te interesa?</Label>
                    <Input
                      id="sector"
                      name="sector"
                      placeholder="Ej: inglés técnico para ingenieros, alemán de negocios…"
                      required
                    />
                  </div>
                  <Button type="submit" className="h-11 w-full">
                    Enviar solicitud
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--outline-variant)] py-8">
        <div className="app-container flex flex-col items-center justify-between gap-4 text-sm text-[var(--on-surface-variant)] sm:flex-row">
          <span className="font-display font-semibold text-[var(--primary)]">GlossaAI</span>
          <Link href="/auth?mode=signin" className="hover:text-[var(--on-surface)] transition-colors">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function VideoPlaceholder({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div
      className={`flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] ${
        tall ? "aspect-video" : "aspect-video"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-fixed)]">
        <Play size={20} strokeWidth={1.5} className="translate-x-0.5 text-[var(--on-primary-fixed-variant)]" />
      </div>
      <p className="text-sm font-medium text-[var(--on-surface-variant)]">{label}</p>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)]">
        {icon}
      </div>
      <h2 className="font-display text-3xl font-bold text-[var(--on-surface)]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[var(--on-surface-variant)]">{subtitle}</p>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const duration = course.estimated_duration_minutes
    ? course.estimated_duration_minutes >= 60
      ? `${Math.round(course.estimated_duration_minutes / 60)}h`
      : `${course.estimated_duration_minutes}min`
    : null;

  return (
    <div className="surface-card flex flex-col gap-4 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ds-chip">{course.target_language}</span>
          {course.level && (
            <span className="text-xs text-[var(--on-surface-variant)]">{course.level}</span>
          )}
          {duration && (
            <span className="text-xs text-[var(--on-surface-variant)]">{duration}</span>
          )}
        </div>
        <h3 className="font-display mt-3 text-lg font-semibold leading-snug text-[var(--on-surface)]">
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)] line-clamp-3">
            {course.description}
          </p>
        )}
      </div>
      <div className="mt-auto">
        <Link href="/auth?mode=signin" className="block">
          <Button variant="secondary" className="h-10 w-full gap-2">
            Registrarse para más info
            <ArrowRight size={14} strokeWidth={2} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
