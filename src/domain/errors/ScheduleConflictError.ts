import type { Concert } from "../entities/Event";
import { DomainError } from "./DomainError";

export class ScheduleConflictError extends DomainError {
  readonly conflicts: readonly Concert[];

  constructor(conflicts: readonly Concert[]) {
    const artists = conflicts.map((concert) => concert.artist).join(", ");
    super("SCHEDULE_CONFLICT", `Concert overlaps with: ${artists}.`);
    this.name = "ScheduleConflictError";
    this.conflicts = conflicts;
  }
}
