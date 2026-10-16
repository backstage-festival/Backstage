import type { BoundingBox } from "../entities/common";
import type {
  Concert,
  EventPackage,
  FestivalEvent,
  Poi,
  Stage,
} from "../entities/Event";

export interface IEventRepository {
  getCurrentEvent(): Promise<FestivalEvent | null>;
  getStages(eventId: string): Promise<readonly Stage[]>;
  getConcerts(eventId: string): Promise<readonly Concert[]>;
  getPoisInBounds(
    eventId: string,
    bounds: BoundingBox,
  ): Promise<readonly Poi[]>;
  saveEventPackage(eventPackage: EventPackage): Promise<void>;
}
