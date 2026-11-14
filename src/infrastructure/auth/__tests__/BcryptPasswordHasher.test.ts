import { BcryptPasswordHasher } from "../BcryptPasswordHasher";

const pass = "festiwal123"

describe("BcryptPasswordHasher", () => {
  const hasher = new BcryptPasswordHasher(4);
    it("hash nie jest tym samym co hasło", async() => {
        const wynik = await hasher.hash("pass")
        expect(wynik).not.toBe("pass")
    })
    it("Hasło się zgadza", async() => {
        const hash = await hasher.hash(pass)
        const wynik = await hasher.compare(pass, hash)

        expect(wynik).toBe(true)
    })
    it("złe hasło nie pasuje", async() => {
        const hash = await hasher.hash(pass)
        const wynik = await hasher.compare("festiwal1234", hash)

        expect(wynik).toBe(false)
    })
    it("dwa hashe tego samego hasła są różne", async() => {
        const hash1 = await hasher.hash(pass)
        const hash2 = await hasher.hash(pass)

        expect(hash1).not.toBe(hash2)
    })

});