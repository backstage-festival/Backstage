export type DomainErrorCode =
  | "LOCATION_UNAVAILABLE"
  | "TOO_FAR_FROM_STAGE"
  | "SCHEDULE_CONFLICT"
  | "INVALID_CREDENTIALS"
  | "LOGIN_TAKEN"
  | "CONCERT_NOT_FOUND"
  | "INVALID_TIME_RANGE"
  | "INVALID_COORDINATES"
  | "INVALID_RADIUS"
  | "INVALID_DATE"
  | "INVALID_LEAVE_PARAMS"
  | "INVALID_RETRY_ATTEMPTS"
  | "INVALID_GPS_FIX";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
