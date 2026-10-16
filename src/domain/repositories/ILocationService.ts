import type { Coordinates, Unsubscribe } from "../entities/common";

export interface ILocationService {
  requestPermissions(): Promise<boolean>;
  getCurrentPosition(): Promise<Coordinates | null>;
  watchPosition(
    onChange: (position: Coordinates) => void,
  ): Promise<Unsubscribe>;
  watchHeading(onChange: (degrees: number) => void): Promise<Unsubscribe>;
}
