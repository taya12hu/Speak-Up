/**
 * An error whose message is safe to show the client, with the HTTP status to send it with.
 * `code` is an optional machine-readable reason (e.g. "token_expired") the client can act on.
 */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (code) this.code = code;
  }
}
