import type { Metadata } from "next";
import { AiAssistant } from "@/components/ai-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlossaAI Learning",
  description: "B2B e-learning platform for AI-powered language learning"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AiAssistant />
      </body>
    </html>
  );
}
