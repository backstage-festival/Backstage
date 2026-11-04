import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs backBehavior="initialRoute" screenOptions={{ headerShown: false, animation: "none" }}>
      <Tabs.Screen name="index" options={{ title: "Plan" }} />
      <Tabs.Screen name="map" options={{ title: "Mapa" }} />
      <Tabs.Screen name="crew" options={{ title: "Ekipa" }} />
      <Tabs.Screen name="tent" options={{ title: "Namiot" }} />
      <Tabs.Screen name="return" options={{ title: "Powrót" }} />
    </Tabs>
  );
}
