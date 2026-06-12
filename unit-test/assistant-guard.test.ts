import { describe, expect, it } from "vitest";
import { isRateLimited, MAX_REQUESTS_PER_WINDOW, WINDOW_MS } from "@/lib/assistant/guard";

describe("assistant rate limiter", () => {
  it("allows requests up to the per-window limit", () => {
    const user = "user-allow";
    const start = 1_000;

    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      expect(isRateLimited(user, start)).toBe(false);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const user = "user-block";
    const start = 1_000;

    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
      isRateLimited(user, start);
    }

    expect(isRateLimited(user, start)).toBe(true);
  });

  it("resets the window once it has elapsed", () => {
    const user = "user-reset";
    const start = 1_000;

    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 5; i++) {
      isRateLimited(user, start);
    }
    expect(isRateLimited(user, start)).toBe(true);

    // After the window passes, the counter starts fresh.
    expect(isRateLimited(user, start + WINDOW_MS + 1)).toBe(false);
  });

  it("tracks users independently", () => {
    const start = 1_000;

    for (let i = 0; i < MAX_REQUESTS_PER_WINDOW + 1; i++) {
      isRateLimited("noisy-user", start);
    }

    // A different user is unaffected by the noisy one.
    expect(isRateLimited("quiet-user", start)).toBe(false);
  });
});
