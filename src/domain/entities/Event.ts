import type { Coordinates, IsoDateString } from "./common";

export interface FestivalEvent {
  readonly id: string;
  readonly name: string;
  readonly startsAt: IsoDateString;
  readonly endsAt: IsoDateString;
  readonly downloadedAt: IsoDateString | null;
}

export interface Stage {
  readonly id: string;
  readonly eventId: string;
  readonly name: string;
  readonly location: Coordinates;
}

export interface Concert {
  readonly id: string;
  readonly eventId: string;
  readonly stageId: string;
  readonly artist: string;
  readonly startsAt: IsoDateString;
  readonly endsAt: IsoDateString;
}

export type PoiType = "toilet" | "water" | "medical" | "gate" | "food";

export interface Poi {
  readonly id: string;
  readonly eventId: string;
  readonly type: PoiType;
  readonly name: string;
  readonly location: Coordinates;
}

export interface EventPackage {
  readonly event: FestivalEvent;
  readonly stages: readonly Stage[];
  readonly concerts: readonly Concert[];
  readonly pois: readonly Poi[];
}
