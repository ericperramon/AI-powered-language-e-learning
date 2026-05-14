"use client";

import { useEffect } from "react";
import { useAssistantContext } from "@/contexts/assistant-context";
import type { AssistantCourseContext } from "@/lib/assistant/system-prompt";

export function AssistantContextSetter({
  courseContext,
}: {
  courseContext: AssistantCourseContext;
}) {
  const { setCourseContext } = useAssistantContext();

  useEffect(() => {
    setCourseContext(courseContext);
    return () => setCourseContext(null);
  }, [courseContext, setCourseContext]);

  return null;
}
