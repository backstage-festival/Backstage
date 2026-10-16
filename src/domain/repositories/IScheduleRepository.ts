import type { ScheduleItem } from "../entities/Schedule";

export interface IScheduleRepository {
  getForUser(userId: string): Promise<readonly ScheduleItem[]>;
  add(item: ScheduleItem): Promise<void>;
  remove(userId: string, concertId: string): Promise<void>;
}
