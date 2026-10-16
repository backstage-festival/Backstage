import type { User } from "../entities/User";

export interface IUserRepository {
  findByLogin(login: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
