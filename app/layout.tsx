import type { Metadata } from "next";
import { AssistantContextProvider } from "@/contexts/assistant-context";
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
        <AssistantContextProvider>
          {children}
        </AssistantContextProvider>
      </body>
    </html>
  );
}
