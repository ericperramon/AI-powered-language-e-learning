export type AssistantResponse = {
  reply: string;
  raw?: unknown;
};

const AUDIO_EXTENSION_CONTENT_TYPES: Record<string, string> = {
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm"
};

export function isBinaryAudioResponse(response: Response) {
  const responseType = response.headers.get("content-type") ?? "";
  const disposition = response.headers.get("content-disposition") ?? "";

  return (
    responseType.startsWith("audio/") ||
    responseType.includes("application/octet-stream") ||
    getAudioExtensionFromDisposition(disposition) !== null
  );
}

export function buildAudioResponseHeaders(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  const contentDisposition = response.headers.get("content-disposition");
  const assistantText = response.headers.get("x-assistant-text");
  const assistantTextBase64 = response.headers.get("x-assistant-text-base64");

  headers.set("content-type", resolveAudioContentType(contentType, contentDisposition));
  if (contentLength) headers.set("content-length", contentLength);
  if (contentDisposition) headers.set("content-disposition", contentDisposition);
  if (assistantText) headers.set("x-assistant-text", assistantText);
  if (assistantTextBase64) headers.set("x-assistant-text-base64", assistantTextBase64);
  headers.set("cache-control", "no-store");

  return headers;
}

export function resolveAudioContentType(contentType: string | null, contentDisposition: string | null) {
  if (contentType?.startsWith("audio/")) {
    return contentType;
  }

  const extension = getAudioExtensionFromDisposition(contentDisposition ?? "");

  if (extension) {
    return AUDIO_EXTENSION_CONTENT_TYPES[extension];
  }

  return "audio/wav";
}

export async function readWebhookError(response: Response) {
  const responseType = response.headers.get("content-type") ?? "";

  if (responseType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function normalizeWebhookResponse(response: Response): Promise<AssistantResponse> {
  const responseType = response.headers.get("content-type") ?? "";

  if (responseType.includes("application/json")) {
    const json = (await response.json()) as unknown;
    const reply = extractReply(json);

    return {
      reply,
      raw: json
    };
  }

  const text = await response.text();

  return {
    reply: text || `El asistente no ha devuelto contenido. Content-Type: ${responseType || "desconocido"}`
  };
}

export function extractReply(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "El asistente no ha devuelto contenido.";
  }

  const record = value as Record<string, unknown>;
  const candidates = [record.reply, record.response, record.message, record.text, record.output];
  const match = candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);

  return typeof match === "string" ? match : JSON.stringify(value);
}

function getAudioExtensionFromDisposition(disposition: string) {
  const match = disposition.match(/\.([a-z0-9]+)(?:\"|$)/i);
  const extension = match?.[1]?.toLowerCase();

  return extension && extension in AUDIO_EXTENSION_CONTENT_TYPES ? extension : null;
}
