import type { IsoDateString } from "./common";

export interface User {
  readonly id: string;
  readonly login: string;
  readonly passwordHash: string;
  readonly createdAt: IsoDateString;
}
