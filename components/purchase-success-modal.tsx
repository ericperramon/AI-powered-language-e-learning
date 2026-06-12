"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail, X } from "lucide-react";

export function PurchaseSuccessModal({
  keys,
  courseTitle,
  onClose,
}: {
  keys: string[];
  courseTitle: string;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function copyAll() {
    const text = keys.join("\n");
    await navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  function shareByEmail(key: string) {
    const subject = encodeURIComponent(`Your access key for ${courseTitle}`);
    const body = encodeURIComponent(
      `Hi,\n\nHere is your personal access key to enroll in "${courseTitle}":\n\n${key}\n\nTo redeem it, sign in to your student dashboard and enter the key in the "Access Key" section.\n\nBest regards`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "bg-black/40 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-[var(--surface-container-lowest)] shadow-2xl transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] px-8 pb-6 pt-8">
          <div
            className={`transition-all delay-100 duration-500 ${
              visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <p className="text-sm font-semibold uppercase tracking-wider text-white/70">Keys generated</p>
            <h2 className="mt-1 text-2xl font-bold text-white">
              {keys.length} key{keys.length !== 1 ? "s" : ""} ready to share
            </h2>
            <p className="mt-1 text-sm text-white/75">{courseTitle}</p>
          </div>
        </div>

        {/* Key list */}
        <div
          className={`flex-1 overflow-y-auto px-6 py-4 transition-all delay-200 duration-500 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
          style={{ maxHeight: "320px" }}
        >
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3"
              >
                <code className="flex-1 font-mono text-sm font-semibold tracking-wider text-[var(--on-surface)]">
                  {key}
                </code>
                <button
                  onClick={() => copyKey(key)}
                  title="Copy key"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    copiedKey === key
                      ? "bg-emerald-100 text-emerald-600"
                      : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  {copiedKey === key ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.5} />}
                </button>
                <button
                  onClick={() => shareByEmail(key)}
                  title="Share via email"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                >
                  <Mail size={15} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between gap-3 border-t border-[var(--outline-variant)] px-6 py-4 transition-all delay-300 duration-500 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <button
            onClick={copyAll}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
              allCopied
                ? "bg-emerald-100 text-emerald-700"
                : "bg-[var(--surface-container)] text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]"
            }`}
          >
            {allCopied ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.5} />}
            {allCopied ? "Copied!" : "Copy all keys"}
          </button>
          <button
            onClick={close}
            className="h-10 rounded-xl px-5 text-sm font-semibold text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)]"
          >
            Done
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
