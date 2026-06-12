"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function submitCourseRequest(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();

  if (!name || !contact || !sector) {
    redirect("/?error=missing-fields#no-encuentras");
  }

  const admin = createSupabaseAdminClient();
  await admin.from("course_requests").insert({ name, contact, sector });

  redirect("/?success=course-request#no-encuentras");
}
