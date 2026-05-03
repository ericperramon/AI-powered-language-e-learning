import { Suspense } from "react";
import { AuthPanel } from "@/app/auth/auth-panel";

export default function AuthPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-12">
      <Suspense fallback={<div className="h-[620px] w-full max-w-[580px]" />}>
        <AuthPanel />
      </Suspense>
    </main>
  );
}
