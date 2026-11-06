import * as Location from "expo-location";

import type { Coordinates, Unsubscribe } from "../../domain/entities/common";
import type { ILocationService } from "../../domain/repositories/ILocationService";

export class ExpoLocationService implements ILocationService {
  async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  }

  async getCurrentPosition(): Promise<Coordinates | null> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch {
      return null;
    }
  }

  async watchPosition(
    onChange: (position: Coordinates) => void,
  ): Promise<Unsubscribe> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return () => {};
    }

    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5 },
      (location) => {
        onChange({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      },
    );

    return () => subscription.remove();
  }

  async watchHeading(onChange: (degrees: number) => void): Promise<Unsubscribe> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return () => {};
    }

    const subscription = await Location.watchHeadingAsync((heading) => {
      onChange(heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading);
    });

    return () => subscription.remove();
  }
}
