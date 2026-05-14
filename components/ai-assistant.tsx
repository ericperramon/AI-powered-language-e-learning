"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Mic, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistantContext } from "@/contexts/assistant-context";

type ConversationMode = "text" | "voice";
type AssistantStatus = "idle" | "listening" | "sending" | "replying" | "error";
type ChatMessage = {
  id: string;
  role: "student" | "assistant";
  content: string;
  createdAt: string;
  audioUrl?: string;
};

type RealtimeEvent = { type: string; [key: string]: unknown };

const WELCOME_MESSAGE = "Hi! How can I help you?";

export function AiAssistant() {
  const { courseContext } = useAssistantContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<ConversationMode | null>(null);
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [welcomeTime] = useState(() => getCurrentTime());

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const idCounterRef = useRef(0);
  const conversationIdRef = useRef("");
  const statusRef = useRef<AssistantStatus>("idle");

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

  const stopVoiceCapture = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
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
    void startVoiceCapture();
  }

  function muteVoiceMode() {
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "text",
          message: content,
          conversationId: currentConversationId,
          source: "student-assistant-widget",
          courseContext
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
      setError("Este navegador no permite acceder al micrófono.");
      return;
    }

    try {
      stopVoiceCapture();
      setStatus("sending");

      // 1. Obtener token efímero del servidor (systemPrompt ya inyectado)
      const sessionRes = await fetch("/api/assistant/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseContext })
      });

      if (!sessionRes.ok) {
        let errMessage = "No se ha podido crear la sesión de voz.";
        try {
          const err = (await sessionRes.json()) as { error?: string };
          if (err.error) errMessage = err.error;
        } catch {
          // respuesta vacía o no-JSON, usar mensaje por defecto
        }
        throw new Error(errMessage);
      }

      const { client_secret } = (await sessionRes.json()) as { client_secret: string };

      // 2. Configurar peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Audio remoto: respuesta de OpenAI
      const audioEl = new Audio();
      audioEl.autoplay = true;
      remoteAudioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // Audio local: micrófono del alumno
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Data channel para eventos de transcripción
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;
      dc.onmessage = (e) => handleRealtimeEvent(JSON.parse(e.data as string) as RealtimeEvent);

      // 3. SDP handshake con OpenAI Realtime
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${client_secret}`,
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });

      if (!sdpRes.ok) {
        throw new Error(`Error conectando con OpenAI Realtime: ${sdpRes.status}`);
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

      setStatus("listening");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No se ha podido iniciar la sesión de voz.");
      stopVoiceCapture();
    }
  }

  function handleRealtimeEvent(event: RealtimeEvent) {
    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = (event.transcript as string | undefined) ?? "";
      if (transcript.trim()) appendMessage("student", transcript.trim());
    }
    if (event.type === "response.audio_transcript.done") {
      const transcript = (event.transcript as string | undefined) ?? "";
      if (transcript.trim()) appendMessage("assistant", transcript.trim());
      setStatus("listening");
    }
    if (event.type === "response.audio.started") {
      setStatus("replying");
    }
    if (event.type === "error") {
      const errEvent = event.error as { message?: string } | undefined;
      setStatus("error");
      setError(errEvent?.message ?? "Error en la sesión de voz.");
    }
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

  useEffect(() => {
    return () => {
      stopVoiceCapture();
    };
  }, [stopVoiceCapture]);

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
                  {status === "sending"
                    ? "Connecting"
                    : status === "replying"
                      ? "Speaking"
                      : "Listening"}
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
