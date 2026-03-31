import { describe, it, expect } from "vitest";
import { categorizeError, handleApiError } from "@/lib/handleApiError";
import { TokenBucket, withThrottle } from "@/lib/throttle";

describe("categorizeError", () => {
  it("categorizes JWT errors as auth", () => {
    const result = categorizeError(new Error("JWT expired"));
    expect(result.category).toBe("auth");
  });

  it("categorizes RLS errors as permission", () => {
    const result = categorizeError(new Error("new row violates row-level security"));
    expect(result.category).toBe("permission");
  });

  it("categorizes duplicate key as conflict", () => {
    const result = categorizeError(new Error("duplicate key value violates"));
    expect(result.category).toBe("conflict");
  });

  it("categorizes network errors", () => {
    const result = categorizeError(new Error("Failed to fetch"));
    expect(result.category).toBe("network");
  });

  it("categorizes UUID errors as validation", () => {
    const result = categorizeError(new Error("invalid input syntax for type uuid"));
    expect(result.category).toBe("validation");
  });

  it("categorizes unknown errors", () => {
    const result = categorizeError(new Error("something random"));
    expect(result.category).toBe("unknown");
  });
});

describe("TokenBucket", () => {
  it("allows consumption when tokens available", () => {
    const bucket = new TokenBucket(5, 1);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
  });

  it("denies consumption when depleted", () => {
    const bucket = new TokenBucket(2, 0);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });

  it("reports remaining tokens", () => {
    const bucket = new TokenBucket(5, 0);
    bucket.tryConsume();
    bucket.tryConsume();
    expect(bucket.remaining).toBe(3);
  });
});

describe("withThrottle", () => {
  it("wraps async function with throttle", async () => {
    const bucket = new TokenBucket(1, 0);
    const fn = withThrottle(async () => "ok", bucket);
    expect(await fn()).toBe("ok");
    await expect(fn()).rejects.toThrow("Too many requests");
  });
});
