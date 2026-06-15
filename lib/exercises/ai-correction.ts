import Anthropic from "@anthropic-ai/sdk";
import type { ExerciseCorrection } from "./evaluation";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function correctWithAI(
  aiCorrectionPrompt: string,
  studentAnswer: string,
  minimumScore: number
): Promise<ExerciseCorrection> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: aiCorrectionPrompt,
    messages: [
      {
        role: "user",
        content: `Student answer:\n\n${studentAnswer}\n\nRespond with valid JSON only, no markdown:\n{"score": <0-100>, "feedback": "<specific feedback in the same language the student used>"}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  try {
    const parsed = JSON.parse(raw) as { score: number; feedback: string };
    const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));
    const feedback = typeof parsed.feedback === "string" ? parsed.feedback : "Feedback unavailable.";
    return {
      passed: score >= minimumScore,
      score,
      feedback,
      expectedAnswer: null,
      incorrectAnswers: [],
    };
  } catch {
    return {
      passed: false,
      score: 0,
      feedback: "AI correction failed. Please try again.",
      expectedAnswer: null,
      incorrectAnswers: [],
    };
  }
}
