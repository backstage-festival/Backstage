import { normalizeText } from "../textRules";

describe("normalizeText", () => {
  it("trims whitespace", () => {
    expect(normalizeText("  Namiot  ", 40)).toBe("Namiot");
  });

  it("accepts text exactly at the limit and rejects one character more", () => {
    expect(normalizeText("a".repeat(5), 5)).toBe("aaaaa");
    expect(normalizeText("a".repeat(6), 5)).toBeNull();
  });

  it("counts an emoji as a single character", () => {
    expect(normalizeText("🎸🎸🎸", 3)).toBe("🎸🎸🎸");
  });

  it.each(["", "   ", "\n\t"])("rejects empty text %p", (value) => {
    expect(normalizeText(value, 40)).toBeNull();
  });
});
