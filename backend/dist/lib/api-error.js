export class ApiError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
    static badRequest(message, details) {
        return new ApiError(400, "BAD_REQUEST", message, details);
    }
    static badRequestCode(message, code, details) {
        return new ApiError(400, code, message, details);
    }
    static notFoundCode(message, code, details) {
        return new ApiError(404, code, message, details);
    }
    static unauthorized(message = "Unauthorized") {
        return new ApiError(401, "UNAUTHORIZED", message);
    }
    static forbidden(message = "Forbidden") {
        return new ApiError(403, "FORBIDDEN", message);
    }
    static notFound(message = "Not found") {
        return new ApiError(404, "NOT_FOUND", message);
    }
    static conflict(message) {
        return new ApiError(409, "CONFLICT", message);
    }
    static conflictCode(message, code, details) {
        return new ApiError(409, code, message, details);
    }
    static serviceUnavailableCode(message, code, details) {
        return new ApiError(503, code, message, details);
    }
}
