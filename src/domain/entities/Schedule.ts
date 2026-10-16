import type { IsoDateString } from "./common";

export interface ScheduleItem {
  readonly userId: string;
  readonly concertId: string;
  readonly addedAt: IsoDateString;
}

export interface CheckIn {
  readonly id: string;
  readonly userId: string;
  readonly concertId: string;
  readonly createdAt: IsoDateString;
}
