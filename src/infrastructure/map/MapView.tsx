import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import type { BoundingBox, Coordinates } from "../../domain/entities/common";
import { buildInjectedCommand, parseMapEvent, type MapMarker, type MapTheme } from "./mapMessages";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MAP_HTML_SOURCE = require("../../../assets/map/map.html");

export interface MapViewProps {
  markers: readonly MapMarker[];
  /** Marker icon theme (H04): default, color-blind-safe patterns, or high contrast. */
  theme?: MapTheme;
  userPosition?: Coordinates | null;
  userHeadingDegrees?: number;
  /** Imperatively re-center the map; bump a key or pass a new object to trigger it. */
  centerOn?: { latitude: number; longitude: number; zoom?: number };
  onMarkerPress?: (markerId: string) => void;
  onBoundsChanged?: (bounds: BoundingBox) => void;
  testID?: string;
}

export function MapView({
  markers,
  theme = "domyslny",
  userPosition,
  userHeadingDegrees,
  centerOn,
  onMarkerPress,
  onBoundsChanged,
  testID,
}: MapViewProps) {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(buildInjectedCommand({ type: "setTheme", theme }));
  }, [theme]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      buildInjectedCommand({ type: "setMarkers", markers }),
    );
  }, [markers]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      buildInjectedCommand({
        type: "setUserPosition",
        position: userPosition ?? null,
        headingDegrees: userHeadingDegrees,
      }),
    );
  }, [userPosition, userHeadingDegrees]);

  useEffect(() => {
    if (!centerOn) {
      return;
    }
    webViewRef.current?.injectJavaScript(
      buildInjectedCommand({ type: "centerOn", ...centerOn }),
    );
  }, [centerOn]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseMapEvent(event.nativeEvent.data);
    if (!message) {
      return;
    }
    if (message.type === "markerPressed") {
      onMarkerPress?.(message.markerId);
    } else if (message.type === "boundsChanged") {
      onBoundsChanged?.(message.bounds);
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <WebView
        ref={webViewRef}
        source={MAP_HTML_SOURCE}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
