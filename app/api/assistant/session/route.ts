import { NextResponse } from "next/server";
import {
  buildAssistantSystemPrompt,
  type AssistantCourseContext
} from "@/lib/assistant/system-prompt";
import { guardAssistantRequest } from "@/lib/assistant/guard";

export const runtime = "nodejs";

type RealtimeSessionResponse = {
  client_secret: { value: string };
};

export async function POST(request: Request) {
  try {
    const guard = await guardAssistantRequest();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    const { courseContext } = (await request.json()) as {
      courseContext?: AssistantCourseContext;
    };

    const systemPrompt = buildAssistantSystemPrompt(courseContext ?? null);

    const sessionRes = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        instructions: systemPrompt,
        voice: "alloy",
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        }
      })
    });

    if (!sessionRes.ok) {
      const errorText = await sessionRes.text();
      console.error("[assistant/session] OpenAI error:", errorText);
      return NextResponse.json(
        { error: `OpenAI Realtime error: ${sessionRes.status} ${errorText}` },
        { status: 502 }
      );
    }

    const data = (await sessionRes.json()) as RealtimeSessionResponse;

    return NextResponse.json({
      client_secret: data.client_secret.value
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creating realtime session.";
    console.error("[assistant/session]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
