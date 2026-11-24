import type { User } from "../domain/entities/User";
import { DomainError } from "../domain/errors/DomainError";
import type { IIdGenerator } from "../domain/repositories/IIdGenerator";
import type { IPasswordHasher } from "../domain/repositories/IPasswordHasher";
import type { IUserRepository } from "../domain/repositories/IUserRepository";

export interface RegisterInput {
  readonly login: string;
  readonly password: string;
}

export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly idGenerator: IIdGenerator,
  ) {}

  async execute(input: RegisterInput): Promise<User> {
    const login = input.login.trim().toLowerCase()
    const existingUser = await this.userRepository.findByLogin(login)
    const password = input.password

    if(existingUser){
      throw new DomainError("LOGIN_TAKEN", "Login is already taken.")
    }

    if(password.length < 8 ){
      throw new DomainError("INVALID_CREDENTIALS", "Password too short")
    }

    const passwordHash = await this.passwordHasher.hash(password)

    const user: User = {
    id: this.idGenerator.generate(),
    login: login,
    passwordHash: passwordHash,
    createdAt: new Date().toISOString(),
    };

    await this.userRepository.save(user)
    return user
  }
}