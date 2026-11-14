import type { User } from "../../../domain/entities/User";
import type { IUserRepository } from "../../../domain/repositories/IUserRepository";
import { getDb } from "../database";

interface UserRow {
    id: string;
    login: string;
    password_hash: string;
    created_at: string;
}


function toUser(row: UserRow): User{
 return {
    id: row.id,
    login: row.login,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export class  SqliteUserRepository implements IUserRepository {
    async findByLogin(login: string): Promise<User | null>{
        const db = await getDb()
        const row = await db.getFirstAsync<UserRow>("SELECT id, login, password_hash, created_at FROM users WHERE login = ?", [login])
        if(row){
            return toUser(row)
        }
        return null
    }
    async save(user: User):Promise <void>{
        const db = await getDb()
        await db.runAsync("INSERT INTO users (id, login, password_hash, created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET login = excluded.login, password_hash = excluded.password_hash", [user.id, user.login, user.passwordHash, user.createdAt])
    }
}