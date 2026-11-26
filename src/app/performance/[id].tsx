import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { CheckInRange } from "@/components/CheckInRange";
import { ConcertPass } from "@/components/ConcertPass";
import { ConnectionBar } from "@/components/ConnectionBar";
import { DistanceGauge } from "@/components/DistanceGauge";
import { IconButton } from "@/components/IconButton";
import { ScreenState } from "@/components/ScreenState";
import { StatusTag } from "@/components/StatusTag";
import { firstParam } from "@/hooks/tentRows";
import { useConcertScreen } from "@/hooks/useConcertScreen";
import { useConnectionBar } from "@/hooks/useConnectionBar";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

const t = strings.concert;

/** Closes the modal; opened from a link with no history → the Plan. */
const goBack = (): void => {
  if (router.canGoBack()) router.back();
  else router.replace("/");
};

/** S05 · Karta koncertu – pass, distance to the stage, plan toggle and check-in (modal). */
export default function ConcertScreen() {
  // Typed routes say string, but without .expo/types (CI) the param is string | string[] | undefined.
  // A missing id shows „Tego koncertu nie ma”.
  const concertId = firstParam(useLocalSearchParams<"/performance/[id]">().id);
  const screen = useConcertScreen(concertId);
  const bar = useConnectionBar();
  const { theme, level } = useTheme();
  const c = theme.colors;
  const background = { backgroundColor: c.background };

  if (screen.status === "loading") {
    // Local data: no spinner, just the background until the line-up is read.
    return <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, background]} />;
  }

  if (screen.status === "notFound") {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, background]}>
        <View style={styles.fill}>
          <ScreenState
            title={t.notFound.title}
            state={{
              kind: "message",
              empty: {
                kind: "loadError",
                eyebrow: t.notFound.eyebrow,
                title: t.notFound.heading,
                body: t.notFound.body,
                primary: { label: t.notFound.back, onPress: goBack },
              },
            }}
          />
        </View>
        <ConnectionBar {...bar} />
      </SafeAreaView>
    );
  }

  const { pass, conflict, gauge, plan, checkIn, explainShort } = screen;
  const status = checkIn.status;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, background]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 1 · ModalHeader */}
        <View style={styles.header}>
          <IconButton
            icon="close"
            accessibilityLabel={t.close}
            bare
            surface="dark"
            disabled={false}
            onPress={goBack}
          />
        </View>

        {/* 2 · Pass */}
        <ConcertPass {...pass} />

        {/* 3 · Conflict (only when not in the plan) */}
        {conflict ? (
          <View accessible accessibilityLabel={conflict.accessibilityLabel}>
            <StatusTag label={conflict.label} tone="warning" fill="solid" />
          </View>
        ) : null}

        {/* 4 · DistanceGauge */}
        <DistanceGauge {...gauge} />

        <View style={styles.actions}>
          {/* 5 · Plan */}
          <Button
            label={plan.inPlan ? t.inPlan : t.addToPlan}
            variant={plan.inPlan ? "secondary" : "primary"}
            surface="dark"
            icon={plan.inPlan ? "inPlan" : "add"}
            selected={plan.inPlan}
            disabled={plan.pending}
            width="fill"
            accessibilityHint={plan.inPlan ? strings.plan.a11y.removeHint : strings.plan.a11y.addHint}
            onPress={plan.toggle}
          />
          {plan.note ? (
            <View accessible accessibilityLabel={plan.note.accessibilityLabel}>
              <StatusTag label={plan.note.label} tone="error" fill="outline" />
            </View>
          ) : null}

          {/* 6 · Check-in */}
          {status.kind === "checkedIn" ? (
            <View accessible accessibilityLabel={t.a11y.checkedIn} accessibilityLiveRegion="polite">
              <StatusTag label={t.checkedIn} tone="success" icon="inPlan" fill="solid" />
            </View>
          ) : (
            <Button
              label={t.checkIn}
              variant="primary"
              surface="dark"
              icon="pin"
              disabled={status.kind !== "inRange"}
              {...(checkIn.disabledReason ? { disabledReason: checkIn.disabledReason } : null)}
              width="fill"
              accessibilityHint={checkIn.hint}
              onPress={checkIn.checkIn}
            />
          )}
          {checkIn.range ? <CheckInRange {...checkIn.range} /> : null}
          {checkIn.error ? (
            <View accessible accessibilityLabel={checkIn.error.accessibilityLabel} accessibilityLiveRegion="polite">
              <StatusTag label={checkIn.error.label} tone="error" fill="outline" />
            </View>
          ) : null}

          {/* 7 · Explanation */}
          <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: c.textSecondary }]}>
            <Text allowFontScaling={false} style={[textStyle("bodySStrong", level), { color: c.textPrimary }]}>
              {t.explainLead}
            </Text>
            {explainShort ? t.explainShort : t.explainFull}
          </Text>
        </View>
      </ScrollView>

      {/* 8 · ConnectionBar */}
      <ConnectionBar {...bar} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.screen, paddingBottom: spacing.section, gap: spacing.s4 },
  header: { alignItems: "flex-end" },
  // E05: the buttons sit at the bottom of the card, the gap above takes the rest.
  actions: { marginTop: "auto", gap: spacing.s3 },
});
