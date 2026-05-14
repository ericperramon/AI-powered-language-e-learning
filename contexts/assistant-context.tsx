"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { AssistantCourseContext } from "@/lib/assistant/system-prompt";

type AssistantContextValue = {
  courseContext: AssistantCourseContext;
  setCourseContext: (ctx: AssistantCourseContext) => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantContextProvider({ children }: { children: ReactNode }) {
  const [courseContext, setCourseContext] = useState<AssistantCourseContext>(null);
  return (
    <AssistantContext.Provider value={{ courseContext, setCourseContext }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistantContext(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistantContext must be inside AssistantContextProvider");
  return ctx;
}
