import type { Coordinates, IsoDateString } from "./common";

export type SavedPlaceType = "tent" | "meeting_point" | "parking" | "other";

export interface SavedPlace {
  readonly id: string;
  readonly userId: string;
  readonly label: string;
  readonly type: SavedPlaceType;
  readonly location: Coordinates;
  readonly savedAt: IsoDateString;
}
