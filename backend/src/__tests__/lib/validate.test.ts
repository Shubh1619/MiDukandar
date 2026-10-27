import { parse } from "../../lib/validate.js";
import { z } from "zod";

describe("validate", () => {
  it("parses valid data", () => {
    const schema = z.object({ name: z.string() });
    const result = parse(schema, { name: "test" });
    expect(result.name).toBe("test");
  });

  it("throws on invalid data", () => {
    const schema = z.object({ name: z.string() });
    expect(() => parse(schema, { name: 123 })).toThrow();
  });
});
