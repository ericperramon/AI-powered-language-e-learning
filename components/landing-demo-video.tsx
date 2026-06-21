"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";

export function LandingDemoVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handlePlay() {
    setIsPlaying(true);
    void videoRef.current?.play();
  }

  return (
    <figure className="group relative aspect-video w-full overflow-hidden rounded-[var(--r-xl)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
      <video
        ref={videoRef}
        src={src}
        controls={isPlaying}
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      >
        <track kind="captions" />
      </video>

      {!isPlaying && (
        <button
          type="button"
          aria-label="Reproducir vídeo de demostración de la plataforma"
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors duration-300 group-hover:bg-black/20"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_14px_36px_rgba(42,111,151,0.30)] transition-transform duration-300 group-hover:scale-105">
            <Play size={30} strokeWidth={1.5} className="translate-x-0.5" />
          </span>
        </button>
      )}
    </figure>
  );
}
