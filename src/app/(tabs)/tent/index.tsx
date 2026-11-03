import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function TentScreen() {
  return (
    <View style={styles.container}>
      <Text>Namiot</Text>
      {/* TEMP: replaced by real entry points in screen tasks */}
      <Link href={{ pathname: "/tent/[placeId]", params: { placeId: "demo" } }}>
        <Text>Prowadzenie</Text>
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
