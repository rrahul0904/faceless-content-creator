import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./auth";

describe("session tokens", () => {
  it("round-trips a signed session", () => {
    process.env.DEMO_MODE = "true";
    const token = createSessionToken("test@example.com");
    expect(verifySessionToken(token)?.email).toBe("test@example.com");
  });
  it("rejects tampering", () => {
    process.env.DEMO_MODE = "true";
    const token = createSessionToken("test@example.com");
    expect(verifySessionToken(`${token}x`)).toBeNull();
  });
});
