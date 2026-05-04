import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
