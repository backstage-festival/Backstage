import type {User} from "../domain/entities/User"
import { DomainError } from "../domain/errors/DomainError";
import type { IPasswordHasher } from "../domain/repositories/IPasswordHasher";
import type { IUserRepository } from "../domain/repositories/IUserRepository";

export interface LoginInput{
    readonly login: string;
    readonly password: string;
}


export class LoginUseCase{
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async execute(input: LoginInput):Promise<User>{
        const login = input.login.trim().toLowerCase()
        const user = await this.userRepository.findByLogin(login)
        if(!user){
            throw new DomainError("INVALID_CREDENTIALS", "Invalid Login or Password")
        }
        const passwordMatches = await this.passwordHasher.compare(input.password, user.passwordHash)
        if(!passwordMatches){
            throw new DomainError("INVALID_CREDENTIALS", "Invalid Login or Password")
        }
        return user
    }
}