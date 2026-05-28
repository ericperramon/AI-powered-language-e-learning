"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Eye, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { registerCompany, registerEmployee } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AccountMode = "company" | "employee";
type ViewMode = "signin" | "onboarding" | AccountMode;

const accountHelp: Record<AccountMode, string> = {
  company: "Create a company account to purchase courses, buy seats and generate access keys for employees.",
  employee: "Create a student account to take training your company has already purchased with an access key."
};

function getAuthErrorMessage(error: string | null) {
  if (!error) {
    return "";
  }

  if (error === "email-exists") {
    return "An account with this email already exists. Sign in.";
  }

  return "Check the details and try again.";
}

export function AuthPanel() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode");
  const [view, setView] = useState<ViewMode>(
    initialMode === "company" || initialMode === "employee" ? initialMode : "signin"
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleLogin(formData: FormData) {
    setError("");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Check the details and try again.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function chooseAccount(mode: AccountMode) {
    setView(mode);
    setError("");
  }

  function chooseSignIn() {
    setView("signin");
    setError("");
  }

  return (
    <section className="grid min-h-screen bg-[var(--surface-container-lowest)] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex min-h-[520px] flex-col items-center bg-[var(--primary)] px-6 py-8 text-[var(--on-primary)] sm:px-10 lg:h-screen lg:overflow-hidden lg:px-12 lg:py-10">
        <div className="flex shrink-0 items-center justify-center gap-3">
          <span className="font-display text-xl font-bold text-white">GlossaAI</span>
        </div>
        <div className="mt-6 min-h-0 w-full flex-1 overflow-hidden rounded-2xl bg-[#070a16] shadow-2xl shadow-black/40">
          <Image
            alt="AI language learning network"
            className="h-full w-full object-cover object-center"
            height={600}
            priority
            src="/images/language-network.svg"
            width={920}
          />
        </div>

        <div className="mt-6 w-full shrink-0 text-center">
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            Your Personal Language Teacher.
          </h1>
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            Available 24/7.
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            AI-driven conversations and adaptive lesson paths, designed for real fluency.
          </p>

          <ul className="mt-4 space-y-2">
            {[
              "Personalized AI tutor available round the clock",
              "Adaptive lessons that fit your pace and level",
              "Track progress with structured courses and tests"
            ].map((feature) => (
              <li key={feature} className="flex items-center justify-center gap-2.5 text-sm text-white/85">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <div className="flex justify-center">
            <Button
              className="mt-6 h-11 rounded-full bg-white/20 px-6 text-sm font-semibold text-white hover:bg-white/30"
              onClick={() => setView("onboarding")}
              type="button"
            >
              Get started free
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[440px]">
          {searchParams.get("error") || error ? (
            <div className="mb-7 rounded-lg border border-[var(--error-container)] bg-[var(--error-container)] px-4 py-3 text-sm text-[var(--on-error-container)]">
              {error || getAuthErrorMessage(searchParams.get("error"))}
            </div>
          ) : null}

          {view === "signin" ? (
            <div>
              <h2 className="font-display text-4xl font-bold leading-tight text-[var(--on-surface)]">Welcome Back</h2>
              <p className="mt-3 text-lg leading-7 text-[var(--on-surface-variant)]">
                Continue your learning journey today.
              </p>
              <form
                action={(formData) => startTransition(() => void handleLogin(formData))}
                className="mt-10 space-y-5"
              >
                <Field icon={Mail} label="Email Address" name="email" type="email" placeholder="name@example.com" />
                <Field
                  actionLabel="Forgot Password?"
                  icon={LockKeyhole}
                  label="Password"
                  name="password"
                  placeholder="••••••••"
                  rightIcon={Eye}
                  type="password"
                />
                <label className="flex w-fit items-center gap-3 text-sm font-medium text-[var(--on-surface-variant)]">
                  <input
                    className="h-4 w-4 rounded border border-[var(--outline-variant)] accent-[var(--primary)]"
                    name="remember"
                    type="checkbox"
                  />
                  Remember me for 30 days
                </label>
                <Button
                  className="h-12 w-full rounded-lg shadow-[0_10px_30px_rgba(109,105,219,0.12)]"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? <Loader2 className="animate-spin" size={18} /> : null}
                  Sign in
                </Button>
                <div className="pt-7">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-[var(--outline-variant)]" />
                    <p className="bg-[var(--surface-container-lowest)] px-3 text-xs font-semibold tracking-wide text-[var(--outline)]">
                      OR CONTINUE WITH
                    </p>
                    <div className="h-px flex-1 bg-[var(--outline-variant)]" />
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <SocialButton brand="Google" logo="google" />
                    <SocialButton brand="Apple" logo="apple" />
                  </div>
                </div>
                <div className="pt-6 text-center text-sm leading-6 text-[var(--on-surface-variant)]">
                  <p>
                    Don&apos;t have an account?{" "}
                    <button
                      className="font-semibold text-[var(--primary)] transition hover:text-[var(--primary-container)]"
                      onClick={() => setView("onboarding")}
                      type="button"
                    >
                      Sign Up
                    </button>
                  </p>
                  <p>
                    Need business account?{" "}
                    <button
                      className="font-semibold text-[var(--primary)] transition hover:text-[var(--primary-container)]"
                      onClick={() => chooseAccount("company")}
                      type="button"
                    >
                      Create one
                    </button>
                  </p>
                </div>
              </form>
            </div>
          ) : null}

          {view === "onboarding" ? (
            <div>
              <AuthBackButton onClick={chooseSignIn} />
              <h2 className="font-display text-3xl font-bold text-[var(--on-surface)]">Create account</h2>
              <p className="mt-3 text-base leading-7 text-[var(--on-surface-variant)]">
                Choose the account type you need.
              </p>
              <div className="mt-7 grid gap-3">
                <OnboardingChoice
                  description="I want to take training provided by my company and I have or will receive an access key."
                  icon={UserRound}
                  label="I am a student"
                  onClick={() => chooseAccount("employee")}
                />
                <OnboardingChoice
                  description="I want to purchase courses for my team, buy seats and generate employee keys."
                  icon={Building2}
                  label="I am a company"
                  onClick={() => chooseAccount("company")}
                />
              </div>
            </div>
          ) : null}

          {view === "company" ? (
            <RegisterBlock
              action={registerCompany}
              help={accountHelp.company}
              onBack={chooseSignIn}
              title="Create company account"
              submitLabel="Create company"
            >
              <Field label="Company name" name="companyName" placeholder="Acme Learning Ltd" />
              <Field label="Admin name" name="fullName" placeholder="Alex Ramos" />
              <Field label="Company email" name="email" type="email" placeholder="admin@company.com" />
              <Field label="Password" name="password" type="password" placeholder="Minimum 8 characters" />
            </RegisterBlock>
          ) : null}

          {view === "employee" ? (
            <RegisterBlock
              action={registerEmployee}
              help={accountHelp.employee}
              onBack={chooseSignIn}
              title="Create student account"
              submitLabel="Create student"
            >
              <Field label="Full name" name="fullName" placeholder="Laura Garcia" />
              <Field label="Email" name="email" type="email" placeholder="laura@company.com" />
              <Field label="Password" name="password" type="password" placeholder="Minimum 8 characters" />
            </RegisterBlock>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AuthBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="mb-7 text-sm font-semibold text-[var(--primary)] transition hover:text-[var(--primary-container)]"
      onClick={onClick}
      type="button"
    >
      Back to sign in
    </button>
  );
}

function OnboardingChoice({
  description,
  icon: Icon,
  label,
  onClick
}: {
  description: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex gap-4 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)]"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--on-primary)]">
        <Icon strokeWidth={1.5} size={20} />
      </span>
      <span>
        <span className="block text-base font-semibold text-[var(--on-surface)]">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--on-surface-variant)]">{description}</span>
      </span>
    </button>
  );
}

function RegisterBlock({
  action,
  children,
  help,
  onBack,
  submitLabel,
  title
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  help: string;
  onBack: () => void;
  submitLabel: string;
  title: string;
}) {
  return (
    <div>
      <AuthBackButton onClick={onBack} />
      <h2 className="font-display text-3xl font-bold text-[var(--on-surface)]">{title}</h2>
      <p className="mt-3 rounded-lg bg-[var(--primary-fixed)] px-4 py-3 text-sm leading-6 text-[var(--on-primary-fixed-variant)]">
        {help}
      </p>
      <form action={action} className="mt-7 space-y-5">
        {children}
        <Button className="h-12 w-full rounded-lg text-base" type="submit">
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}

function Field({
  actionLabel,
  icon: Icon,
  label,
  name,
  placeholder,
  rightIcon: RightIcon,
  type = "text"
}: {
  actionLabel?: string;
  icon?: React.ElementType;
  label: string;
  name: string;
  placeholder: string;
  rightIcon?: React.ElementType;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={name}>
          {label}
        </Label>
        {actionLabel ? (
          <button className="text-sm font-semibold text-[var(--primary)] transition hover:text-[var(--primary-container)]" type="button">
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="relative">
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--outline)]"
            strokeWidth={1.5}
            size={22}
          />
        ) : null}
        <Input
          className={cn(
            "h-12 px-4",
            Icon && "pl-12",
            RightIcon && "pr-12"
          )}
          id={name}
          name={name}
          placeholder={placeholder}
          required
          type={type}
        />
        {RightIcon ? (
          <RightIcon
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--outline)]"
            strokeWidth={1.5}
            size={22}
          />
        ) : null}
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 814 1000" width="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.5-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.3 127.4-297.5 253.4-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" fill="currentColor" />
    </svg>
  );
}

function SocialButton({ brand, logo }: { brand: string; logo: "google" | "apple" }) {
  return (
    <button
      className="flex h-12 items-center justify-center gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-sm font-semibold text-[var(--on-surface)] transition hover:border-[var(--primary-fixed-dim)] hover:bg-[var(--surface-container-low)]"
      type="button"
    >
      {logo === "google" ? <GoogleLogo /> : <AppleLogo />}
      {brand}
    </button>
  );
}
