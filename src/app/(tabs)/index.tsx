import { Link, router } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, type LayoutChangeEvent, type ListRenderItem, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { LeaveNowAlert } from "@/components/LeaveNowAlert";
import type { NowPassData } from "@/components/mappers";
import { NowPass } from "@/components/NowPass";
import { PerformanceCard } from "@/components/PerformanceCard";
import { PlanNoteRow } from "@/components/PlanNoteRow";
import { PlayedRow } from "@/components/PlayedRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenState } from "@/components/ScreenState";
import { SectionHeader } from "@/components/SectionHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { type PlanFilters, type PlanNote, type PlanRow, type PlanScope, planRowHeight, rowLayouts } from "@/hooks/planRows";
import type { LeaveNowAlertData } from "@/hooks/useLeaveNowAlert";
import { type PlanScreen as PlanScreenData, usePlanScreen } from "@/hooks/usePlanScreen";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";
import type { SegmentedOption, StageId } from "@/types/components";

const INITIAL_FILTERS: PlanFilters = { day: null, scope: "all", stages: [] };

const SCOPE_OPTIONS: readonly SegmentedOption<PlanScope>[] = [
  { value: "all", label: strings.planScreen.scopeAll },
  { value: "mine", label: strings.planScreen.scopeMine },
];

const keyOf = (row: PlanRow): string => row.key;

const goToMap = (): void => {
  router.navigate("/map");
};
const goToPrepare = (): void => {
  router.push("/prepare");
};
// TODO(#29/#34): snooze and mute need the settings store and alert scheduling.
const notYet = (): void => undefined;

/* ------------------------------------------------------------------ */
/* Header above the list (S04 1–10)                                     */
/* ------------------------------------------------------------------ */

interface PlanHeaderProps {
  eyebrow: string;
  alert: LeaveNowAlertData | null;
  dayOptions: PlanScreenData["dayOptions"];
  day: string | null;
  scope: PlanScope;
  stageOptions: PlanScreenData["stageOptions"];
  stages: readonly StageId[];
  nowHeader: string;
  nowPass: NowPassData | null;
  onDay: (value: readonly string[]) => void;
  onScope: (value: readonly PlanScope[]) => void;
  onStages: (value: readonly StageId[]) => void;
  onOpen: (id: string) => void;
}

const PlanHeader = memo(function PlanHeader(props: PlanHeaderProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const dayValue = useMemo(() => (props.day === null ? [] : [props.day]), [props.day]);
  const scopeValue = useMemo(() => [props.scope], [props.scope]);

  return (
    <View style={styles.header}>
      <ScreenHeader
        title={strings.planScreen.title}
        compact={props.alert !== null}
        accessory={
          <Text allowFontScaling={false} style={[textStyle("eyebrow", level), { color: c.textSecondary }]}>
            {props.eyebrow}
          </Text>
        }
      />
      {props.alert ? (
        <LeaveNowAlert {...props.alert} onGuide={goToMap} onSnooze={notYet} onMute={notYet} />
      ) : null}
      <SegmentedControl
        groupLabel={strings.planScreen.dayGroup}
        options={props.dayOptions}
        mode="single"
        value={dayValue}
        look="dayTabs"
        onChange={props.onDay}
      />
      <View style={[styles.filters, level > 0 ? styles.filtersWide : null]}>
        <SegmentedControl
          groupLabel={strings.planScreen.scopeGroup}
          options={SCOPE_OPTIONS}
          mode="single"
          value={scopeValue}
          look="chips"
          onChange={props.onScope}
        />
        <SegmentedControl
          groupLabel={strings.planScreen.stageGroup}
          options={props.stageOptions}
          mode="multi"
          value={props.stages}
          look="stageToggles"
          onChange={props.onStages}
        />
      </View>
      {props.nowPass ? (
        <View>
          <SectionHeader label={props.nowHeader} />
          <NowPass {...props.nowPass} onPress={props.onOpen} />
        </View>
      ) : null}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Rows                                                                 */
/* ------------------------------------------------------------------ */

const NoteItem = memo(function NoteItem({
  note,
  onAddAnyway,
  onDismiss,
}: {
  note: PlanNote;
  onAddAnyway: (concertId: string) => void;
  onDismiss: () => void;
}) {
  const { concertId } = note;
  const action = useMemo(
    () =>
      note.allowConflict && concertId !== null
        ? {
            label: strings.planScreen.note.addAnyway,
            hint: strings.planScreen.a11y.addAnywayHint,
            onPress: () => onAddAnyway(concertId),
          }
        : undefined,
    [note.allowConflict, concertId, onAddAnyway],
  );
  return (
    <PlanNoteRow
      label={note.label}
      accessibilityLabel={note.accessibilityLabel}
      tone={note.tone}
      {...(action ? { action } : null)}
      onDismiss={onDismiss}
    />
  );
});

function PlanEmpty({ plan, onShowAll }: { plan: PlanScreenData; onShowAll: () => void }) {
  const { theme, level } = useTheme();
  if (plan.empty === "noPlan") {
    return (
      <View style={styles.empty}>
        <EmptyState
          kind="noPlan"
          eyebrow={strings.planScreen.empty.noPlanEyebrow(plan.day === null ? "" : (plan.dayOptions.find((d) => d.value === plan.day)?.label ?? ""))}
          title={strings.planScreen.empty.noPlanTitle}
          body={strings.planScreen.empty.noPlanBody}
          primary={{ label: strings.planScreen.empty.showAll(plan.dayCount), onPress: onShowAll }}
        />
      </View>
    );
  }
  if (plan.empty === "noConcerts") {
    return (
      <Text allowFontScaling={false} style={[textStyle("bodyM", level), styles.empty, { color: theme.colors.textSecondary }]}>
        {strings.planScreen.noStageConcerts}
      </Text>
    );
  }
  return null;
}

/** TEMP: entry points kept until their screens get real ones (Marceli, H05). */
function TempLinks() {
  const { theme, level } = useTheme();
  const linkText = [textStyle("label", level), { color: theme.colors.textSecondary }];
  return (
    <View style={styles.links}>
      <Link href="/prepare">
        <Text allowFontScaling={false} style={linkText}>
          {strings.planScreen.prepare}
        </Text>
      </Link>
      <Link href="/badges">
        <Text allowFontScaling={false} style={linkText}>
          {strings.planScreen.badges}
        </Text>
      </Link>
      <Link href="/settings/accessibility">
        <Text allowFontScaling={false} style={linkText}>
          {strings.planScreen.accessibility}
        </Text>
      </Link>
      <Link href="/login">
        <Text allowFontScaling={false} style={linkText}>
          {strings.planScreen.login}
        </Text>
      </Link>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                               */
/* ------------------------------------------------------------------ */

/** S04 · Plan – line-up of the day with „Mój plan”, TERAZ pass and the leave-now slot. */
export default function PlanScreen() {
  const { theme, level } = useTheme();
  const [filters, setFilters] = useState<PlanFilters>(INITIAL_FILTERS);
  const [playedExpanded, setPlayedExpanded] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const plan = usePlanScreen(filters, playedExpanded);
  const { togglePlan, openConcert, addAnyway, dismissNote } = plan;

  const onDay = useCallback((value: readonly string[]) => {
    setFilters((current) => ({ ...current, day: value[0] ?? null }));
  }, []);
  const onScope = useCallback((value: readonly PlanScope[]) => {
    setFilters((current) => ({ ...current, scope: value[0] ?? "all" }));
  }, []);
  const onStages = useCallback((value: readonly StageId[]) => {
    setFilters((current) => ({ ...current, stages: value }));
  }, []);
  const showAll = useCallback(() => {
    setFilters((current) => ({ ...current, scope: "all", stages: [] }));
  }, []);
  const togglePlayed = useCallback(() => setPlayedExpanded((value) => !value), []);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  }, []);

  const renderItem = useCallback<ListRenderItem<PlanRow>>(
    ({ item }) => {
      switch (item.type) {
        case "header":
          return <SectionHeader label={item.label} />;
        case "perf":
          return <PerformanceCard {...item.card} onPress={openConcert} onTogglePlan={togglePlan} />;
        case "played":
          return <PlayedRow count={item.count} expanded={item.expanded} onPress={togglePlayed} />;
        case "note":
          return <NoteItem note={item.note} onAddAnyway={addAnyway} onDismiss={dismissNote} />;
      }
    },
    [openConcert, togglePlan, togglePlayed, addAnyway, dismissNote],
  );

  // L-Listy: fixed heights at 100 % text only; at 150 / 200 % rows wrap.
  const layouts = useMemo(() => rowLayouts(plan.rows, planRowHeight), [plan.rows]);
  const getItemLayout = useMemo(
    () =>
      level === 0
        ? (_: ArrayLike<PlanRow> | null | undefined, index: number) => {
            const layout = layouts[index];
            return { index, length: layout?.length ?? 0, offset: headerHeight + (layout?.offset ?? 0) };
          }
        : undefined,
    [level, layouts, headerHeight],
  );

  const background = { backgroundColor: theme.colors.background };

  if (plan.status !== "ready") {
    return (
      <SafeAreaView edges={["top"]} style={[styles.screen, background]}>
        <ScreenState
          title={strings.planScreen.title}
          state={
            plan.status === "loading"
              ? { kind: "loading" }
              : {
                  kind: "message",
                  empty: {
                    kind: "noData",
                    eyebrow: strings.planScreen.empty.noLineupEyebrow,
                    title: strings.planScreen.empty.noLineupTitle,
                    body: strings.planScreen.empty.noLineupBody,
                    primary: { label: strings.planScreen.prepare, onPress: goToPrepare },
                  },
                }
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, background]}>
      <FlatList
        data={plan.rows}
        keyExtractor={keyOf}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View onLayout={onHeaderLayout}>
            <PlanHeader
              eyebrow={plan.eyebrow}
              alert={plan.alert}
              dayOptions={plan.dayOptions}
              day={plan.day}
              scope={filters.scope}
              stageOptions={plan.stageOptions}
              stages={filters.stages}
              nowHeader={plan.nowHeader}
              nowPass={plan.nowPass}
              onDay={onDay}
              onScope={onScope}
              onStages={onStages}
              onOpen={openConcert}
            />
          </View>
        }
        ListEmptyComponent={<PlanEmpty plan={plan} onShowAll={showAll} />}
        ListFooterComponent={<TempLinks />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.screen, paddingBottom: spacing.section },
  header: { gap: spacing.s4 },
  filters: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.s2 },
  filtersWide: { flexDirection: "column", alignItems: "stretch" },
  empty: { paddingTop: spacing.section },
  links: { gap: spacing.s3, alignItems: "flex-start", paddingTop: spacing.section },
});
