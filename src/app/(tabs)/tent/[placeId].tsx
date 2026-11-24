import { router, useLocalSearchParams } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { CompassArrow } from "@/components/CompassArrow";
import { EmptyState } from "@/components/EmptyState";
import { usePlaceGuide } from "@/hooks/usePlaceGuide";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

const t = strings.tent;

const goBack = (): void => {
  if (router.canGoBack()) router.back();
  else router.replace("/tent");
};

const openSettings = (): void => {
  void Linking.openSettings();
};

// TODO(#35): select the place marker on the map.
const showOnMap = (): void => {
  router.navigate("/map");
};

/** 07b · Prowadzenie do miejsca – compass, distance and walking time, works offline. */
export default function GuidanceScreen() {
  const { placeId } = useLocalSearchParams<"/tent/[placeId]">();
  const guide = usePlaceGuide(placeId);
  const { theme, level } = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button
          label={t.guide.back}
          variant="ghost"
          surface="dark"
          icon="arrowLeft"
          disabled={false}
          width="hug"
          accessibilityHint={t.a11y.back}
          onPress={goBack}
        />

        {guide.status === "loading" ? (
          <Text
            allowFontScaling={false}
            accessibilityLiveRegion="polite"
            style={[textStyle("sectionLabel", level), { color: c.textSecondary }]}
          >
            {strings.screen.loading}
          </Text>
        ) : null}

        {guide.status === "notFound" ? (
          <EmptyState
            kind="noPlaces"
            eyebrow={t.guide.notFoundEyebrow}
            title={t.guide.notFoundTitle}
            body={t.guide.notFoundBody}
            primary={{ label: t.guide.back, onPress: goBack, icon: "arrowLeft" }}
          />
        ) : null}

        {guide.status === "noPermission" ? (
          <EmptyState
            kind="loadError"
            eyebrow={t.noLocation.eyebrow}
            title={t.noLocation.title}
            body={t.noLocation.bodyPermission}
            primary={{ label: t.noLocation.openSettings, onPress: openSettings, prominent: true }}
            secondary={{ label: t.noLocation.retry, onPress: guide.retry }}
          />
        ) : null}

        {guide.status === "ready" ? (
          <>
            <View style={styles.title}>
              <Text allowFontScaling={false} style={[textStyle("eyebrow", level), { color: c.textSecondary }]}>
                {t.guide.eyebrow}
              </Text>
              <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("targetName", level), { color: c.textPrimary }]}>
                {guide.label}
              </Text>
            </View>

            <CompassArrow {...guide.compass} />

            <Button
              label={t.guide.showOnMap}
              variant="secondary"
              surface="dark"
              icon="map"
              disabled={false}
              width="fill"
              accessibilityHint={t.a11y.mapHint}
              onPress={showOnMap}
            />
            <Text allowFontScaling={false} style={[textStyle("statusMeta", level), styles.center, { color: c.textSecondary }]}>
              {t.guide.holdFlat}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.s4, paddingBottom: spacing.s12 },
  title: { gap: spacing.s1 },
  center: { textAlign: "center" },
});
