"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Apple, Building2, Eye, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
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
      <div className="flex min-h-[520px] flex-col items-center justify-center bg-[var(--primary)] px-6 py-10 text-center text-[var(--on-primary)] sm:px-10 lg:min-h-screen">
        <div className="w-full max-w-[620px]">
          <p className="font-display text-4xl font-bold sm:text-5xl">GlossaAI</p>
          <div className="mx-auto mt-8 overflow-hidden rounded-2xl bg-[#070a16] shadow-2xl shadow-black/25">
            <Image
              alt="AI language learning network"
              className="h-auto w-full"
              height={600}
              priority
              src="/images/language-network.svg"
              width={920}
            />
          </div>
          <h1 className="font-display mx-auto mt-8 max-w-[560px] text-3xl font-bold leading-tight sm:text-4xl">
            Your Personal Language Teacher. Available 24/7.
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-base leading-7 text-[rgba(255,255,255,0.7)] sm:text-lg">
            Join thousands of learners achieving fluency through personalized AI-driven conversations and adaptive
            lesson paths.
          </p>
          <p className="mt-2 text-base font-semibold text-[rgba(255,255,255,0.75)] sm:text-lg">
            Learn what you need, at your own pace.
          </p>
          <Button
            className="mt-8 h-12 rounded-full bg-[var(--primary-container)] px-7 text-base font-semibold text-[var(--on-primary-container)] hover:bg-[var(--inverse-primary)] hover:text-[var(--on-primary-fixed)]"
            onClick={() => setView("onboarding")}
            type="button"
          >
            Try your AI Tutor
          </Button>
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
                    <SocialButton brand="Google" mark="G" />
                    <SocialButton brand="Apple" icon={Apple} />
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

function SocialButton({ brand, icon: Icon, mark }: { brand: string; icon?: React.ElementType; mark?: string }) {
  return (
    <button
      className="flex h-12 items-center justify-center gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-sm font-semibold text-[var(--on-surface)] transition hover:border-[var(--primary-fixed-dim)] hover:bg-[var(--surface-container-low)]"
      type="button"
    >
      {Icon ? <Icon aria-hidden="true" className="text-[var(--on-surface)]" strokeWidth={1.5} size={20} /> : null}
      {mark ? (
        <span className={cn("text-lg font-semibold", brand === "Google" ? "text-[#4285f4]" : "text-[var(--on-surface)]")}>
          {mark}
        </span>
      ) : null}
      {brand}
    </button>
  );
}
