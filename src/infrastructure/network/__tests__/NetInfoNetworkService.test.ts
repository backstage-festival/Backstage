import NetInfo from "@react-native-community/netinfo";

import { NetInfoNetworkService } from "../NetInfoNetworkService";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(),
  },
}));

const mockedNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe("NetInfoNetworkService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is online when connected and internet is reachable", async () => {
    mockedNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as never);

    const service = new NetInfoNetworkService();
    await expect(service.isOnline()).resolves.toBe(true);
  });

  it("is online when connected and reachability is unknown (null)", async () => {
    mockedNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: null,
    } as never);

    const service = new NetInfoNetworkService();
    await expect(service.isOnline()).resolves.toBe(true);
  });

  it("is offline when not connected", async () => {
    mockedNetInfo.fetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as never);

    const service = new NetInfoNetworkService();
    await expect(service.isOnline()).resolves.toBe(false);
  });

  it("is offline when connected but internet is confirmed unreachable", async () => {
    mockedNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: false,
    } as never);

    const service = new NetInfoNetworkService();
    await expect(service.isOnline()).resolves.toBe(false);
  });

  it("forwards connectivity changes through onChange", () => {
    const remove = jest.fn();
    mockedNetInfo.addEventListener.mockImplementation((cb) => {
      cb({ isConnected: true, isInternetReachable: true } as never);
      return remove;
    });

    const onChange = jest.fn();
    const service = new NetInfoNetworkService();
    const unsubscribe = service.onChange(onChange);

    expect(onChange).toHaveBeenCalledWith(true);
    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });
});
