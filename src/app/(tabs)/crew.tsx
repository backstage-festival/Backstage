import { memo, useCallback } from "react";
import { FlatList, KeyboardAvoidingView, type ListRenderItem, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Composer } from "@/components/Composer";
import { CrewCode } from "@/components/CrewCode";
import { DaySeparator } from "@/components/DaySeparator";
import { EmptyState } from "@/components/EmptyState";
import type { MessageBubbleData } from "@/components/mappers";
import { MessageBubble } from "@/components/MessageBubble";
import { QueueSummary } from "@/components/QueueSummary";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenState } from "@/components/ScreenState";
import type { CrewItem } from "@/hooks/crewItems";
import { useCrewScreen } from "@/hooks/useCrewScreen";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

/** L-Listy: 14 dp between messages. */
const MESSAGE_GAP = 14;

const keyOf = (item: CrewItem): string => item.key;

// TODO(#71 Q6): share the code (Share.share) once the crew contract exists.
const shareCode = (): void => undefined;

function Gap() {
  return <View style={styles.gap} />;
}

/**
 * „Wyślij mimo to” and „Spróbuj ponownie” only. Cancel / delete are not
 * passed – there are no use cases for them yet (#71 Q6).
 */
const MessageItem = memo(function MessageItem({
  bubble,
  onRetry,
}: {
  bubble: MessageBubbleData;
  onRetry: (id: string) => void;
}) {
  return <MessageBubble {...bubble} onSendAnyway={onRetry} onRetry={onRetry} />;
});

/** S06 · Ekipa – crew chat with the offline queue. Newest message at the bottom. */
export default function CrewScreen() {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const crew = useCrewScreen();
  const { retry } = crew;

  const renderItem = useCallback<ListRenderItem<CrewItem>>(
    ({ item }) =>
      item.type === "day" ? <DaySeparator label={item.label} /> : <MessageItem bubble={item.bubble} onRetry={retry} />,
    [retry],
  );

  const background = { backgroundColor: c.background };

  if (crew.status === "loading" || crew.status === "error") {
    return (
      <SafeAreaView edges={["top"]} style={[styles.screen, background]}>
        <ScreenState
          title={strings.crewScreen.title}
          state={
            crew.status === "loading"
              ? { kind: "loading" }
              : {
                  kind: "message",
                  empty: {
                    kind: "loadError",
                    eyebrow: strings.crewScreen.empty.errorEyebrow,
                    title: strings.crewScreen.empty.errorTitle,
                    body: strings.crewScreen.empty.errorBody,
                    primary: { label: strings.crewScreen.empty.retry, onPress: crew.reload },
                  },
                }
          }
        />
      </SafeAreaView>
    );
  }

  const empty = crew.status === "empty";

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, background]}>
      <KeyboardAvoidingView behavior="height" style={styles.screen}>
        <View style={styles.header}>
          <ScreenHeader title={strings.crewScreen.title} />
          <CrewCode code={crew.crewCode} onShare={shareCode} />
          <Text allowFontScaling={false} style={[textStyle("labelMeta", level), { color: c.textSecondary }]}>
            {empty ? strings.crewScreen.onlyYou : crew.membersLabel}
          </Text>
          <QueueSummary count={crew.queuedCount} />
        </View>

        {empty ? (
          // Not a ListEmptyComponent: in an inverted list it would render upside down.
          <View style={[styles.screen, styles.empty]}>
            <EmptyState
              kind="noMessages"
              title={strings.crewScreen.empty.title}
              body={strings.crewScreen.empty.body(strings.crewScreen.code(crew.crewCode))}
              primary={{ label: strings.crewScreen.empty.share, onPress: shareCode, prominent: true, icon: "share" }}
            />
          </View>
        ) : (
          <FlatList
            inverted
            data={crew.items}
            keyExtractor={keyOf}
            renderItem={renderItem}
            ItemSeparatorComponent={Gap}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            windowSize={7}
            style={styles.screen}
            contentContainerStyle={styles.list}
          />
        )}

        <Composer onSend={crew.send} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.screen, paddingTop: spacing.screen, gap: spacing.s3 },
  list: { paddingHorizontal: spacing.screen, paddingVertical: spacing.s4 },
  gap: { height: MESSAGE_GAP },
  empty: { paddingHorizontal: spacing.screen, paddingTop: spacing.section },
});
