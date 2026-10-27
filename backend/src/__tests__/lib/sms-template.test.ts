import {
  formatSmsAmount,
  renderUdhaariCreatedSms,
  smsSegments,
  UDHAARI_TEMPLATE_BODY,
} from "../../lib/sms-template.js";

describe("formatSmsAmount", () => {
  it("drops a zero paise fraction", () => {
    expect(formatSmsAmount(1250)).toBe("1250");
  });

  it("keeps two decimals for paise", () => {
    expect(formatSmsAmount(1250.5)).toBe("1250.50");
  });

  it("rounds to 2 dp", () => {
    expect(formatSmsAmount("10.555")).toBe("10.56");
  });
});

describe("renderUdhaariCreatedSms", () => {
  const content = renderUdhaariCreatedSms({
    customerName: "Ramesh Kumar",
    shopName: "Sharma Kirana",
    amount: 500,
    outstanding: 1250.5,
  });

  it("fills every placeholder", () => {
    expect(content.body).not.toContain("{#var#}");
    expect(content.body).toContain("Ramesh Kumar");
    expect(content.body).toContain("500");
    expect(content.body).toContain("Sharma Kirana");
    expect(content.body).toContain("1250.50");
  });

  it("exposes the registered template with four variables", () => {
    expect(content.templateBody).toBe(UDHAARI_TEMPLATE_BODY);
    expect(content.templateBody.match(/\{#var#\}/g)).toHaveLength(4);
    expect(content.variables).toHaveLength(4);
  });

  it("fits in a single GSM segment for normal values", () => {
    expect(content.body.length).toBeLessThanOrEqual(160);
    expect(content.segments).toBe(1);
  });

  it("clamps a very long customer name and shop name", () => {
    const long = renderUdhaariCreatedSms({
      customerName: "A".repeat(120),
      shopName: "B".repeat(120),
      amount: 100,
      outstanding: 100,
    });
    expect(long.body.length).toBeLessThanOrEqual(160);
    expect(long.segments).toBe(1);
  });

  it("counts Devanagari bodies as UCS-2 segments", () => {
    const hindi = renderUdhaariCreatedSms({
      customerName: "रमेश कुमार शर्मा",
      shopName: "शर्मा किराना स्टोर",
      amount: 500,
      outstanding: 1250,
    });
    expect(hindi.body).toContain("रमेश कुमार शर्मा");
    expect(hindi.segments).toBeGreaterThanOrEqual(1);
  });
});

describe("smsSegments", () => {
  it("returns 0 for an empty body", () => {
    expect(smsSegments("")).toBe(0);
  });

  it("splits long ASCII bodies at 160 chars", () => {
    expect(smsSegments("a".repeat(161))).toBe(2);
  });

  it("splits long unicode bodies at 70 chars", () => {
    expect(smsSegments("अ".repeat(71))).toBe(2);
  });
});
