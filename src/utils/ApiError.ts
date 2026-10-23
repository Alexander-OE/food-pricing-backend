// Error for expected failures, turned into the standard error response.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details: unknown[] = []): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }
}
