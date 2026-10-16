import type { Unsubscribe } from "../entities/common";

export interface INetworkService {
  isOnline(): Promise<boolean>;
  onChange(listener: (online: boolean) => void): Unsubscribe;
}
