import * as Location from "expo-location";

import { ExpoLocationService } from "../ExpoLocationService";

jest.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  Accuracy: { Balanced: 3, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  watchHeadingAsync: jest.fn(),
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;

describe("ExpoLocationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns true when permission is granted", async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as Location.LocationPermissionResponse);

    const service = new ExpoLocationService();
    await expect(service.requestPermissions()).resolves.toBe(true);
  });

  it("returns false when permission is denied", async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
    } as Location.LocationPermissionResponse);

    const service = new ExpoLocationService();
    await expect(service.requestPermissions()).resolves.toBe(false);
  });

  it("returns null from getCurrentPosition when permission is not granted", async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
    } as Location.LocationPermissionResponse);

    const service = new ExpoLocationService();
    await expect(service.getCurrentPosition()).resolves.toBeNull();
    expect(mockedLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("returns coordinates from getCurrentPosition when permission is granted", async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as Location.LocationPermissionResponse);
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 54.352, longitude: 18.646 },
      timestamp: 0,
    } as Location.LocationObject);

    const service = new ExpoLocationService();
    await expect(service.getCurrentPosition()).resolves.toEqual({
      latitude: 54.352,
      longitude: 18.646,
    });
  });

  it("returns null from getCurrentPosition when the native call rejects", async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as Location.LocationPermissionResponse);
    mockedLocation.getCurrentPositionAsync.mockRejectedValue(new Error("unavailable"));

    const service = new ExpoLocationService();
    await expect(service.getCurrentPosition()).resolves.toBeNull();
  });

  it("returns a no-op unsubscribe from watchPosition when permission is not granted", async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
    } as Location.LocationPermissionResponse);

    const service = new ExpoLocationService();
    const unsubscribe = await service.watchPosition(jest.fn());
    expect(mockedLocation.watchPositionAsync).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("forwards position updates and removes the subscription on unsubscribe", async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as Location.LocationPermissionResponse);
    const remove = jest.fn();
    mockedLocation.watchPositionAsync.mockImplementation(async (_options, callback) => {
      callback({
        coords: { latitude: 1, longitude: 2 },
        timestamp: 0,
      } as Location.LocationObject);
      return { remove } as Location.LocationSubscription;
    });

    const onChange = jest.fn();
    const service = new ExpoLocationService();
    const unsubscribe = await service.watchPosition(onChange);

    expect(onChange).toHaveBeenCalledWith({ latitude: 1, longitude: 2 });
    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });

  it("forwards heading updates using trueHeading when available", async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as Location.LocationPermissionResponse);
    const remove = jest.fn();
    mockedLocation.watchHeadingAsync.mockImplementation(async (callback) => {
      callback({ trueHeading: 90, magHeading: 95, accuracy: 3 } as Location.LocationHeadingObject);
      return { remove } as Location.LocationSubscription;
    });

    const onChange = jest.fn();
    const service = new ExpoLocationService();
    const unsubscribe = await service.watchHeading(onChange);

    expect(onChange).toHaveBeenCalledWith(90);
    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });

  it("falls back to magHeading when trueHeading is unavailable", async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    } as Location.LocationPermissionResponse);
    mockedLocation.watchHeadingAsync.mockImplementation(async (callback) => {
      callback({ trueHeading: -1, magHeading: 95, accuracy: 3 } as Location.LocationHeadingObject);
      return { remove: jest.fn() } as Location.LocationSubscription;
    });

    const onChange = jest.fn();
    const service = new ExpoLocationService();
    await service.watchHeading(onChange);

    expect(onChange).toHaveBeenCalledWith(95);
  });
});
