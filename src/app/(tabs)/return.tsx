import { router } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, type LayoutChangeEvent, type ListRenderItem, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DepartureRow } from "@/components/DepartureRow";
import { NoteCard } from "@/components/NoteCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenState, type ScreenStateKind } from "@/components/ScreenState";
import { StatusTag } from "@/components/StatusTag";
import { StopHeader } from "@/components/StopHeader";
import { rowLayouts } from "@/hooks/planRows";
import { type ReturnRow, returnRowHeight, type StopHeaderData } from "@/hooks/returnRows";
import { type ReturnScreen as ReturnScreenData, useReturnScreen } from "@/hooks/useReturnScreen";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/theme";

const keyOf = (row: ReturnRow): string => row.key;

const goToPrepare = (): void => {
  router.push("/prepare");
};
const goToMap = (): void => {
  router.navigate("/map");
};

/** „Dane z 21:40” (laminate) or „Dane nieaktualne” (warning) next to the title. */
function DataAgeTag({ label, stale }: { label: string | null; stale: boolean }) {
  if (label === null) return null;
  return stale ? (
    <StatusTag label={strings.returnScreen.dataStale} tone="warning" icon="warning" fill="solid" />
  ) : (
    <StatusTag label={label} tone="laminate" icon="clock" fill="solid" />
  );
}

const StopItem = memo(function StopItem({ header, onGuide }: { header: StopHeaderData; onGuide: () => void }) {
  return (
    <StopHeader name={header.name} meta={header.meta} freshness={header.freshness} first={header.first} onGuide={onGuide} />
  );
});

function stateFor(screen: ReturnScreenData): ScreenStateKind | null {
  switch (screen.status) {
    case "ready":
      return null;
    case "loading":
      return { kind: "loading" };
    case "noData":
      return {
        kind: "message",
        empty: {
          kind: "noDepartures",
          eyebrow: strings.returnScreen.empty.noDataEyebrow,
          title: strings.returnScreen.empty.noDataTitle,
          body: strings.returnScreen.empty.noDataBody,
          primary: { label: strings.returnScreen.empty.prepare, onPress: goToPrepare },
        },
      };
    case "nothingLeft":
      return {
        kind: "message",
        empty: {
          kind: "noDepartures",
          eyebrow: strings.returnScreen.empty.noDataEyebrow,
          title: strings.returnScreen.empty.nothingTitle,
          body: strings.returnScreen.empty.nothingBody,
          primary: { label: strings.returnScreen.empty.showGate, onPress: goToMap },
        },
      };
    case "error": {
      const location = screen.error?.kind === "locationUnavailable";
      return {
        kind: "message",
        empty: {
          kind: "loadError",
          eyebrow: location ? strings.returnScreen.empty.locationEyebrow : strings.returnScreen.empty.errorEyebrow,
          title: location ? strings.returnScreen.empty.locationTitle : strings.returnScreen.empty.errorTitle,
          body: location ? strings.returnScreen.empty.locationBody : strings.returnScreen.empty.errorBody,
          primary: { label: strings.returnScreen.empty.retry, onPress: screen.reload },
        },
      };
    }
  }
}

/** S08 · Powrót – nearest stops and when to leave. Older data → timetable view. */
export default function ReturnScreen() {
  const { theme, level } = useTheme();
  const screen = useReturnScreen();
  const { guide } = screen;
  const [headerHeight, setHeaderHeight] = useState(0);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  }, []);

  const renderItem = useCallback<ListRenderItem<ReturnRow>>(
    ({ item }) =>
      item.type === "stop" ? <StopItem header={item.header} onGuide={guide} /> : <DepartureRow {...item.row} />,
    [guide],
  );

  // L-Listy: fixed heights at 100 % text only; at 150 / 200 % rows wrap.
  const layouts = useMemo(() => rowLayouts(screen.rows, returnRowHeight), [screen.rows]);
  const getItemLayout = useMemo(
    () =>
      level === 0
        ? (_: ArrayLike<ReturnRow> | null | undefined, index: number) => {
            const layout = layouts[index];
            return { index, length: layout?.length ?? 0, offset: headerHeight + (layout?.offset ?? 0) };
          }
        : undefined,
    [level, layouts, headerHeight],
  );

  const background = { backgroundColor: theme.colors.background };
  const tag = <DataAgeTag label={screen.asOfLabel} stale={screen.isStale} />;
  const state = stateFor(screen);

  if (state !== null) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.screen, background]}>
        <ScreenState title={strings.returnScreen.title} titleAccessory={tag} state={state} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, background]}>
      <FlatList
        data={screen.rows}
        keyExtractor={keyOf}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View onLayout={onHeaderLayout} style={styles.header}>
            <ScreenHeader title={strings.returnScreen.title} accessory={tag} />
            {screen.staleNote ? <NoteCard {...screen.staleNote} /> : null}
            {screen.alertNote ? <NoteCard {...screen.alertNote} /> : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.screen, paddingBottom: spacing.section },
  header: { gap: spacing.s4, paddingBottom: spacing.s4 },
});
