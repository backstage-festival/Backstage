export type DomainErrorCode =
  | "LOCATION_UNAVAILABLE"
  | "TOO_FAR_FROM_STAGE"
  | "SCHEDULE_CONFLICT"
  | "INVALID_CREDENTIALS"
  | "LOGIN_TAKEN";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
