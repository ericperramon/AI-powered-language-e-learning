"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type BlankOption = { label: string; value: string };

type Blank = {
  id: string;
  options: BlankOption[];
};

type SentencePart = { type: "text"; content: string } | { type: "blank"; blankId: string };

function parseSentence(sentence: string, blanks: Blank[]): SentencePart[] {
  if (/\{\{[^}]+\}\}/.test(sentence)) {
    const parts: SentencePart[] = [];
    let lastIndex = 0;
    const regex = /\{\{([^}]+)\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(sentence)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: sentence.slice(lastIndex, match.index) });
      }
      parts.push({ type: "blank", blankId: match[1] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < sentence.length) {
      parts.push({ type: "text", content: sentence.slice(lastIndex) });
    }

    return parts;
  }

  // Fall back to sequential ___ placeholders
  const parts: SentencePart[] = [];
  const segments = sentence.split("___");

  segments.forEach((segment, i) => {
    if (segment) {
      parts.push({ type: "text", content: segment });
    }
    if (i < blanks.length) {
      parts.push({ type: "blank", blankId: blanks[i].id });
    }
  });

  return parts;
}

export function FillInBlanksExercise({
  exerciseId,
  sentence,
  blanks,
  previousAnswers
}: {
  exerciseId: string;
  sentence: string;
  blanks: Blank[];
  previousAnswers: Record<string, string>;
}) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(blanks.map((b) => [b.id, previousAnswers[b.id] ?? ""]))
  );
  const [openBlank, setOpenBlank] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenBlank(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const parts = parseSentence(sentence, blanks);
  const blankMap = Object.fromEntries(blanks.map((b) => [b.id, b]));

  return (
    <div ref={containerRef} className="mt-4">
      {blanks.map((blank) => (
        <input key={blank.id} name={`answer_${exerciseId}_${blank.id}`} type="hidden" value={selected[blank.id] ?? ""} />
      ))}

      <p className="text-base leading-10 text-[var(--on-surface)]">
        {parts.map((part, i) => {
          if (part.type === "text") {
            return <span key={i}>{part.content}</span>;
          }

          const blank = blankMap[part.blankId];
          if (!blank) return null;

          const selectedValue = selected[blank.id];
          const selectedLabel = blank.options.find((o) => o.value === selectedValue)?.label;
          const isOpen = openBlank === blank.id;

          return (
            <span className="relative inline-block align-baseline" key={i}>
              <button
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-sm font-medium transition-colors ${
                  selectedValue
                    ? "border-[var(--primary-container)] bg-[var(--primary-fixed)] text-[var(--on-primary-fixed-variant)] hover:bg-[var(--secondary-fixed)]"
                    : "border-dashed border-[var(--outline)] bg-[var(--surface-container-low)] text-[var(--outline)] hover:border-[var(--on-surface-variant)] hover:text-[var(--on-surface-variant)]"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setOpenBlank(isOpen ? null : blank.id);
                }}
                type="button"
              >
                {selectedLabel ?? "___"}
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} strokeWidth={1.5} />
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                  {blank.options.map((option) => (
                    <button
                      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-container-low)] ${
                        selected[blank.id] === option.value ? "bg-[var(--primary-fixed)] font-medium text-[var(--on-primary-fixed-variant)]" : "text-[var(--on-surface-variant)]"
                      }`}
                      key={option.value}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelected((prev) => ({ ...prev, [blank.id]: option.value }));
                        setOpenBlank(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </span>
          );
        })}
      </p>
    </div>
  );
}
