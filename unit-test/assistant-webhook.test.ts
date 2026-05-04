import { describe, expect, it } from "vitest";
import {
  buildAudioResponseHeaders,
  extractReply,
  isBinaryAudioResponse,
  normalizeWebhookResponse,
  readWebhookError,
  resolveAudioContentType
} from "@/lib/assistant/webhook";

function response(body = "", headers: HeadersInit = {}) {
  return new Response(body, { headers });
}

describe("assistant webhook helpers", () => {
  describe("isBinaryAudioResponse", () => {
    it("detects direct audio content types", () => {
      expect(isBinaryAudioResponse(response("", { "content-type": "audio/wav" }))).toBe(true);
      expect(isBinaryAudioResponse(response("", { "content-type": "audio/mpeg" }))).toBe(true);
    });

    it("detects octet-stream responses as binary audio candidates", () => {
      expect(isBinaryAudioResponse(response("", { "content-type": "application/octet-stream" }))).toBe(true);
    });

    it("detects supported audio filenames from content disposition", () => {
      expect(
        isBinaryAudioResponse(
          response("", {
            "content-disposition": 'attachment; filename="speech.webm"'
          })
        )
      ).toBe(true);
    });

    it("does not classify non-audio text responses as audio", () => {
      expect(isBinaryAudioResponse(response("ok", { "content-type": "text/plain" }))).toBe(false);
    });
  });

  describe("resolveAudioContentType", () => {
    it("preserves explicit audio content type", () => {
      expect(resolveAudioContentType("audio/ogg", null)).toBe("audio/ogg");
    });

    it("infers content type from supported filename extension", () => {
      expect(resolveAudioContentType("application/octet-stream", 'attachment; filename="speech.mp3"')).toBe(
        "audio/mpeg"
      );
      expect(resolveAudioContentType(null, 'attachment; filename="speech.m4a"')).toBe("audio/mp4");
      expect(resolveAudioContentType(null, 'attachment; filename="speech.webm"')).toBe("audio/webm");
    });

    it("falls back to wav when content type and filename are not informative", () => {
      expect(resolveAudioContentType("application/octet-stream", null)).toBe("audio/wav");
      expect(resolveAudioContentType(null, 'attachment; filename="speech.bin"')).toBe("audio/wav");
    });
  });

  describe("buildAudioResponseHeaders", () => {
    it("normalizes audio headers and preserves assistant text headers", () => {
      const headers = buildAudioResponseHeaders(
        response("", {
          "content-type": "application/octet-stream",
          "content-length": "123",
          "content-disposition": 'attachment; filename="speech.mp3"',
          "x-assistant-text-base64": "SGVsbG8="
        })
      );

      expect(headers.get("content-type")).toBe("audio/mpeg");
      expect(headers.get("content-length")).toBe("123");
      expect(headers.get("content-disposition")).toBe('attachment; filename="speech.mp3"');
      expect(headers.get("x-assistant-text-base64")).toBe("SGVsbG8=");
      expect(headers.get("cache-control")).toBe("no-store");
    });
  });

  describe("extractReply", () => {
    it("extracts the first non-empty supported reply field", () => {
      expect(extractReply({ reply: "Hola" })).toBe("Hola");
      expect(extractReply({ reply: "", response: "Response text" })).toBe("Response text");
      expect(extractReply({ message: "Message text" })).toBe("Message text");
      expect(extractReply({ text: "Text field" })).toBe("Text field");
      expect(extractReply({ output: "Output field" })).toBe("Output field");
    });

    it("returns controlled fallback for null or non-object values", () => {
      expect(extractReply(null)).toBe("El asistente no ha devuelto contenido.");
      expect(extractReply("hello")).toBe("El asistente no ha devuelto contenido.");
    });

    it("stringifies unsupported JSON objects", () => {
      expect(extractReply({ data: ["a"] })).toBe(JSON.stringify({ data: ["a"] }));
    });
  });

  describe("normalizeWebhookResponse", () => {
    it("normalizes JSON webhook responses", async () => {
      await expect(normalizeWebhookResponse(response(JSON.stringify({ output: "Hi" }), { "content-type": "application/json" }))).resolves.toEqual({
        reply: "Hi",
        raw: { output: "Hi" }
      });
    });

    it("normalizes text webhook responses", async () => {
      await expect(normalizeWebhookResponse(response("plain text", { "content-type": "text/plain" }))).resolves.toEqual({
        reply: "plain text"
      });
    });

    it("returns a diagnostic fallback for empty text responses", async () => {
      await expect(normalizeWebhookResponse(response("", { "content-type": "text/plain" }))).resolves.toEqual({
        reply: "El asistente no ha devuelto contenido. Content-Type: text/plain"
      });
    });
  });

  describe("readWebhookError", () => {
    it("reads JSON error bodies as objects", async () => {
      await expect(
        readWebhookError(response(JSON.stringify({ message: "bad webhook" }), { "content-type": "application/json" }))
      ).resolves.toEqual({ message: "bad webhook" });
    });

    it("reads non-JSON error bodies as text", async () => {
      await expect(readWebhookError(response("bad webhook", { "content-type": "text/plain" }))).resolves.toBe(
        "bad webhook"
      );
    });
  });
});
