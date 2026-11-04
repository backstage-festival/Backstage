import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function LoginScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  return (
    <View style={styles.container}>
      <Text>{mode === "register" ? "Rejestracja" : "Logowanie"}</Text>
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
