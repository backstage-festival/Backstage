import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function PlanScreen() {
  return (
    <View style={styles.container}>
      <Text>Plan</Text>
      {/* TEMP: replaced by real entry points in screen tasks */}
      <Link href="/prepare">
        <Text>Przygotuj się</Text>
      </Link>
      <Link href={{ pathname: "/performance/[id]", params: { id: "demo" } }}>
        <Text>Karta koncertu</Text>
      </Link>
      <Link href="/badges">
        <Text>Odznaki</Text>
      </Link>
      <Link href="/settings/accessibility">
        <Text>Dostępność</Text>
      </Link>
      <Link href="/login">
        <Text>Logowanie</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
