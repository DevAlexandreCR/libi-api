export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (message = 'Not found') => new ApiError(404, message);
export const unauthorized = (message = 'Unauthorized') => new ApiError(401, message);
export const forbidden = (message = 'Forbidden') => new ApiError(403, message);
export const badRequest = (message = 'Bad request', details?: unknown) =>
  new ApiError(400, message, details);
export const conflict = (message = 'Conflict') => new ApiError(409, message);
