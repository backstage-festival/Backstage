import { StyleSheet, Text, View } from "react-native";

export default function BadgesScreen() {
  return (
    <View style={styles.container}>
      <Text>Odznaki</Text>
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
