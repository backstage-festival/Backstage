import { BottomTabBar, Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { View } from "react-native";

import { ConnectionBar } from "@/components/ConnectionBar";
import { formatTime } from "@/components/mappers";
import { mockDepartures } from "@/mocks/mockData";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";

// TEMP: mock data until #27 – connection state comes from useConnectionStore later.
const mockFetchedAt = mockDepartures[0]?.fetchedAt ?? new Date().toISOString();

function TabBarWithConnection(props: BottomTabBarProps) {
  const { theme } = useTheme();
  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <ConnectionBar
        state="offline"
        detail={strings.connection.dataFrom(formatTime(mockFetchedAt))}
        queued={3}
      />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      tabBar={(props) => <TabBarWithConnection {...props} />}
      screenOptions={{ headerShown: false, animation: "none" }}
    >
      <Tabs.Screen name="index" options={{ title: "Plan" }} />
      <Tabs.Screen name="map" options={{ title: "Mapa" }} />
      <Tabs.Screen name="crew" options={{ title: "Ekipa" }} />
      <Tabs.Screen name="tent" options={{ title: "Namiot" }} />
      <Tabs.Screen name="return" options={{ title: "Powrót" }} />
    </Tabs>
  );
}
