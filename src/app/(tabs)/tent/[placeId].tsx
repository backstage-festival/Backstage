import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function GuidanceScreen() {
  const { placeId } = useLocalSearchParams<"/tent/[placeId]">();

  return (
    <View style={styles.container}>
      <Text>Prowadzenie</Text>
      <Text>{placeId}</Text>
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
