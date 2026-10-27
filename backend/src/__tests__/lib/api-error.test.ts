import { ApiError } from "../../lib/api-error.js";

describe("ApiError", () => {
  it("creates error with status code", () => {
    const err = new ApiError(400, "BAD_REQUEST", "Bad request");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Bad request");
  });

  it("creates not found error", () => {
    const err = ApiError.notFound("Not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("creates unauthorized error", () => {
    const err = ApiError.unauthorized("Unauthorized");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("creates forbidden error", () => {
    const err = ApiError.forbidden("Forbidden");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("creates conflict error", () => {
    const err = ApiError.conflict("Conflict");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});
