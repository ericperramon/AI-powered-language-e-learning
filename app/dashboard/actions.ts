"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function generateAccessCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function purchaseCourse(formData: FormData) {
  const courseId = readText(formData, "courseId");
  const licenses = Number(readText(formData, "licenses"));

  if (!courseId || !Number.isInteger(licenses) || licenses < 1 || licenses > 100) {
    redirect("/dashboard?error=invalid-purchase");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=signin");
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/dashboard?error=not-company-admin");
  }

  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("is_active", true)
    .single();

  if (courseError || !course) {
    redirect("/dashboard?error=course-not-found");
  }

  const { data: purchase, error: purchaseError } = await admin
    .from("company_course_packages")
    .insert({
      company_id: profile.company_id,
      course_id: courseId,
      purchased_licenses: licenses
    })
    .select("id, expires_at")
    .single();

  if (purchaseError || !purchase) {
    redirect(`/dashboard?error=${encodeURIComponent(purchaseError?.message ?? "purchase-error")}`);
  }

  const keys = Array.from({ length: licenses }, () => ({
    company_id: profile.company_id,
    course_id: courseId,
    package_id: purchase.id,
    code: generateAccessCode(),
    expires_at: purchase.expires_at,
    created_by: user.id
  }));

  const { error: keysError } = await admin.from("course_access_keys").insert(keys);

  if (keysError) {
    redirect(`/dashboard?error=${encodeURIComponent(keysError.message)}`);
  }

  redirect("/dashboard?success=purchase-created");
}

export async function redeemAccessKey(formData: FormData) {
  const code = readText(formData, "code").toUpperCase();

  if (!code) {
    redirect("/dashboard?error=missing-key");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("redeem_course_key", { p_code: code });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard?success=key-redeemed");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
