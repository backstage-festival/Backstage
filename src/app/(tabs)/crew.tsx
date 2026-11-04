import { useCallback } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { toMessageBubbleProps } from "@/components/mappers";
import { MessageBubble } from "@/components/MessageBubble";
import { mockClock, mockCurrentUserId, mockMessages, mockSendingIds, mockUsers } from "@/mocks/mockData";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/theme";

// TEMP: mock data until #27
const authorNames: Readonly<Record<string, string>> = Object.fromEntries(
  mockUsers.map((user) => [user.id, user.login]),
);

export default function CrewScreen() {
  const { theme } = useTheme();
  const noop = useCallback(() => undefined, []);

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {mockMessages.map((message) => (
          <MessageBubble
            key={message.id}
            {...toMessageBubbleProps(message, {
              currentUserId: mockCurrentUserId,
              now: mockClock.crew,
              staleAfterMin: 20,
              authorNames,
              sendingIds: mockSendingIds,
            })}
            onCancel={noop}
            onSendAnyway={noop}
            onRetry={noop}
            onDelete={noop}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.section },
});
