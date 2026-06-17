"use client";

import { usePathname } from "next/navigation";
import { AiAssistant } from "@/components/ai-assistant";

export function AiAssistantMount() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard/assistant")) {
    return null;
  }

  return <AiAssistant />;
}
