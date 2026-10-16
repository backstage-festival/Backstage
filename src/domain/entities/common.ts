export type IsoDateString = string;

export type Unsubscribe = () => void;

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface BoundingBox {
  readonly minLatitude: number;
  readonly maxLatitude: number;
  readonly minLongitude: number;
  readonly maxLongitude: number;
}
