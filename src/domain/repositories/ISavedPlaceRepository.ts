import type { SavedPlace } from "../entities/SavedPlace";

export interface ISavedPlaceRepository {
  getForUser(userId: string): Promise<readonly SavedPlace[]>;
  save(place: SavedPlace): Promise<void>;
  remove(id: string): Promise<void>;
}
