import type { BoundingBox } from "../entities/common";
import type { Departure, Stop, TransitAlert } from "../entities/Transit";

export interface ITransitRepository {
  getStopsInBounds(bounds: BoundingBox): Promise<readonly Stop[]>;
  saveStops(stops: readonly Stop[]): Promise<void>;
  getDepartures(stopId: number): Promise<readonly Departure[]>;
  saveDepartures(
    stopId: number,
    departures: readonly Departure[],
  ): Promise<void>;
  getAlerts(): Promise<readonly TransitAlert[]>;
  saveAlerts(alerts: readonly TransitAlert[]): Promise<void>;
}
