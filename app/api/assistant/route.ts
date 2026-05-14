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

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const webhookUrl = process.env.N8N_ASSISTANT_TEXT_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Missing N8N_ASSISTANT_TEXT_WEBHOOK_URL server environment variable." },
        { status: 500 }
      );
    }

    const upstreamResponse = await forwardJsonRequest(request, webhookUrl);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: `The n8n text webhook returned ${upstreamResponse.status}.`,
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
