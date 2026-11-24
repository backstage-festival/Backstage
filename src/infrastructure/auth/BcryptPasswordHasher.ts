import {genSalt, hash as bcryptHash, compare as bcryptCompare, setRandomFallback} from "bcryptjs"
import {getRandomBytes} from "expo-crypto"
import type {IPasswordHasher} from "../../domain/repositories/IPasswordHasher"

setRandomFallback((length) => Array.from(getRandomBytes(length)))

export class BcryptPasswordHasher implements IPasswordHasher{
    constructor(private readonly rounds = 10) {}
    async hash(plainPassword: string):Promise<string>{
        const salt = await genSalt(this.rounds)
        return bcryptHash(plainPassword, salt)
    } 
    async compare(plainPassword: string, hash: string):Promise<boolean>{
        return bcryptCompare(plainPassword, hash)
    } 
}