import { describe, expect, it } from "vitest";
import {
  buildAssistantSystemPrompt,
  type AssistantCourseContext
} from "@/lib/assistant/system-prompt";

const baseContext: NonNullable<AssistantCourseContext> = {
  course: { title: "Business English", target_language: "English", level: "B1" },
  units: [
    {
      id: "u1",
      title: "Meetings",
      sort_order: 1,
      description: "Running meetings",
      lessons: [
        { id: "l1", title: "Agendas", sort_order: 1 },
        { id: "l2", title: "Minutes", sort_order: 2 }
      ]
    },
    {
      id: "u2",
      title: "Negotiation",
      sort_order: 2,
      description: null,
      lessons: [{ id: "l3", title: "Offers", sort_order: 1 }]
    }
  ],
  currentUnit: { id: "u2", sort_order: 2, description: null, title: "Negotiation" },
  previousUnit: { id: "u1", sort_order: 1, description: "Running meetings", title: "Meetings" },
  currentUnitProgress: 40
};

describe("buildAssistantSystemPrompt", () => {
  it("returns a generic dashboard prompt when there is no course context", () => {
    const prompt = buildAssistantSystemPrompt(null);

    expect(prompt).toContain("dashboard general");
    expect(prompt).not.toContain("ÍNDICE DEL CURSO");
  });

  it("includes the course identity, level and target language", () => {
    const prompt = buildAssistantSystemPrompt(baseContext);

    expect(prompt).toContain('asistente de "Business English"');
    expect(prompt).toContain("Nivel B1");
    expect(prompt).toContain("Idioma objetivo: English");
  });

  it("renders the full course index with unit.lesson numbering", () => {
    const prompt = buildAssistantSystemPrompt(baseContext);

    expect(prompt).toContain("Unidad 1: Meetings");
    expect(prompt).toContain("Lección 1.1: Agendas");
    expect(prompt).toContain("Lección 1.2: Minutes");
    expect(prompt).toContain("Unidad 2: Negotiation");
    expect(prompt).toContain("Lección 2.1: Offers");
  });

  it("includes current unit progress and previous unit when present", () => {
    const prompt = buildAssistantSystemPrompt(baseContext);

    expect(prompt).toContain("UNIDAD ACTUAL (2): Negotiation");
    expect(prompt).toContain("40% completado");
    expect(prompt).toContain("UNIDAD ANTERIOR (1): Meetings");
  });

  it("falls back gracefully when current/previous units are absent", () => {
    const prompt = buildAssistantSystemPrompt({
      ...baseContext,
      currentUnit: null,
      previousUnit: null
    });

    expect(prompt).toContain("vista general del curso");
    expect(prompt).not.toContain("UNIDAD ANTERIOR");
  });

  it("uses a placeholder when the course level is not specified", () => {
    const prompt = buildAssistantSystemPrompt({
      ...baseContext,
      course: { title: "French A0", target_language: "French", level: null }
    });

    expect(prompt).toContain("Nivel no especificado");
  });
});
