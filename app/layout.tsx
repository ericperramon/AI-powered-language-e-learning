import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlossaAI Learning",
  description: "Plataforma e-learning B2B para aprendizaje de idiomas con IA"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
