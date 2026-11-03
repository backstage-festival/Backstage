import { StyleSheet, Text, View } from "react-native";

export default function PrepareScreen() {
  return (
    <View style={styles.container}>
      <Text>Przygotuj się</Text>
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
