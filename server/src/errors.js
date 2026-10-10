/** An error whose message is safe to show the client, with the HTTP status to send it with. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
