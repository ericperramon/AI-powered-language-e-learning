"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Mic, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ConversationMode = "text" | "voice";
type AssistantStatus = "idle" | "listening" | "sending" | "replying" | "error";
type ChatMessage = {
  id: string;
  role: "student" | "assistant";
  content: string;
  createdAt: string;
  audioUrl?: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;
type BrowserAudioContextConstructor = typeof AudioContext;

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: BrowserAudioContextConstructor;
  }
}

const AUTO_SEND_SILENCE_MS = 1300;
const SPEECH_VOLUME_THRESHOLD = 0.012;
const WELCOME_MESSAGE = "Hi! How can I help you?";

export function AiAssistant() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<ConversationMode | null>(null);
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [welcomeTime] = useState(() => getCurrentTime());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceFrameRef = useRef<number | null>(null);
  const transcriptSilenceTimeoutRef = useRef<number | null>(null);
  const silenceStartedAtRef = useRef<number | null>(null);
  const speechStartedRef = useRef(false);
  const isSendingAudioRef = useRef(false);
  const shouldContinueVoiceRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const idCounterRef = useRef(0);
  const conversationIdRef = useRef("");
  const statusRef = useRef<AssistantStatus>("idle");
  const voiceTranscriptRef = useRef("");

  const statusLabel = useMemo(() => {
    if (status === "listening") return "Escuchando";
    if (status === "sending") return "Enviando";
    if (status === "replying") return "Respondiendo";
    if (status === "error") return "Revisar";
    return mode ? "Activo" : "Disponible";
  }, [mode, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, mode]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const stopVoiceDetection = useCallback(() => {
    if (silenceFrameRef.current) {
      cancelAnimationFrame(silenceFrameRef.current);
      silenceFrameRef.current = null;
    }
    if (transcriptSilenceTimeoutRef.current) {
      window.clearTimeout(transcriptSilenceTimeoutRef.current);
      transcriptSilenceTimeoutRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    speechStartedRef.current = false;
    silenceStartedAtRef.current = null;
  }, []);

  const stopVoiceCapture = useCallback(() => {
    stopVoiceDetection();

    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, [stopVoiceDetection]);

  const cleanupAudioUrls = useCallback(() => {
    audioUrlsRef.current.forEach((audioUrl) => URL.revokeObjectURL(audioUrl));
    audioUrlsRef.current = [];
  }, []);

  function openAssistant() {
    setIsExpanded(true);
  }

  function ensureConversation(nextMode: ConversationMode) {
    let currentConversationId = conversationIdRef.current;

    if (!currentConversationId) {
      currentConversationId = nextId("conversation");
      conversationIdRef.current = currentConversationId;
    }

    setMode(nextMode);
    setIsExpanded(true);
    setError(null);

    return currentConversationId;
  }

  function toggleVoiceMode() {
    if (mode === "voice") {
      muteVoiceMode();
      return;
    }

    ensureConversation("voice");
    shouldContinueVoiceRef.current = true;
    void startVoiceCapture();
  }

  function muteVoiceMode() {
    shouldContinueVoiceRef.current = false;
    stopVoiceCapture();
    setMode("text");
    setStatus("idle");
    setError(null);
  }

  function switchToTextMode() {
    muteVoiceMode();
    ensureConversation("text");
  }

  async function sendTextMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content || status === "sending" || status === "replying") return;
    const currentConversationId = ensureConversation("text");

    setInput("");
    appendMessage("student", content);
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          type: "text",
          message: content,
          conversationId: currentConversationId,
          source: "student-assistant-widget"
        })
      });

      const data = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se ha podido contactar con el asistente.");
      }

      appendMessage("assistant", data.reply ?? "El asistente no ha devuelto contenido.");
      setStatus("idle");
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Error enviando el mensaje.");
    }
  }

  async function startVoiceCapture() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Este navegador no permite grabar audio desde la pagina.");
      return;
    }

    try {
      stopVoiceCapture();
      audioChunksRef.current = [];
      voiceTranscriptRef.current = "";

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      startSpeechRecognition();
      startSilenceDetection(stream);
      setStatus("listening");
      setError(null);
    } catch {
      setStatus("error");
      setError("No se ha podido acceder al microfono.");
    }
  }

  async function sendCurrentAudio() {
    const recorder = mediaRecorderRef.current;

    if (
      !recorder ||
      isSendingAudioRef.current ||
      statusRef.current === "sending" ||
      statusRef.current === "replying"
    ) {
      return;
    }

    isSendingAudioRef.current = true;
    setStatus("sending");
    setError(null);

    const audioBlob = await stopRecorderAndBuildBlob();
    const transcript = voiceTranscriptRef.current.trim();

    if (audioBlob.size === 0 && !transcript) {
      setStatus("error");
      setError("No se ha detectado audio para enviar.");
      isSendingAudioRef.current = false;
      if (shouldContinueVoiceRef.current) void startVoiceCapture();
      return;
    }

    appendMessage("student", transcript || "Audio enviado");

    const formData = new FormData();
    formData.append("type", "audio");
    formData.append("conversationId", ensureConversation("voice"));
    formData.append("source", "student-assistant-widget");
    formData.append("transcript", transcript);
    formData.append("audio", audioBlob, `assistant-audio-${nextId("audio")}.webm`);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await readAssistantError(response);
        throw new Error(errorData);
      }

      if (isAudioResponse(response)) {
        setStatus("replying");
        const assistantText = readAssistantTextHeader(response);
        const audioBlob = await response.blob();
        const audioType = response.headers.get("content-type") ?? audioBlob.type;
        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlsRef.current.push(audioUrl);
        appendMessage("assistant", assistantText || "Respuesta de audio recibida.", audioUrl);

        try {
        await playAssistantAudioUrl(audioUrl, audioType, audioBlob.size);
      } catch (playError) {
        setError(playError instanceof Error ? playError.message : "Usa el reproductor para escuchar el audio.");
      }

        voiceTranscriptRef.current = "";
        setStatus("idle");
        isSendingAudioRef.current = false;

        if (shouldContinueVoiceRef.current) {
          void startVoiceCapture();
        }

        return;
      }

      const data = (await response.json()) as { reply?: string; error?: string };
      appendMessage("assistant", data.reply ?? "El asistente no ha devuelto contenido.");
      voiceTranscriptRef.current = "";
      setStatus("idle");
      isSendingAudioRef.current = false;

      if (shouldContinueVoiceRef.current) {
        void startVoiceCapture();
      }
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Error enviando el audio.");
      isSendingAudioRef.current = false;
      if (shouldContinueVoiceRef.current) void startVoiceCapture();
    }
  }

  function isAudioResponse(response: Response) {
    const responseType = response.headers.get("content-type") ?? "";

    return responseType.startsWith("audio/") || responseType.includes("application/octet-stream");
  }

  function readAssistantTextHeader(response: Response) {
    const base64Value = response.headers.get("x-assistant-text-base64");

    if (base64Value) {
      try {
        return decodeBase64Utf8(base64Value);
      } catch {
        return "";
      }
    }

    const value = response.headers.get("x-assistant-text");

    if (!value) return "";

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function decodeBase64Utf8(value: string) {
    const binary = window.atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  async function readAssistantError(response: Response) {
    const responseType = response.headers.get("content-type") ?? "";

    if (responseType.includes("application/json")) {
      const data = (await response.json()) as { error?: string; details?: unknown };
      const details =
        typeof data.details === "string"
          ? data.details
          : data.details
            ? JSON.stringify(data.details)
            : "";

      return [data.error, details].filter(Boolean).join(" ");
    }

    return response.text();
  }

  function playAssistantAudioUrl(audioUrl: string, contentType: string, byteSize: number) {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        resolve();
      };
      audio.onerror = () => {
        openAudioFallback(audioUrl);
        reject(new Error(`No se ha podido reproducir automaticamente el audio (${contentType}, ${byteSize} bytes). Usa el reproductor.`));
      };

      void audio.play().catch((playError: unknown) => {
        openAudioFallback(audioUrl);
        const detail = playError instanceof Error ? playError.message : "Error desconocido";
        reject(new Error(`No se ha podido reproducir el audio (${contentType}, ${byteSize} bytes): ${detail}. Usa el reproductor.`));
      });
    });
  }

  function openAudioFallback(audioUrl: string) {
    window.open(audioUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(audioUrl), 30_000);
  }

  function appendMessage(role: ChatMessage["role"], content: string, audioUrl?: string) {
    setMessages((current) => [
      ...current,
      {
        id: nextId("message"),
        role,
        content,
        createdAt: getCurrentTime(),
        audioUrl
      }
    ]);
  }

  function getCurrentTime() {
    return new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
  }

  function nextId(prefix: string) {
    idCounterRef.current += 1;
    return `${prefix}-${idCounterRef.current}`;
  }

  function startSpeechRecognition() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-ES";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      const nextTranscript = transcript.trim();
      voiceTranscriptRef.current = nextTranscript;

      if (nextTranscript) {
        speechStartedRef.current = true;
        scheduleTranscriptAutoSend();
      }
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function startSilenceDetection(stream: MediaStream) {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;

    if (!AudioContextConstructor) return;

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 1024;
    const data = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    void audioContext.resume();
    speechStartedRef.current = false;
    silenceStartedAtRef.current = null;

    const detectSilence = () => {
      analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }

      const volume = Math.sqrt(sum / data.length);
      const now = performance.now();

      if (volume > SPEECH_VOLUME_THRESHOLD) {
        speechStartedRef.current = true;
        silenceStartedAtRef.current = null;
      } else if (speechStartedRef.current) {
        silenceStartedAtRef.current ??= now;

        if (now - silenceStartedAtRef.current > AUTO_SEND_SILENCE_MS) {
          void sendCurrentAudio();
          return;
        }
      }

      silenceFrameRef.current = requestAnimationFrame(detectSilence);
    };

    silenceFrameRef.current = requestAnimationFrame(detectSilence);
  }

  function scheduleTranscriptAutoSend() {
    if (transcriptSilenceTimeoutRef.current) {
      window.clearTimeout(transcriptSilenceTimeoutRef.current);
    }

    transcriptSilenceTimeoutRef.current = window.setTimeout(() => {
      if (shouldContinueVoiceRef.current && !isSendingAudioRef.current) {
        void sendCurrentAudio();
      }
    }, AUTO_SEND_SILENCE_MS);
  }

  function stopRecorderAndBuildBlob() {
    return new Promise<Blob>((resolve) => {
      const recorder = mediaRecorderRef.current;

      stopVoiceDetection();
      recognitionRef.current?.stop();
      recognitionRef.current = null;

      if (!recorder || recorder.state === "inactive") {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        return;
      }

      recorder.onstop = () => {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      recorder.stop();
    });
  }

  useEffect(() => {
    return () => {
      stopVoiceCapture();
      cleanupAudioUrls();
    };
  }, [cleanupAudioUrls, stopVoiceCapture]);

  const visibleMessages =
    messages.length > 0
      ? messages
      : [
          {
            id: "assistant-welcome",
            role: "assistant" as const,
            content: WELCOME_MESSAGE,
            createdAt: welcomeTime
          }
        ];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] flex-col items-end gap-3">
      {isExpanded ? (
        <section
          aria-label="Asistente IA"
          className={cn(
            "assistant-chat-panel",
            mode === "voice" && "assistant-chat-panel-voice"
          )}
        >
          {mode === "voice" ? (
            <div className="assistant-voice-interface">
              <button
                aria-label="Cerrar asistente de voz"
                className="assistant-voice-back"
                type="button"
                onClick={() => setIsExpanded(false)}
              >
                <X size={22} />
              </button>

              <div className="assistant-voice-orb" aria-hidden="true">
                <span className="assistant-voice-orb-core" />
              </div>

              <button
                aria-label="Volver al chat por texto"
                className="assistant-voice-keyboard"
                type="button"
                onClick={switchToTextMode}
              >
                <Keyboard size={28} />
              </button>

              {error ? <p className="assistant-chat-error assistant-voice-error">{error}</p> : null}

              <div className="assistant-voice-bottom">
                <button
                  aria-label="Microfono activo"
                  className="assistant-voice-mic"
                  type="button"
                  onClick={muteVoiceMode}
                >
                  <Mic size={32} />
                </button>
                <div className="assistant-voice-status">
                  {status === "sending" ? "Thinking" : status === "replying" ? "Speaking" : "Listening"}
                </div>
              </div>
            </div>
          ) : (
            <>
              <header className="assistant-chat-header">
                <span className="assistant-chat-status">{statusLabel}</span>
                <button
                  aria-label="Cerrar panel del asistente"
                  className="assistant-chat-close"
                  type="button"
                  onClick={() => setIsExpanded(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="assistant-chat-messages">
                {visibleMessages.map((message) => (
                  <div
                    className={cn(
                      "assistant-chat-message",
                      message.role === "student" && "assistant-chat-message-student"
                    )}
                    key={message.id}
                  >
                    <div
                      className={cn(
                        "assistant-chat-bubble",
                        message.role === "student" && "assistant-chat-bubble-student"
                      )}
                    >
                      {message.content}
                      {message.audioUrl ? (
                        <audio className="assistant-chat-audio" controls src={message.audioUrl}>
                          Audio response
                        </audio>
                      ) : null}
                    </div>
                    <span className="assistant-chat-time">{message.createdAt}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {error ? <p className="assistant-chat-error">{error}</p> : null}

              <form className="assistant-chat-controls" onSubmit={sendTextMessage}>
                <button
                  aria-label="Activar microfono"
                  className="assistant-chat-mic"
                  type="button"
                  onClick={toggleVoiceMode}
                >
                  <Mic size={24} />
                </button>
                <div className="assistant-chat-input-wrap">
                  <input
                    className="assistant-chat-input"
                    placeholder="Write now..."
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onFocus={() => ensureConversation("text")}
                  />
                  {input.trim() ? (
                    <button
                      aria-label="Enviar mensaje"
                      className="assistant-chat-send"
                      disabled={status === "sending"}
                      type="submit"
                    >
                      <Send size={22} />
                    </button>
                  ) : (
                    <button
                      aria-label="Enviar mensaje"
                      className="assistant-chat-send assistant-chat-send-idle"
                      disabled
                      type="submit"
                    >
                      <Send size={22} />
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </section>
      ) : null}

      <button
        aria-label="Abrir asistente IA"
        className={cn(
          "assistant-robot group relative h-36 w-32 border-0 bg-transparent p-0",
          isExpanded && "assistant-robot-active"
        )}
        type="button"
        onClick={openAssistant}
      >
        <span className="assistant-head-shell">
          <span className="assistant-hair" />
          <span className="assistant-ear assistant-ear-left" />
          <span className="assistant-ear assistant-ear-right" />
          <span className="assistant-face">
            <span className="assistant-brow assistant-brow-left" />
            <span className="assistant-brow assistant-brow-right" />
            <span className="assistant-eye assistant-eye-left">
              <span className="assistant-pupil" />
            </span>
            <span className="assistant-eye assistant-eye-right">
              <span className="assistant-pupil" />
            </span>
            <span className="assistant-mouth" />
          </span>
        </span>
        <span className="assistant-neck" />
        <span className="assistant-torso">
          <span className="assistant-panel" />
          <span className="assistant-core">
            <span />
          </span>
        </span>
        <span className="assistant-arm assistant-arm-left" />
        <span className="assistant-arm assistant-arm-right" />
        <span className="assistant-leg assistant-leg-left" />
        <span className="assistant-leg assistant-leg-right" />
        <span className="assistant-shadow" />
      </button>
    </div>
  );
}
