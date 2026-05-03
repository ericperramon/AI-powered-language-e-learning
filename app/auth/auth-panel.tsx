"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Loader2, LogIn, UserRound } from "lucide-react";
import { registerCompany, registerEmployee } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AccountMode = "company" | "employee";
type ViewMode = "signin" | "onboarding" | AccountMode;
type TabMode = "signin" | AccountMode;

const accountHelp: Record<AccountMode, string> = {
  company: "Vas a crear una cuenta de empresa para contratar cursos, comprar plazas y generar claves de acceso para empleados.",
  employee: "Vas a crear una cuenta de empleado para cursar una formación que tu empresa ya ha contratado mediante una clave."
};

function getAuthErrorMessage(error: string | null) {
  if (!error) {
    return "";
  }

  if (error === "email-exists") {
    return "Ya existe una cuenta con este email. Inicia sesión.";
  }

  return "Revisa los datos introducidos y vuelve a intentarlo.";
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
      setError("Revisa los datos introducidos y vuelve a intentarlo.");
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
    <section className="w-full max-w-[580px]">
      <div className="mx-auto text-center">
        <p className="text-5xl font-medium tracking-normal text-slate-950 sm:text-6xl">GlossaAI</p>
        <h1 className="mt-8 text-4xl font-normal tracking-normal text-slate-950 sm:text-5xl">
          Domina cualquier idioma con un profesor 24/7
        </h1>
      </div>

      <div className="mx-auto mt-12 grid max-w-[520px] grid-cols-3 rounded-md bg-slate-100 p-1">
        <AccountButton
          currentMode={view}
          icon={Building2}
          label="Empresa"
          mode="company"
          onClick={() => chooseAccount("company")}
        />
        <AccountButton
          currentMode={view}
          icon={UserRound}
          label="Empleado"
          mode="employee"
          onClick={() => chooseAccount("employee")}
        />
        <AccountButton
          currentMode={view}
          icon={LogIn}
          label="Iniciar sesión"
          mode="signin"
          onClick={() => chooseSignIn()}
        />
      </div>

      <div className="mt-10">
        {searchParams.get("error") || error ? (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error || getAuthErrorMessage(searchParams.get("error"))}
          </div>
        ) : null}

        {view === "signin" ? (
          <div>
            <h2 className="text-3xl font-semibold text-slate-950">Iniciar sesión</h2>
            <form
              action={(formData) => startTransition(() => void handleLogin(formData))}
              className="mt-7 space-y-5"
            >
              <Field label="Email" name="email" type="email" placeholder="tu@email.com" />
              <Field label="Contraseña" name="password" type="password" placeholder="Tu contraseña" />
              <Button className="h-12 w-full text-base" disabled={isPending} type="submit">
                {isPending ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
                Entrar
              </Button>
              <Button
                className="h-12 w-full border-slate-950 text-base"
                onClick={() => setView("onboarding")}
                type="button"
                variant="secondary"
              >
                Crear cuenta
              </Button>
            </form>
          </div>
        ) : null}

        {view === "onboarding" ? (
          <div>
            <h2 className="text-3xl font-semibold text-slate-950">Crear cuenta</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Elige qué necesitas hacer ahora para crear el tipo de cuenta correcto.
            </p>
            <div className="mt-7 grid gap-3">
              <OnboardingChoice
                description="Quiero cursar una formación proporcionada por mi empresa y tengo o recibiré una clave de acceso."
                icon={UserRound}
                label="Soy empleado"
                onClick={() => chooseAccount("employee")}
              />
              <OnboardingChoice
                description="Quiero contratar cursos para mi equipo, comprar plazas y generar claves para empleados."
                icon={Building2}
                label="Soy empresa"
                onClick={() => chooseAccount("company")}
              />
            </div>
            <Button className="mt-5 h-11 w-full" onClick={() => setView("signin")} type="button" variant="ghost">
              Volver a iniciar sesión
            </Button>
          </div>
        ) : null}

        {view === "company" ? (
          <RegisterBlock
            action={registerCompany}
            help={accountHelp.company}
            title="Crear cuenta de empresa"
            submitLabel="Crear empresa"
          >
            <Field label="Nombre de la empresa" name="companyName" placeholder="Acme Learning SL" />
            <Field label="Nombre del administrador" name="fullName" placeholder="Pepe Ramos" />
            <Field label="Email corporativo" name="email" type="email" placeholder="admin@empresa.com" />
            <Field label="Contraseña" name="password" type="password" placeholder="Mínimo 8 caracteres" />
          </RegisterBlock>
        ) : null}

        {view === "employee" ? (
          <RegisterBlock
            action={registerEmployee}
            help={accountHelp.employee}
            title="Crear cuenta de empleado"
            submitLabel="Crear empleado"
          >
            <Field label="Nombre completo" name="fullName" placeholder="Laura García" />
            <Field label="Email" name="email" type="email" placeholder="laura@empresa.com" />
            <Field label="Contraseña" name="password" type="password" placeholder="Mínimo 8 caracteres" />
          </RegisterBlock>
        ) : null}
      </div>
    </section>
  );
}

function AccountButton({
  currentMode,
  icon: Icon,
  label,
  mode,
  onClick
}: {
  currentMode: ViewMode;
  icon: React.ElementType;
  label: string;
  mode: TabMode;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-12 items-center justify-center gap-3 rounded-md text-base font-medium text-slate-600 transition",
        currentMode === mode && "bg-white text-slate-950 shadow-sm"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon size={19} />
      {label}
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
      className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
        <Icon size={18} />
      </span>
      <span>
        <span className="block font-semibold text-slate-950">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span>
      </span>
    </button>
  );
}

function RegisterBlock({
  action,
  children,
  help,
  submitLabel,
  title
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  help: string;
  submitLabel: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-3xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 rounded-md bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700">{help}</p>
      <form action={action} className="mt-6 space-y-5">
        {children}
        <Button className="h-12 w-full text-base" type="submit">
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text"
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input className="h-12 text-base" id={name} name={name} placeholder={placeholder} required type={type} />
    </div>
  );
}
