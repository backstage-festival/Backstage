import { BottomTabBar, Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { View } from "react-native";

import { ConnectionBar } from "@/components/ConnectionBar";
import { useConnectionBar, useLineupLoader } from "@/hooks/useConnectionBar";
import { useTheme } from "@/theme/ThemeProvider";

function TabBarWithConnection(props: BottomTabBarProps) {
  const { theme } = useTheme();
  const bar = useConnectionBar();
  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <ConnectionBar {...bar} />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  useLineupLoader();
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
