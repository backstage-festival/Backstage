import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

import type { Unsubscribe } from "../../domain/entities/common";
import type { INetworkService } from "../../domain/repositories/INetworkService";

const isStateOnline = (state: NetInfoState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

export class NetInfoNetworkService implements INetworkService {
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return isStateOnline(state);
  }

  onChange(listener: (online: boolean) => void): Unsubscribe {
    return NetInfo.addEventListener((state) => {
      listener(isStateOnline(state));
    });
  }
}
