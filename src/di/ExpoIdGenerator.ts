import { randomUUID } from "expo-crypto";
import type { IIdGenerator } from "../domain/repositories/IIdGenerator";

export const expoIdGenerator: IIdGenerator = {
  generate: () => randomUUID(),
};
