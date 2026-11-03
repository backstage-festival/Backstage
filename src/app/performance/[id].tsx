import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function PerformanceScreen() {
  const { id } = useLocalSearchParams<"/performance/[id]">();

  return (
    <View style={styles.container}>
      <Text>Karta koncertu</Text>
      <Text>{id}</Text>
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
