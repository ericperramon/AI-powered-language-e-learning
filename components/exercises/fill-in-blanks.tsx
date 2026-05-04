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

      <p className="text-base leading-10 text-slate-800">
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
                    ? "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100"
                    : "border-dashed border-slate-400 bg-slate-50 text-slate-400 hover:border-slate-500 hover:text-slate-600"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setOpenBlank(isOpen ? null : blank.id);
                }}
                type="button"
              >
                {selectedLabel ?? "___"}
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md">
                  {blank.options.map((option) => (
                    <button
                      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                        selected[blank.id] === option.value ? "bg-orange-50 font-medium text-orange-700" : "text-slate-700"
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
