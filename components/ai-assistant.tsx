"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, MessageCircle, Mic, Send, X } from "lucide-react";
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

const WELCOME_MESSAGE = "Hi! How can I help you?";

export function AiAssistant({ variant = "floating" }: { variant?: "floating" | "page" }) {
  const { courseContext } = useAssistantContext();

  const [isExpanded, setIsExpanded] = useState(variant === "page");
  const [mode, setMode] = useState<ConversationMode | null>(null);
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [welcomeTime] = useState(() => getCurrentTime());

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const voiceReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const replyObjectUrlRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const idCounterRef = useRef(0);
  const conversationIdRef = useRef("");
  const statusRef = useRef<AssistantStatus>("idle");

  const mouthAudioContextRef = useRef<AudioContext | null>(null);
  const mouthAnalyserRef = useRef<AnalyserNode | null>(null);
  const mouthSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mouthRafRef = useRef<number | null>(null);
  const buttonMouthRef = useRef<HTMLSpanElement | null>(null);
  const orbMouthRef = useRef<HTMLSpanElement | null>(null);

  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const listeningRafRef = useRef<number | null>(null);

  const statusLabel = useMemo(() => {
    if (status === "listening") return "Listening";
    if (status === "sending") return "Sending";
    if (status === "replying") return "Replying";
    if (status === "error") return "Check";
    return mode ? "Active" : "Available";
  }, [mode, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, mode]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const setMouthScale = useCallback((scale: number) => {
    buttonMouthRef.current?.style.setProperty("--mouth-scale", scale.toFixed(3));
    orbMouthRef.current?.style.setProperty("--mouth-scale", scale.toFixed(3));
  }, []);

  const stopMouthLoop = useCallback(() => {
    if (mouthRafRef.current !== null) {
      cancelAnimationFrame(mouthRafRef.current);
      mouthRafRef.current = null;
    }
    setMouthScale(0.2);
  }, [setMouthScale]);

  const startMouthLoop = useCallback(() => {
    const analyser = mouthAnalyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(data);

      let sumSquares = 0;
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / data.length);
      const level = Math.min(1, rms * 6);
      setMouthScale(0.2 + level * 0.9);

      mouthRafRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [setMouthScale]);

  // The analyser graph hangs off a single persistent <audio> element: a
  // MediaElementAudioSourceNode can only be created once per element.
  const ensureMouthAnalyserGraph = useCallback((audioEl: HTMLAudioElement) => {
    if (!mouthAudioContextRef.current) {
      mouthAudioContextRef.current = new AudioContext();
    }
    if (!mouthSourceRef.current) {
      const audioContext = mouthAudioContextRef.current;
      const source = audioContext.createMediaElementSource(audioEl);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(audioContext.destination);
      source.connect(analyser);
      mouthSourceRef.current = source;
      mouthAnalyserRef.current = analyser;
    }
  }, []);

  const stopListeningMonitor = useCallback(() => {
    if (listeningRafRef.current !== null) {
      cancelAnimationFrame(listeningRafRef.current);
      listeningRafRef.current = null;
    }
    inputSourceRef.current?.disconnect();
    inputSourceRef.current = null;
    setMouthScale(0.2);
  }, [setMouthScale]);

  // Watches mic input while recording: animates the mouth with the live input
  // level (visual "I'm listening" feedback) and auto-stops after ~1.5s of silence.
  const startListeningMonitor = useCallback(
    (stream: MediaStream) => {
      if (!mouthAudioContextRef.current) {
        mouthAudioContextRef.current = new AudioContext();
      }
      const audioContext = mouthAudioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      inputSourceRef.current = source;

      const data = new Uint8Array(analyser.fftSize);
      const silenceThreshold = 0.015;
      const silenceLimitMs = 1500;
      // No cuenta como "silencio tras hablar" hasta que se detecta voz real al
      // menos una vez; si no, cortaríamos antes de que el usuario llegue a hablar.
      const maxWaitForSpeechMs = 8000;
      const startTime = performance.now();
      let hasSpoken = false;
      let lastSpeechTime = startTime;

      const tick = () => {
        analyser.getByteTimeDomainData(data);

        let sumSquares = 0;
        for (let i = 0; i < data.length; i += 1) {
          const normalized = (data[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / data.length);
        setMouthScale(0.2 + Math.min(1, rms * 6) * 0.9);

        const now = performance.now();
        if (rms > silenceThreshold) {
          hasSpoken = true;
          lastSpeechTime = now;
        } else if (hasSpoken && now - lastSpeechTime >= silenceLimitMs) {
          stopRecordingAndSend();
          return;
        } else if (!hasSpoken && now - startTime >= maxWaitForSpeechMs) {
          stopRecordingAndSend();
          return;
        }

        listeningRafRef.current = requestAnimationFrame(tick);
      };

      tick();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopRecordingAndSend is a hoisted function declaration, stable across renders
    [setMouthScale]
  );

  const releaseMicStream = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    stopListeningMonitor();
  }, [stopListeningMonitor]);

  const stopVoiceCapture = useCallback(() => {
    releaseMicStream();
    stopMouthLoop();

    if (voiceReplyAudioRef.current) {
      voiceReplyAudioRef.current.pause();
    }
  }, [releaseMicStream, stopMouthLoop]);

  function openTextChat() {
    if (statusRef.current === "listening") {
      stopVoiceCapture();
      setStatus("idle");
    }
    ensureConversation("text");
  }

  function ensureConversation(nextMode: ConversationMode, expand = true) {
    let currentConversationId = conversationIdRef.current;

    if (!currentConversationId) {
      currentConversationId = nextId("conversation");
      conversationIdRef.current = currentConversationId;
    }

    setMode(nextMode);
    if (expand) setIsExpanded(true);
    setError(null);

    return currentConversationId;
  }

  function handleRobotClick() {
    if (statusRef.current === "sending" || statusRef.current === "replying") return;
    if (statusRef.current === "listening") {
      stopRecordingAndSend();
      return;
    }

    ensureConversation("voice", false);
    void startRecording();
  }

  function toggleVoiceMode() {
    if (mode === "voice") {
      muteVoiceMode();
      return;
    }

    ensureConversation("voice");
    void startRecording();
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

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Este navegador no permite acceder al micrófono.");
      return;
    }

    try {
      releaseMicStream();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      startListeningMonitor(stream);

      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void sendRecordedAudio(recorder.mimeType);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      setStatus("listening");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No se ha podido acceder al micrófono.");
    }
  }

  function stopRecordingAndSend() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    stopListeningMonitor();
    setStatus("sending");
    recorder.stop();
  }

  async function sendRecordedAudio(mimeType: string) {
    const chunks = recordedChunksRef.current;
    recordedChunksRef.current = [];
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;

    const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
    if (blob.size === 0) {
      setStatus("idle");
      return;
    }

    const currentConversationId = conversationIdRef.current || ensureConversation("voice");
    setStatus("sending");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("type", "audio");
      formData.append("audio", blob, "recording.webm");
      formData.append("conversationId", currentConversationId);
      formData.append("source", "student-assistant-widget");
      if (courseContext) formData.append("courseContext", JSON.stringify(courseContext));

      const response = await fetch("/api/assistant", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        let message = "No se ha podido contactar con el asistente.";
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson.error) message = errJson.error;
        } catch {
          // respuesta vacía o no-JSON, usar mensaje por defecto
        }
        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.startsWith("audio/")) {
        const audioBlob = await response.blob();
        const transcript = response.headers.get("x-assistant-text") ?? "";
        playAssistantAudioReply(audioBlob, transcript);
      } else {
        const data = (await response.json()) as { reply?: string; error?: string };
        if (data.error) throw new Error(data.error);
        appendMessage("assistant", data.reply ?? "El asistente no ha devuelto contenido.");
        setStatus("idle");
      }
    } catch (requestError) {
      setStatus("error");
      setError(requestError instanceof Error ? requestError.message : "Error enviando el audio.");
    }
  }

  function playAssistantAudioReply(blob: Blob, transcript: string) {
    const audioEl = voiceReplyAudioRef.current;
    if (!audioEl) {
      setStatus("idle");
      return;
    }

    if (replyObjectUrlRef.current) URL.revokeObjectURL(replyObjectUrlRef.current);
    const url = URL.createObjectURL(blob);
    replyObjectUrlRef.current = url;

    ensureMouthAnalyserGraph(audioEl);
    appendMessage("assistant", transcript.trim() || "🔊", url);

    audioEl.src = url;
    setStatus("replying");

    void audioEl.play().catch(() => {
      setStatus("idle");
    });
  }

  function handleReplyPlaybackEnded() {
    stopMouthLoop();
    if (statusRef.current === "replying") setStatus("idle");
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
      if (replyObjectUrlRef.current) URL.revokeObjectURL(replyObjectUrlRef.current);
      void mouthAudioContextRef.current?.close();
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

  const robotBadgeLabel =
    status === "listening"
      ? "Listening…"
      : status === "sending"
        ? "Sending…"
        : status === "replying"
          ? "Replying…"
          : status === "error"
            ? "Error"
            : "";

  const robotAriaLabel = status === "listening" ? "Detener y enviar al asistente" : "Hablar con el asistente";

  const replyAudioElement = (
    <audio
      ref={voiceReplyAudioRef}
      hidden
      onPlay={startMouthLoop}
      onPause={handleReplyPlaybackEnded}
      onEnded={handleReplyPlaybackEnded}
    />
  );

  const voiceMicLabel =
    status === "listening" ? "Detener grabación y enviar" : status === "sending" || status === "replying" ? "Procesando" : "Grabar mensaje";

  const voiceStatusText =
    status === "sending"
      ? "Sending"
      : status === "replying"
        ? "Speaking"
        : status === "listening"
          ? "Listening"
          : status === "error"
            ? "Error"
            : "Tap to talk";

  const panelContent =
    mode === "voice" ? (
      <div className="assistant-voice-interface">
        {variant === "floating" && (
          <button
            aria-label="Cerrar asistente de voz"
            className="assistant-voice-back"
            type="button"
            onClick={() => setIsExpanded(false)}
          >
            <X size={22} />
          </button>
        )}

        <div className="assistant-voice-orb" aria-hidden="true">
          <span className="assistant-bot-head assistant-bot-head--lg">
            <span className="assistant-bot-visor">
              <span className="assistant-bot-eye" />
              <span className="assistant-bot-eye" />
            </span>
            <span className="assistant-bot-mouth-socket">
              <span ref={orbMouthRef} className="assistant-bot-mouth-bar" />
            </span>
          </span>
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
            aria-label={voiceMicLabel}
            className="assistant-voice-mic"
            type="button"
            disabled={status === "sending" || status === "replying"}
            onClick={status === "listening" ? stopRecordingAndSend : () => void startRecording()}
          >
            <Mic size={32} />
          </button>
          <div className="assistant-voice-status">{voiceStatusText}</div>
        </div>
      </div>
    ) : (
      <>
        <header className="assistant-chat-header">
          <span className="assistant-chat-status">{statusLabel}</span>
          {variant === "floating" && (
            <button
              aria-label="Cerrar panel del asistente"
              className="assistant-chat-close"
              type="button"
              onClick={() => setIsExpanded(false)}
            >
              <X size={18} />
            </button>
          )}
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
    );

  if (variant === "page") {
    return (
      <section
        aria-label="Asistente IA"
        className={cn(
          "assistant-chat-panel assistant-chat-panel-page",
          mode === "voice" && "assistant-chat-panel-voice"
        )}
      >
        {replyAudioElement}
        {panelContent}
      </section>
    );
  }

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
          {panelContent}
        </section>
      ) : null}

      {replyAudioElement}

      <div className="flex items-end gap-3">
        <button
          aria-label="Abrir chat de texto con el asistente"
          className="assistant-chat-toggle"
          type="button"
          onClick={openTextChat}
        >
          <MessageCircle size={22} />
        </button>

        <button
          aria-label={robotAriaLabel}
          title={error ?? undefined}
          className={cn(
            "assistant-robot group relative h-28 w-28 border-0 bg-transparent p-0",
            isExpanded && "assistant-robot-active",
            status === "listening" && "assistant-robot-listening",
            status === "sending" && "assistant-robot-sending",
            status === "replying" && "assistant-robot-replying"
          )}
          type="button"
          onClick={handleRobotClick}
        >
          {!isExpanded && robotBadgeLabel ? (
            <span className="assistant-robot-badge">{robotBadgeLabel}</span>
          ) : null}
          <span className="assistant-bot-head assistant-bot-head--sm">
            <span className="assistant-bot-visor">
              <span className="assistant-bot-eye" />
              <span className="assistant-bot-eye" />
            </span>
            <span className="assistant-bot-mouth-socket">
              <span ref={buttonMouthRef} className="assistant-bot-mouth-bar" />
            </span>
          </span>
          <span className="assistant-shadow" />
        </button>
      </div>
    </div>
  );
}
