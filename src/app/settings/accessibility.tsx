import { StyleSheet, Text, View } from "react-native";

export default function AccessibilityScreen() {
  return (
    <View style={styles.container}>
      <Text>Dostępność</Text>
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
