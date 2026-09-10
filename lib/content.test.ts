import { describe, expect, it } from "vitest";
import { demoIdea, normalizeIdea } from "./content";

describe("content normalization", () => {
  it("creates a complete demo idea", () => {
    const idea = demoIdea("AI");
    expect(idea.hook.length).toBeGreaterThan(10);
    expect(idea.score).toBeGreaterThanOrEqual(0);
    expect(idea.hashtags.length).toBeGreaterThanOrEqual(4);
  });
  it("clamps generated scores", () => {
    expect(normalizeIdea({ score: 400 }, "science").score).toBe(100);
    expect(normalizeIdea({ score: -5 }, "science").score).toBe(0);
  });
});
