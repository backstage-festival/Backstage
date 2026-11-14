import { DomainError } from "./DomainError";

export class TooFarFromStageError extends DomainError {
  readonly distanceMeters: number;

  constructor(distanceMeters: number) {
    super("TOO_FAR_FROM_STAGE", `You are ${distanceMeters} m from the stage.`);
    this.name = "TooFarFromStageError";
    this.distanceMeters = distanceMeters;
  }
}
