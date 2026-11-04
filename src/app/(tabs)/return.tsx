import { StyleSheet, Text, View } from "react-native";

export default function ReturnScreen() {
  return (
    <View style={styles.container}>
      <Text>Powrót</Text>
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
