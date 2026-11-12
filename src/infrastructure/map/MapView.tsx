import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import type { BoundingBox, Coordinates } from "../../domain/entities/common";
import { buildInjectedCommand, parseMapEvent, type MapMarker } from "./mapMessages";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MAP_HTML_SOURCE = require("../../../assets/map/map.html");

export interface MapViewProps {
  markers: readonly MapMarker[];
  userPosition?: Coordinates | null;
  userHeadingDegrees?: number;
  centerOn?: { latitude: number; longitude: number; zoom?: number };
  onMarkerPress?: (markerId: string) => void;
  onBoundsChanged?: (bounds: BoundingBox) => void;
  testID?: string;
}

export function MapView({
  markers,
  userPosition,
  userHeadingDegrees,
  centerOn,
  onMarkerPress,
  onBoundsChanged,
  testID,
}: MapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    webViewRef.current?.injectJavaScript(
      buildInjectedCommand({ type: "setMarkers", markers }),
    );
  }, [markers, isReady]);

  useEffect(() => {
    if (!isReady) return;
    webViewRef.current?.injectJavaScript(
      buildInjectedCommand({
        type: "setUserPosition",
        position: userPosition ?? null,
        headingDegrees: userHeadingDegrees,
      }),
    );
  }, [userPosition, userHeadingDegrees, isReady]);

  useEffect(() => {
    if (!isReady || !centerOn) return;
    webViewRef.current?.injectJavaScript(
      buildInjectedCommand({ type: "centerOn", ...centerOn }),
    );
  }, [centerOn, isReady]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseMapEvent(event.nativeEvent.data);
    if (!message) return;

    if (message.type === "mapReady") {
      setIsReady(true);
    } else if (message.type === "markerPressed") {
      onMarkerPress?.(message.markerId);
    } else if (message.type === "boundsChanged") {
      onBoundsChanged?.(message.bounds);
    }
  }, [onMarkerPress, onBoundsChanged]);

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
