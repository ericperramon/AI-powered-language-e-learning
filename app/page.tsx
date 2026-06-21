import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Brain, GraduationCap, MessageSquare, Play } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCourseRequest } from "@/app/explore-actions";
import { LandingDemoVideo } from "@/components/landing-demo-video";

type Course = {
  id: string;
  title: string;
  description: string | null;
  target_language: string;
  level: string | null;
  estimated_duration_minutes: number | null;
};

type CourseGroup = {
  title: string;
  description: string | null;
  target_language: string;
  levels: { id: string; level: string | null; estimated_duration_minutes: number | null }[];
};

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

const STATIC_COMING_SOON_COURSES: { title: string; description: string; tag: string }[] = [
  {
    title: "English for Presentations",
    description: "Aprende a estructurar y defender presentaciones profesionales en inglés con confianza y claridad.",
    tag: "Inglés",
  },
  {
    title: "English for Negotiations",
    description: "Domina el vocabulario y las estrategias clave para negociar con éxito en entornos internacionales.",
    tag: "Inglés",
  },
];

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

  const courseGroups = courses.reduce<CourseGroup[]>((acc, course) => {
    const dashIdx = course.title.lastIndexOf(" - ");
    const baseTitle = dashIdx !== -1 ? course.title.slice(0, dashIdx) : course.title;
    const levelLabel = dashIdx !== -1 ? course.title.slice(dashIdx + 3) : (course.level ?? null);

    const existing = acc.find((g) => g.title === baseTitle);
    if (existing) {
      existing.levels.push({ id: course.id, level: levelLabel, estimated_duration_minutes: course.estimated_duration_minutes });
    } else {
      acc.push({
        title: baseTitle,
        description: course.description,
        target_language: course.target_language,
        levels: [{ id: course.id, level: levelLabel, estimated_duration_minutes: course.estimated_duration_minutes }],
      });
    }
    return acc;
  }, []);

  courseGroups.forEach((g) =>
    g.levels.sort((a, b) => {
      const ia = LEVEL_ORDER.indexOf(a.level ?? "");
      const ib = LEVEL_ORDER.indexOf(b.level ?? "");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
  );

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
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left: editorial thesis */}
          <div>
            <h1 className="font-display mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-[var(--on-surface)] sm:text-5xl lg:text-6xl">
              Tu profesor de idiomas
              <span className="text-[var(--primary)]"> 24/7</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--on-surface-variant)]">
              Conversa, equivócate y corrige al instante con un asistente IA disponible 24/7.
              Contenido estructurado, ejercicios guiados y seguimiento real de tu progreso.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#cursos">
                <Button variant="primary" className="h-12 gap-2 px-6 text-base">
                  Ver cursos disponibles
                  <ArrowRight size={18} strokeWidth={2} />
                </Button>
              </a>
              <Link href="/auth?mode=signin">
                <Button variant="secondary" className="h-12 px-6 text-base">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                { value: "24/7", label: "Asistente IA disponible" },
                { value: "Al instante", label: "Corrección de tus errores" },
                { value: "A1–C1", label: "Niveles cubiertos" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="font-display text-2xl font-bold text-[var(--on-surface)]">{stat.value}</dt>
                  <dd className="mt-0.5 text-sm text-[var(--on-surface-variant)]">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: live lesson exchange — the signature element */}
          <div className="lesson-exchange" aria-label="Ejemplo de conversación con el profesor IA">
            <div className="lesson-exchange-head">
              <Brain size={18} strokeWidth={1.5} />
              <span className="font-display text-sm font-semibold">Glossi</span>
              <span className="lesson-exchange-status">En línea</span>
            </div>
            <div className="lesson-exchange-body">
              <p className="lesson-bubble lesson-bubble-student">
                <span className="lesson-bubble-label">Tú</span>
                Yesterday I go to the conference and speak with three clients.
              </p>
              <p className="lesson-bubble lesson-bubble-tutor">
                <span className="lesson-bubble-label">Glossi</span>
                Casi perfecto. En pasado decimos{" "}
                <span className="lesson-correction">I went</span> y{" "}
                <span className="lesson-correction">spoke</span>. ¿Lo intentas otra vez?
              </p>
              <p className="lesson-bubble lesson-bubble-student">
                <span className="lesson-bubble-label">Tú</span>
                Yesterday I went to the conference and spoke with three clients.
              </p>
              <span className="lesson-typing" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        </div>

        {/* Demo video */}
        <div className="mx-auto mt-16 max-w-4xl">
          <LandingDemoVideo src="/videos/GlossaAI_Landing.mp4" />
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

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courseGroups.map((group) => (
              <GroupedCourseCard key={group.title} group={group} />
            ))}
            {STATIC_COMING_SOON_COURSES.map((c) => (
              <ComingSoonCourseCard key={c.title} title={c.title} description={c.description} tag={c.tag} />
            ))}
            {courseGroups.length === 0 && STATIC_COMING_SOON_COURSES.length === 0 && (
              <p className="col-span-full text-center text-sm text-[var(--on-surface-variant)]">
                Próximamente — los cursos estarán disponibles muy pronto.
              </p>
            )}
          </div>
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
  const playSize = tall ? "h-20 w-20" : "h-16 w-16";
  return (
    <figure className="group relative aspect-video w-full overflow-hidden rounded-[var(--r-xl)] border border-[var(--outline-variant)] bg-gradient-to-br from-[var(--surface-container-low)] via-[var(--surface-container)] to-[var(--surface-container-high)]">
      {/* Subtle film-frame grid so the empty state reads as intentional media, not a blank box */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(var(--outline-variant) 1px, transparent 1px), linear-gradient(90deg, var(--outline-variant) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 35%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 78%)"
        }}
      />
      <span className="ds-chip absolute left-4 top-4">Próximamente</span>
      <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <span
          className={`flex ${playSize} items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_14px_36px_rgba(42,111,151,0.30)] transition-transform duration-300 group-hover:scale-105`}
        >
          <Play size={tall ? 30 : 26} strokeWidth={1.5} className="translate-x-0.5" />
        </span>
        <figcaption className="max-w-xs text-sm font-medium leading-6 text-[var(--on-surface-variant)]">
          {label}
        </figcaption>
      </div>
    </figure>
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

function GroupedCourseCard({ group }: { group: CourseGroup }) {
  const hasMultipleLevels = group.levels.length > 1;

  return (
    <div className="surface-card flex flex-col gap-4 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ds-chip">{group.target_language}</span>
        </div>
        <h3 className="font-display mt-3 text-lg font-semibold leading-snug text-[var(--on-surface)]">
          {group.title}
        </h3>
        {group.description && (
          <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)] line-clamp-3">
            {group.description}
          </p>
        )}
        {hasMultipleLevels && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-[var(--on-surface-variant)]">Niveles disponibles</p>
            <div className="flex flex-wrap gap-1.5">
              {group.levels.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2.5 py-0.5 text-xs font-semibold text-[var(--on-surface)]"
                >
                  {l.level ?? "—"}
                </span>
              ))}
            </div>
          </div>
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

function ComingSoonCourseCard({
  title,
  description,
  tag,
}: {
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <div className="surface-card flex flex-col gap-4 p-5 opacity-60">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ds-chip">{tag}</span>
          <span className="inline-flex items-center rounded-md bg-[var(--surface-container-high)] px-2 py-0.5 text-xs font-medium text-[var(--on-surface-variant)]">
            Próximamente
          </span>
        </div>
        <h3 className="font-display mt-3 text-lg font-semibold leading-snug text-[var(--on-surface)]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)] line-clamp-3">
          {description}
        </p>
      </div>
      <div className="mt-auto">
        <Button variant="secondary" className="h-10 w-full" disabled>
          Disponible próximamente
        </Button>
      </div>
    </div>
  );
}
