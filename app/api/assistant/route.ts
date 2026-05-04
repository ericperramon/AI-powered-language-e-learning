import { NextResponse } from "next/server";
import {
  buildAudioResponseHeaders,
  isBinaryAudioResponse,
  normalizeWebhookResponse,
  readWebhookError
} from "@/lib/assistant/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isAudioRequest = contentType.includes("multipart/form-data");
    const webhookUrl = isAudioRequest
      ? process.env.N8N_ASSISTANT_AUDIO_WEBHOOK_URL
      : process.env.N8N_ASSISTANT_TEXT_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          error: `Missing ${
            isAudioRequest ? "N8N_ASSISTANT_AUDIO_WEBHOOK_URL" : "N8N_ASSISTANT_TEXT_WEBHOOK_URL"
          } server environment variable.`
        },
        { status: 500 }
      );
    }

    const webhookType = isAudioRequest ? "audio" : "text";
    const upstreamResponse = isAudioRequest
      ? await forwardMultipartRequest(request, webhookUrl)
      : await forwardJsonRequest(request, webhookUrl);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: `The n8n ${webhookType} webhook returned ${upstreamResponse.status}.`,
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
  const payload = await request.json();

  return fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function forwardMultipartRequest(request: Request, webhookUrl: string) {
  const incomingFormData = await request.formData();
  const outgoingFormData = new FormData();

  incomingFormData.forEach((value, key) => {
    outgoingFormData.append(key, value);
  });

  return fetch(webhookUrl, {
    method: "POST",
    body: outgoingFormData
  });
}
