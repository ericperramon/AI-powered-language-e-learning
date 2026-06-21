"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";
import type { LiveAvatarSession as LiveAvatarSessionType } from "@heygen/liveavatar-web-sdk";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "connecting" | "live" | "ended" | "error";

const KEEP_ALIVE_MS = 150_000; // 2.5 min (sesión expira a los 5 min)

export function SpeakingAvatar({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [userCaption, setUserCaption] = useState("");
  const [avatarCaption, setAvatarCaption] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<LiveAvatarSessionType | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      void session.stop().catch(() => {});
    }
  }, []);

  const endSession = useCallback(() => {
    cleanup();
    setPhase("ended");
    setUserCaption("");
    setAvatarCaption("");
  }, [cleanup]);

  // Tear down the session if the user navigates away.
  useEffect(() => cleanup, [cleanup]);

  const startSession = useCallback(async () => {
    setPhase("connecting");
    setError(null);
    setUserCaption("");
    setAvatarCaption("");

    try {
      const response = await fetch("/api/speaking/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, lessonId })
      });
      const data = (await response.json()) as { sessionToken?: string; error?: string };
      if (!response.ok || !data.sessionToken) {
        throw new Error(data.error ?? "No se pudo iniciar la sesión del avatar.");
      }

      // El SDK usa WebRTC/LiveKit: solo funciona en navegador, por eso el import dinámico.
      const { LiveAvatarSession, SessionEvent, AgentEventsEnum } = await import(
        "@heygen/liveavatar-web-sdk"
      );

      const session = new LiveAvatarSession(data.sessionToken, { voiceChat: false });
      sessionRef.current = session;

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) session.attach(videoRef.current);
      });
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        endSession();
      });
      session.on(AgentEventsEnum.SESSION_STOPPED, () => {
        endSession();
      });
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (payload: { text: string }) => {
        setUserCaption(payload.text);
      });
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (payload: { text: string }) => {
        setAvatarCaption(payload.text);
      });

      await session.start();
      await session.voiceChat.start();

      keepAliveRef.current = setInterval(() => {
        void session.keepAlive().catch(() => {});
      }, KEEP_ALIVE_MS);

      setMuted(false);
      setPhase("live");
    } catch (err) {
      cleanup();
      setPhase("error");
      setError(err instanceof Error ? err.message : "Error iniciando el avatar.");
    }
  }, [cleanup, courseId, endSession, lessonId]);

  const toggleMute = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      if (muted) {
        await session.voiceChat.unmute();
        setMuted(false);
      } else {
        await session.voiceChat.mute();
        setMuted(true);
      }
    } catch {
      // ignoramos fallos transitorios al alternar el micro
    }
  }, [muted]);

  return (
    <div>
      <p className="mb-5 text-sm leading-6 text-[var(--on-surface-variant)]">
        Practice speaking with a virtual avatar. Press <strong>Start</strong>, allow microphone access, and
        speak naturally: the avatar listens, responds, and corrects you.
      </p>

      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--r-xl)] border border-[var(--outline-variant)] bg-[var(--surface-container-high)]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full object-cover ${phase === "live" ? "" : "opacity-0"}`}
        />

        {phase !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
              <Sparkles size={26} strokeWidth={1.5} />
            </span>
            {phase === "idle" && (
              <p className="max-w-xs text-sm text-[var(--on-surface-variant)]">
                Your AI conversation partner is ready.
              </p>
            )}
            {phase === "connecting" && (
              <p className="text-sm font-medium text-[var(--on-surface-variant)]">Connecting to the avatar…</p>
            )}
            {phase === "ended" && (
              <p className="text-sm font-medium text-[var(--on-surface-variant)]">Session ended.</p>
            )}
            {phase === "error" && <p className="max-w-sm text-sm font-medium text-[var(--error)]">{error}</p>}

            <Button type="button" onClick={() => void startSession()} disabled={phase === "connecting"}>
              <Mic size={16} strokeWidth={1.5} />
              {phase === "connecting" ? "Connecting…" : phase === "idle" ? "Start conversation" : "Start again"}
            </Button>
          </div>
        )}

        {/* Live captions */}
        {phase === "live" && (avatarCaption || userCaption) && (
          <div className="absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm">
            {avatarCaption && <p className="font-medium text-white">{avatarCaption}</p>}
            {userCaption && <p className="text-white/80">You: {userCaption}</p>}
          </div>
        )}
      </div>

      {phase === "live" && (
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--outline-variant)] pt-6">
          <Button type="button" variant="secondary" onClick={toggleMute}>
            {muted ? <MicOff size={16} strokeWidth={1.5} /> : <Mic size={16} strokeWidth={1.5} />}
            {muted ? "Unmute" : "Mute"}
          </Button>
          <Button
            type="button"
            onClick={endSession}
            className="bg-[var(--error)] text-[var(--on-error,_#fff)] hover:opacity-90"
          >
            <PhoneOff size={16} strokeWidth={1.5} />
            End
          </Button>
        </div>
      )}
    </div>
  );
}
