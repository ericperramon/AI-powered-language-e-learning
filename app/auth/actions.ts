"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function upsertProfile(userId: string, values: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    ...values,
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function emailExists(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function isDuplicateUserError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("duplicate") ||
    normalized.includes("unique")
  );
}

async function signInCreatedUser(email: string, password: string, mode: "company" | "employee") {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`/auth?mode=signin&created=${mode}&error=${encodeURIComponent(error.message)}`);
  }
}

export async function registerCompany(formData: FormData) {
  const companyName = readText(formData, "companyName");
  const fullName = readText(formData, "fullName");
  const email = readText(formData, "email").toLowerCase();
  const password = readText(formData, "password");

  if (!companyName || !fullName || !email || password.length < 8) {
    redirect("/auth?mode=company&error=missing-fields");
  }

  if (await emailExists(email)) {
    redirect("/auth?mode=company&error=email-exists");
  }

  const supabase = createSupabaseAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      account_type: "company"
    }
  });

  if (authError || !authData.user) {
    if (isDuplicateUserError(authError?.message)) {
      redirect("/auth?mode=company&error=email-exists");
    }

    redirect(`/auth?mode=company&error=${encodeURIComponent(authError?.message ?? "auth-error")}`);
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: companyName,
      contact_email: email
    })
    .select("id")
    .single();

  if (companyError || !company) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    redirect(`/auth?mode=company&error=${encodeURIComponent(companyError?.message ?? "company-error")}`);
  }

  await upsertProfile(authData.user.id, {
    company_id: company.id,
    full_name: fullName,
    email,
    role: "admin",
    is_active: true
  });

  await signInCreatedUser(email, password, "company");
  redirect("/dashboard?success=account-created");
}

export async function registerEmployee(formData: FormData) {
  const fullName = readText(formData, "fullName");
  const email = readText(formData, "email").toLowerCase();
  const password = readText(formData, "password");

  if (!fullName || !email || password.length < 8) {
    redirect("/auth?mode=employee&error=missing-fields");
  }

  if (await emailExists(email)) {
    redirect("/auth?mode=employee&error=email-exists");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      account_type: "employee"
    }
  });

  if (error || !data.user) {
    if (isDuplicateUserError(error?.message)) {
      redirect("/auth?mode=employee&error=email-exists");
    }

    redirect(`/auth?mode=employee&error=${encodeURIComponent(error?.message ?? "auth-error")}`);
  }

  await upsertProfile(data.user.id, {
    full_name: fullName,
    email,
    role: "alumno",
    is_active: true
  });

  await signInCreatedUser(email, password, "employee");
  redirect("/dashboard?success=account-created");
}
