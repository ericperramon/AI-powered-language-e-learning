"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PurchaseState =
  | { status: "idle" }
  | { status: "success"; keys: string[]; courseTitle: string }
  | { status: "error"; message: string };

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function generateAccessCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function purchaseCourseAction(
  _prev: PurchaseState,
  formData: FormData
): Promise<PurchaseState> {
  const courseId = readText(formData, "courseId");
  const licenses = Number(readText(formData, "licenses"));

  if (!courseId || !Number.isInteger(licenses) || licenses < 1 || licenses > 100) {
    return { status: "error", message: "Invalid purchase data." };
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
    return { status: "error", message: "You must be a company admin to purchase courses." };
  }

  const { data: course, error: courseError } = await admin
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .eq("is_active", true)
    .single<{ id: string; title: string }>();

  if (courseError || !course) {
    return { status: "error", message: "Course not found or inactive." };
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
    return { status: "error", message: purchaseError?.message ?? "Purchase failed." };
  }

  const keyRows = Array.from({ length: licenses }, () => ({
    company_id: profile.company_id,
    course_id: courseId,
    package_id: purchase.id,
    code: generateAccessCode(),
    expires_at: purchase.expires_at,
    created_by: user.id
  }));

  const { error: keysError } = await admin.from("course_access_keys").insert(keyRows);

  if (keysError) {
    return { status: "error", message: keysError.message };
  }

  return {
    status: "success",
    keys: keyRows.map((k) => k.code),
    courseTitle: course.title
  };
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

export async function deleteEmployeeAccount(
  employeeId: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createSupabaseAdminClient();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single<{ company_id: string | null; role: string }>();

  if (!adminProfile || adminProfile.role !== "admin" || !adminProfile.company_id) {
    return { error: "Unauthorized." };
  }

  const { data: employeeProfile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", employeeId)
    .single<{ company_id: string | null }>();

  if (!employeeProfile || employeeProfile.company_id !== adminProfile.company_id) {
    return { error: "Employee not found in your company." };
  }

  const { error } = await admin.auth.admin.deleteUser(employeeId);
  if (error) return { error: error.message };

  return {};
}

export async function removeEmployeeEnrollment(
  employeeId: string,
  courseId: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createSupabaseAdminClient();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single<{ company_id: string | null; role: string }>();

  if (!adminProfile || adminProfile.role !== "admin" || !adminProfile.company_id) {
    return { error: "Unauthorized." };
  }

  const { data: employeeProfile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", employeeId)
    .single<{ company_id: string | null }>();

  if (!employeeProfile || employeeProfile.company_id !== adminProfile.company_id) {
    return { error: "Employee not found in your company." };
  }

  const { error } = await admin
    .from("enrollments")
    .delete()
    .eq("employee_id", employeeId)
    .eq("course_id", courseId);

  if (error) return { error: error.message };

  return {};
}

export async function assignEmployeeCourse(
  employeeId: string,
  courseId: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createSupabaseAdminClient();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single<{ company_id: string | null; role: string }>();

  if (!adminProfile || adminProfile.role !== "admin" || !adminProfile.company_id) {
    return { error: "Unauthorized." };
  }

  const { data: employeeProfile } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", employeeId)
    .single<{ company_id: string | null }>();

  if (!employeeProfile || employeeProfile.company_id !== adminProfile.company_id) {
    return { error: "Employee not found in your company." };
  }

  const { error } = await admin.from("enrollments").insert({
    employee_id: employeeId,
    company_id: adminProfile.company_id,
    course_id: courseId
  });

  if (error) return { error: error.message };

  return {};
}

export async function generateEmployeePasswordReset(
  employeeId: string
): Promise<{ link?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createSupabaseAdminClient();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single<{ company_id: string | null; role: string }>();

  if (!adminProfile || adminProfile.role !== "admin" || !adminProfile.company_id) {
    return { error: "Unauthorized." };
  }

  const { data: employeeProfile } = await admin
    .from("profiles")
    .select("email, company_id")
    .eq("id", employeeId)
    .single<{ email: string | null; company_id: string | null }>();

  if (!employeeProfile || employeeProfile.company_id !== adminProfile.company_id) {
    return { error: "Employee not found in your company." };
  }

  if (!employeeProfile.email) return { error: "Employee has no email address." };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: employeeProfile.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth?mode=update-password`
    }
  });

  if (error || !data?.properties?.action_link) {
    return { error: error?.message ?? "Failed to generate reset link." };
  }

  return { link: data.properties.action_link };
}
