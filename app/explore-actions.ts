"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Caps to keep this public, unauthenticated endpoint from being used for DB spam.
const MAX_NAME = 120;
const MAX_CONTACT = 160;
const MAX_SECTOR = 500;

export async function submitCourseRequest(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, MAX_CONTACT);
  const sector = String(formData.get("sector") ?? "").trim().slice(0, MAX_SECTOR);

  if (!name || !contact || !sector) {
    redirect("/?error=missing-fields#no-encuentras");
  }

  const admin = createSupabaseAdminClient();
  await admin.from("course_requests").insert({ name, contact, sector });

  redirect("/?success=course-request#no-encuentras");
}
