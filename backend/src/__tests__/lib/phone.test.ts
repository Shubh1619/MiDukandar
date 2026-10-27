import { nationalMobile, normalizeIndianMobile } from "../../lib/phone.js";

describe("normalizeIndianMobile", () => {
  it("accepts a bare 10-digit mobile number", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("+919876543210");
  });

  it("accepts +91 with spaces", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("+919876543210");
  });

  it("accepts a trunk-prefixed number", () => {
    expect(normalizeIndianMobile("09876543210")).toBe("+919876543210");
  });

  it("accepts a country-code number without plus", () => {
    expect(normalizeIndianMobile("919876543210")).toBe("+919876543210");
  });

  it("accepts 0091 international prefix", () => {
    expect(normalizeIndianMobile("0091-9876543210")).toBe("+919876543210");
  });

  it("accepts dashes and brackets", () => {
    expect(normalizeIndianMobile("(98765) 43210")).toBe("+919876543210");
  });

  it("accepts the 91-then-0 shape", () => {
    expect(normalizeIndianMobile("+91 (0) 98765 43210")).toBe("+919876543210");
  });

  it("accepts numbers starting 6", () => {
    expect(normalizeIndianMobile("6123456789")).toBe("+916123456789");
  });

  it.each(["", "   ", "abc", "1234567890", "987654321", "98765432101", "5876543210"])(
    "rejects invalid input %p",
    (value) => {
      expect(normalizeIndianMobile(value)).toBeNull();
    },
  );

  it("rejects null and undefined", () => {
    expect(normalizeIndianMobile(null)).toBeNull();
    expect(normalizeIndianMobile(undefined)).toBeNull();
  });
});

describe("nationalMobile", () => {
  it("strips the country code", () => {
    expect(nationalMobile("+919876543210")).toBe("9876543210");
  });
});
