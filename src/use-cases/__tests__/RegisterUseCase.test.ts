import type { User } from "../../domain/entities/User";
import { RegisterUseCase } from "../RegisterUseCase";

const ola: User = {
  id: "1",
  login: "ola",
  passwordHash: "hash-oli",
  createdAt: "2026-11-14T10:00:00.000Z",
};

function createUseCase(existingUser: User | null) {
  const userRepository = {
    findByLogin: jest.fn().mockResolvedValue(existingUser),
    save: jest.fn(),
  };
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue("hashed"),
    compare: jest.fn(),
  };
  const idGenerator = {
    generate: jest.fn().mockReturnValue("id-1"),
  };
  const useCase = new RegisterUseCase(userRepository, passwordHasher, idGenerator);

  return { useCase, userRepository };
}

describe("RegisterUseCase", () => {
  it("zapisuje nowego usera z hashem", async () => {
    const { useCase, userRepository } = createUseCase(null);

    await useCase.execute({ login: "Ola", password: "festiwal123" });

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "id-1", login: "ola", passwordHash: "hashed" }),
    );
  });

  it("odrzuca zajęty login", async () => {
    const { useCase, userRepository } = createUseCase(ola);

    await expect(
      useCase.execute({ login: "Ola", password: "festiwal123" }),
    ).rejects.toMatchObject({ code: "LOGIN_TAKEN" });
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it("odrzuca za krótkie hasło", async () => {
    const { useCase, userRepository } = createUseCase(null);

    await expect(
      useCase.execute({ login: "Ola", password: "abc" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
