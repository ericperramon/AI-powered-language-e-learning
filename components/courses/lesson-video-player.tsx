"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, MessageCircle, Play, X } from "lucide-react";
import { markVideoWatched } from "@/app/dashboard/courses/[courseId]/actions";
import { Button } from "@/components/ui/button";
import { getPlayableEmbedUrl, getVideoEmbedUrl } from "@/lib/video";

export function LessonVideoPlayer({
  courseId,
  unitId,
  lessonId,
  lessonType,
  videoUrl,
  title,
  nextLessonId,
  locked = false
}: {
  courseId: string;
  unitId: string;
  lessonId: string;
  lessonType: string;
  videoUrl: string | null;
  title: string;
  nextLessonId: string | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const embedUrl = getVideoEmbedUrl(videoUrl);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    setShowDialog(true);
    void markVideoWatched(courseId, unitId, lessonId, lessonType);
  }, [courseId, unitId, lessonId, lessonType]);

  useEffect(() => {
    if (!isPlaying) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.youtube.com" && event.origin !== "https://player.vimeo.com") {
        return;
      }

      let data: { event?: string; info?: unknown } | null = null;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      const isYoutubeEnded = data?.event === "onStateChange" && data.info === 0;
      // Vimeo's raw postMessage protocol calls the end-of-video event "finish",
      // not "ended" (that name only exists in the official player.js SDK).
      const isVimeoEnded = data?.event === "finish" || data?.event === "ended";

      if (isYoutubeEnded || isVimeoEnded) {
        handleVideoEnded();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isPlaying, handleVideoEnded]);

  function registerEndedListener() {
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow) return;
    contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
    contentWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "finish" }), "*");
    contentWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "ended" }), "*");
  }

  function handleIframeLoad() {
    registerEndedListener();
    // The Vimeo player can still be initializing its postMessage bridge right when
    // the iframe's `load` event fires, dropping the first registration. Retry once.
    setTimeout(registerEndedListener, 1000);
  }

  function goToExercises() {
    setShowDialog(false);
    const url = nextLessonId
      ? `/dashboard/courses/${courseId}/lessons/${nextLessonId}?stage=exercises`
      : `/dashboard/courses/${courseId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function goToTutor() {
    setShowDialog(false);
    router.push(`/dashboard/assistant?courseId=${courseId}&lessonId=${lessonId}`);
  }

  if (locked) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-low)] opacity-75">
        <Lock strokeWidth={1.5} size={28} className="text-[var(--outline)]" />
        <p className="text-sm text-[var(--outline)]">Complete the previous unit to unlock this video</p>
      </div>
    );
  }

  return (
    <div>
      {embedUrl ? (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-[var(--outline-variant)] bg-black"
        >
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_14px_36px_rgba(42,111,151,0.30)] transition-transform group-hover:scale-105">
            <Play size={24} strokeWidth={1.5} className="translate-x-0.5" />
          </span>
        </button>
      ) : (
        <figure className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-[var(--outline-variant)] bg-gradient-to-br from-[var(--surface-container-low)] via-[var(--surface-container)] to-[var(--surface-container-high)] p-6 text-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "linear-gradient(var(--outline-variant) 1px, transparent 1px), linear-gradient(90deg, var(--outline-variant) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at center, black 35%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 78%)"
            }}
          />
          <span className="ds-chip absolute left-4 top-4">Coming soon</span>
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_14px_36px_rgba(42,111,151,0.30)]">
            <Play size={24} strokeWidth={1.5} className="translate-x-0.5" />
          </span>
          <figcaption className="relative max-w-xs text-sm leading-6 text-[var(--on-surface-variant)]">
            Video pending. Once the content is added, the lesson video will appear here.
          </figcaption>
        </figure>
      )}

      {isPlaying && embedUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setIsPlaying(false)}
            aria-label="Close video"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={20} />
          </button>
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-md bg-black">
            <iframe
              ref={iframeRef}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
              src={getPlayableEmbedUrl(embedUrl, typeof window !== "undefined" ? window.location.origin : "")}
              title={title}
              onLoad={handleIframeLoad}
            />
          </div>
        </div>
      ) : null}

      {showDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowDialog(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[var(--surface-container-lowest)] p-6 text-center shadow-2xl"
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
              <MessageCircle size={22} strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-base font-semibold leading-6 text-[var(--on-surface)]">
              Do you want to resolve any doubts with your tutor or start the exercises?
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Button onClick={goToTutor} variant="secondary" type="button">
                Tutor IA
              </Button>
              <Button onClick={goToExercises} type="button">
                Exercises
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
