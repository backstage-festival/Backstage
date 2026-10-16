import type { Coordinates, IsoDateString } from "./common";

export interface Stop {
  readonly id: number;
  readonly name: string;
  readonly location: Coordinates;
}

export interface Departure {
  readonly stopId: number;
  readonly routeName: string;
  readonly headsign: string;
  readonly departureAt: IsoDateString;
  readonly delaySeconds: number | null;
  readonly fetchedAt: IsoDateString;
}

export interface TransitAlert {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly validFrom: IsoDateString;
  readonly validTo: IsoDateString | null;
  readonly fetchedAt: IsoDateString;
}
