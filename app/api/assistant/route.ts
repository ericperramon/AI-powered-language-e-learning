import { NextResponse } from "next/server";
import {
  buildAudioResponseHeaders,
  isBinaryAudioResponse,
  normalizeWebhookResponse,
  readWebhookError
} from "@/lib/assistant/webhook";
import {
  buildAssistantSystemPrompt,
  type AssistantCourseContext
} from "@/lib/assistant/system-prompt";
import { guardAssistantRequest } from "@/lib/assistant/guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const guard = await guardAssistantRequest();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const isAudio = contentType.includes("multipart/form-data");

    const webhookUrl = isAudio
      ? process.env.N8N_ASSISTANT_AUDIO_WEBHOOK_URL
      : process.env.N8N_ASSISTANT_TEXT_WEBHOOK_URL;

    if (!webhookUrl) {
      const missingVar = isAudio ? "N8N_ASSISTANT_AUDIO_WEBHOOK_URL" : "N8N_ASSISTANT_TEXT_WEBHOOK_URL";
      return NextResponse.json({ error: `Missing ${missingVar} server environment variable.` }, { status: 500 });
    }

    const upstreamResponse = isAudio
      ? await forwardAudioRequest(request, webhookUrl)
      : await forwardJsonRequest(request, webhookUrl);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: `The n8n ${isAudio ? "audio" : "text"} webhook returned ${upstreamResponse.status}.`,
          details: await readWebhookError(upstreamResponse)
        },
        { status: 502 }
      );
    }

    if (isBinaryAudioResponse(upstreamResponse)) {
      return new Response(upstreamResponse.body, {
        headers: buildAudioResponseHeaders(upstreamResponse)
      });
    }

    const assistantResponse = await normalizeWebhookResponse(upstreamResponse);

    return NextResponse.json(assistantResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Assistant request failed."
      },
      { status: 500 }
    );
  }
}

async function forwardJsonRequest(request: Request, webhookUrl: string) {
  const payload = (await request.json()) as {
    courseContext?: AssistantCourseContext;
    [key: string]: unknown;
  };

  const { courseContext, ...rest } = payload;
  const systemPrompt = buildAssistantSystemPrompt(courseContext ?? null);

  return fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...rest, systemPrompt })
  });
}

async function forwardAudioRequest(request: Request, webhookUrl: string) {
  const incomingForm = await request.formData();
  const courseContextRaw = incomingForm.get("courseContext");
  const courseContext =
    typeof courseContextRaw === "string" && courseContextRaw
      ? (JSON.parse(courseContextRaw) as AssistantCourseContext)
      : null;
  const systemPrompt = buildAssistantSystemPrompt(courseContext ?? null);

  const outgoingForm = new FormData();
  for (const [key, value] of incomingForm.entries()) {
    if (key === "courseContext") continue;
    outgoingForm.append(key, value);
  }
  outgoingForm.append("systemPrompt", systemPrompt);

  return fetch(webhookUrl, {
    method: "POST",
    body: outgoingForm
  });
}
