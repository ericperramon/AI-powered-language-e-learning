export type AssistantCourseContext = {
  course: { title: string; target_language: string; level: string | null };
  units: Array<{
    id: string;
    title: string;
    sort_order: number;
    description: string | null;
    lessons: Array<{ id: string; title: string; sort_order: number }>;
  }>;
  currentUnit: {
    id: string;
    sort_order: number;
    description: string | null;
    title: string;
  } | null;
  previousUnit: {
    id: string;
    sort_order: number;
    description: string | null;
    title: string;
  } | null;
  currentUnitProgress: number;
} | null;

export function buildAssistantSystemPrompt(context: AssistantCourseContext): string {
  if (!context) {
    return [
      "ROL: Eres un asistente de profesor de idiomas en una plataforma de e-learning.",
      "El alumno está en el dashboard general, sin un curso activo.",
      "Responde de forma amigable a cualquier pregunta sobre aprendizaje de idiomas.",
    ].join("\n");
  }

  const { course, units, currentUnit, previousUnit, currentUnitProgress } = context;

  const courseIndex = units
    .map((unit) => {
      const lessonLines = unit.lessons
        .map((l) => `  - Lección ${unit.sort_order}.${l.sort_order}: ${l.title}`)
        .join("\n");
      return `Unidad ${unit.sort_order}: ${unit.title}\n${lessonLines}`;
    })
    .join("\n");

  const currentUnitSection = currentUnit
    ? [
        `UNIDAD ACTUAL (${currentUnit.sort_order}): ${currentUnit.title}`,
        `Descripción: ${currentUnit.description ?? "Sin descripción"}`,
        `Progreso del alumno: ${currentUnitProgress}% completado`,
      ].join("\n")
    : "El alumno está en la vista general del curso, sin unidad activa.";

  const previousUnitSection = previousUnit
    ? [
        `UNIDAD ANTERIOR (${previousUnit.sort_order}): ${previousUnit.title}`,
        `Descripción: ${previousUnit.description ?? "Sin descripción"}`,
      ].join("\n")
    : "";

  const sections = [
    `ROL: Eres el asistente de "${course.title}". Nivel ${course.level ?? "no especificado"}. Idioma objetivo: ${course.target_language}.`,
    "",
    "ÍNDICE DEL CURSO:",
    courseIndex,
    "",
    currentUnitSection,
  ];

  if (previousUnitSection) sections.push("", previousUnitSection);

  sections.push(
    "",
    "INSTRUCCIONES: Si el alumno pregunta sobre un tema de otra unidad, responde brevemente y menciona en qué unidad y lección puede repasarlo. Adapta el nivel de tus respuestas al nivel del curso."
  );

  return sections.join("\n");
}
