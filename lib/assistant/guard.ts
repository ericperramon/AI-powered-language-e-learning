import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GuardFailure = { ok: false; status: number; error: string };
export type GuardSuccess = { ok: true; userId: string };
export type GuardResult = GuardFailure | GuardSuccess;

// Best-effort, single-instance in-memory rate limiter.
// NOTE: this resets on redeploy and is not shared across serverless instances.
// For production, back this with Redis/Upstash. See IMPORTANT_FIXES.md.
export const WINDOW_MS = 60_000;
export const MAX_REQUESTS_PER_WINDOW = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns true when `userId` has exceeded MAX_REQUESTS_PER_WINDOW within WINDOW_MS.
 * `now` is injectable for deterministic testing.
 */
export function isRateLimited(userId: string, now: number = Date.now()): boolean {
  const entry = hits.get(userId);

  if (!entry || now > entry.resetAt) {
    hits.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

/**
 * Ensures the caller is an authenticated user and within rate limits.
 * Returns the authenticated user id on success, or a failure with an HTTP status.
 */
export async function guardAssistantRequest(): Promise<GuardResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  if (isRateLimited(user.id)) {
    return { ok: false, status: 429, error: "Too many requests. Please wait a moment and try again." };
  }

  return { ok: true, userId: user.id };
}
