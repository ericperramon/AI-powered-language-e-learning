import { Suspense } from "react";
import { AuthPanel } from "@/app/auth/auth-panel";

export default function AuthPage() {
  return (
    <main className="min-h-screen w-full bg-[var(--surface-container-lowest)]">
      <Suspense fallback={<div className="min-h-screen w-full bg-[var(--surface-container-lowest)]" />}>
        <AuthPanel />
      </Suspense>
    </main>
  );
}
