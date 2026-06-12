"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, X } from "lucide-react";

export function RedeemSuccessModal({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (show) {
      setMounted(true);
      // slight delay so the animation triggers after mount
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    }
  }, [show]);

  function close() {
    setVisible(false);
    setTimeout(() => {
      setMounted(false);
      router.replace("/dashboard");
    }, 300);
  }

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/40 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--surface-container-lowest)] shadow-2xl transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        {/* Top gradient band */}
        <div className="flex flex-col items-center bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] px-8 pb-8 pt-10">
          {/* Animated icon */}
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-white/20 shadow-lg transition-all delay-150 duration-500 ${
              visible ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <CheckCircle2 size={44} strokeWidth={1.5} className="text-white" />
          </div>
          <h2
            className={`mt-5 text-2xl font-bold text-white transition-all delay-200 duration-500 ${
              visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            Course unlocked!
          </h2>
          <p
            className={`mt-1.5 text-center text-sm leading-6 text-white/80 transition-all delay-300 duration-500 ${
              visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            Your key was redeemed successfully. Start learning right away.
          </p>
        </div>

        {/* Bottom section */}
        <div
          className={`flex flex-col gap-3 px-8 py-6 transition-all delay-300 duration-500 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <button
            onClick={() => {
              close();
              setTimeout(() => {
                document.getElementById("my-courses")?.scrollIntoView({ behavior: "smooth" });
              }, 350);
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--on-primary)] transition-colors hover:opacity-90"
          >
            <BookOpen size={16} strokeWidth={1.5} />
            View my courses
          </button>
          <button
            onClick={close}
            className="h-10 w-full rounded-xl text-sm font-medium text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)]"
          >
            Close
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={close}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
