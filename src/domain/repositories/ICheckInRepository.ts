import type { CheckIn } from "../entities/Schedule";

export interface ICheckInRepository {
  getForUser(userId: string): Promise<readonly CheckIn[]>;
  exists(userId: string, concertId: string): Promise<boolean>;
  save(checkIn: CheckIn): Promise<void>;
}
