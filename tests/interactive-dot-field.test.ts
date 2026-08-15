import { describe, expect, it } from "vitest";

import {
  TECHNICAL_TERM_SETS,
  TECH_STACK_TERMS,
  selectTechnicalTerms,
} from "../components/interactive-dot-field";

describe("selectTechnicalTerms", () => {
  it("maps one random value to a stable twelve-term set", () => {
    expect(selectTechnicalTerms(0)).toBe(TECHNICAL_TERM_SETS[0]);
    expect(selectTechnicalTerms(0.26)).toBe(TECHNICAL_TERM_SETS[1]);
    expect(selectTechnicalTerms(0.51)).toBe(TECHNICAL_TERM_SETS[2]);
    expect(selectTechnicalTerms(0.99)).toBe(TECHNICAL_TERM_SETS[3]);
  });

  it("keeps invalid or out-of-range values within a valid set", () => {
    expect(selectTechnicalTerms(-1)).toBe(TECHNICAL_TERM_SETS[0]);
    expect(selectTechnicalTerms(Number.NaN)).toBe(TECHNICAL_TERM_SETS[0]);
    expect(selectTechnicalTerms(1)).toBe(TECHNICAL_TERM_SETS[3]);
    expect(TECHNICAL_TERM_SETS.every((terms) => terms.length === 12)).toBe(true);
  });

  it("keeps the tech-stack terms unique and non-empty", () => {
    expect(TECH_STACK_TERMS.length).toBeGreaterThan(0);
    expect(new Set(TECH_STACK_TERMS).size).toBe(TECH_STACK_TERMS.length);
  });
});
