export type DomainErrorCode =
  | "LOCATION_UNAVAILABLE"
  | "TOO_FAR_FROM_STAGE"
  | "SCHEDULE_CONFLICT"
  | "INVALID_CREDENTIALS"
  | "LOGIN_TAKEN"
  | "INVALID_TIME_RANGE"
  | "INVALID_COORDINATES"
  | "INVALID_RADIUS"
  | "INVALID_DATE"
  | "INVALID_LEAVE_PARAMS";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
