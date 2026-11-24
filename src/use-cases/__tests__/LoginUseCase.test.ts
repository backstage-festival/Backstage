import type { User } from "../../domain/entities/User";
import { LoginUseCase } from "../LoginUseCase";

const ola: User = {
  id: "1",
  login: "ola",
  passwordHash: "hash-oli",
  createdAt: "2026-11-14T10:00:00.000Z",
};

describe("LoginUseCase", () => {
  it("zwraca usera przy dobrym haśle", async () => {
    const userRepository = {
      findByLogin: jest.fn().mockResolvedValue(ola),
      save: jest.fn(),
    };
    const passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn().mockResolvedValue(true),
    };
    const useCase = new LoginUseCase(userRepository, passwordHasher);

    const wynik = await useCase.execute({ login: "Ola", password: "festiwal123" });

    expect(wynik).toBe(ola);
  });
    it("złe hasło nie loguje", async () => {
    const userRepository = {
      findByLogin: jest.fn().mockResolvedValue(ola),
      save: jest.fn(),
    };
    const passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn().mockResolvedValue(false),
    };
    const useCase = new LoginUseCase(userRepository, passwordHasher);


    await expect(
      useCase.execute({ login: "Ola", password: "festiwal123" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
      it("nieistniejący login nie loguje", async () => {
    const userRepository = {
      findByLogin: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn().mockResolvedValue(false),
    };
    const useCase = new LoginUseCase(userRepository, passwordHasher);

    await expect(
      useCase.execute({ login: "Ola", password: "festiwal123" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
        it("login szukany małymi literami", async () => {
    const userRepository = {
      findByLogin: jest.fn().mockResolvedValue(ola),
      save: jest.fn(),
    };
    const passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn().mockResolvedValue(true),
    };
    const useCase = new LoginUseCase(userRepository, passwordHasher);

    await useCase.execute({ login: "Ola", password: "festiwal123" });

    expect(userRepository.findByLogin).toHaveBeenCalledWith("ola")
  });
});