import { memo, useCallback, useMemo } from "react";
import { type AccessibilityActionEvent, Pressable, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { size, spacing, textStyle } from "@/theme/theme";
import type { SavedPlaceItemProps } from "@/types/components";

import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { PASS_CONTENT_LEFT, PassFrame } from "./PassFrame";

const PENDING_OPACITY = 0.6;

const t = strings.tent;

type ActionsProps = Pick<SavedPlaceItemProps, "id" | "pending" | "onRename" | "onDelete">;

/** TalkBack actions „Zmień nazwę” / „Usuń” (blocked while a write is in flight). */
function usePlaceActions({ id, pending, onRename, onDelete }: ActionsProps) {
  const accessibilityActions = useMemo(
    () =>
      pending
        ? []
        : [
            { name: "rename", label: t.a11y.renameAction },
            { name: "delete", label: t.a11y.deleteAction },
          ],
    [pending],
  );
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "rename") onRename(id);
      if (event.nativeEvent.actionName === "delete") onDelete(id);
    },
    [onRename, onDelete, id],
  );
  return { accessibilityActions, onAccessibilityAction };
}

/**
 * ⋯ without a frame (C08 draws none): 24 dp in the layout, 48 × 48 to touch –
 * the negative margin lets the touch field spill into the surrounding gaps.
 * Hidden from TalkBack: the parent offers „Zmień nazwę” / „Usuń” as actions.
 */
function MoreButton({ label, surface, pending, onPress }: { label: string; surface: "dark" | "laminate"; pending: boolean; onPress: () => void }) {
  return (
    <View importantForAccessibility="no-hide-descendants" style={styles.more}>
      <IconButton
        icon="more"
        accessibilityLabel={t.a11y.more(label)}
        accessibilityHint={t.a11y.moreHint}
        surface={surface}
        bare
        disabled={pending}
        onPress={onPress}
      />
    </View>
  );
}

/** C08 / E07a tent: laminate pass – band, name, description, then distance and „Prowadź →”. */
function TentPass(props: SavedPlaceItemProps) {
  const { id, label, description, distance, walk, savedAt, accessibilityLabel, pending, onGuide, onMore, testID } = props;
  const { theme, level } = useTheme();
  const c = theme.colors;
  const actions = usePlaceActions(props);
  const guide = useCallback(() => onGuide(id), [onGuide, id]);
  const more = useCallback(() => onMore(id), [onMore, id]);

  return (
    <View style={pending ? styles.pending : null}>
      <PassFrame band={t.passBand(savedAt)} {...(testID ? { testID } : null)}>
        <View style={styles.passBody}>
          <View style={styles.passTop}>
            <View accessible accessibilityLabel={accessibilityLabel} {...actions} style={styles.passText}>
              <Text allowFontScaling={false} style={[textStyle("passName", level), { color: c.textOnLaminate }]}>
                {label}
              </Text>
              {description ? (
                <Text allowFontScaling={false} style={[textStyle("bodyM", level), { color: c.textOnLaminateSecondary }]}>
                  {description}
                </Text>
              ) : null}
            </View>
            <MoreButton label={label} surface="laminate" pending={pending} onPress={more} />
          </View>
          <View style={[styles.guideRow, level === 2 ? styles.guideStacked : null]}>
            {/* Already in the pass label above. */}
            <View importantForAccessibility="no-hide-descendants" style={styles.distance}>
              {distance ? (
                <>
                  <Icon name="navArrow" size={size.icon} color={c.textOnLaminate} />
                  <Text allowFontScaling={false} style={[textStyle("data", level), styles.shrink, { color: c.textOnLaminate }]}>
                    {walk ? t.distanceWalk(distance, walk) : distance}
                  </Text>
                </>
              ) : null}
            </View>
            <Button
              label={t.guideButton}
              variant="primary"
              surface="laminate"
              icon="arrowRight"
              disabled={pending}
              {...(pending ? { disabledReason: t.saving } : null)}
              width={level === 2 ? "fill" : "hug"}
              accessibilityHint={t.a11y.guideHint}
              onPress={guide}
            />
          </View>
        </View>
      </PassFrame>
    </View>
  );
}

/**
 * C08 row: columns icon 24 · text 1fr · distance auto · ⋯ · chevron 24, gap 12,
 * min. 72. The whole row opens guidance; ⋯ (nested) opens the menu.
 * 200 %: icon and distance on top, then name and description (C08).
 */
function PlaceRow(props: SavedPlaceItemProps) {
  const { id, label, description, icon, distance, savedAt, accessibilityLabel, pending, onPress, onMore, testID } = props;
  const { theme, level } = useTheme();
  const c = theme.colors;
  const actions = usePlaceActions(props);
  const open = useCallback(() => onPress(id), [onPress, id]);
  const more = useCallback(() => onMore(id), [onMore, id]);
  const stacked = level === 2;
  const meta = pending ? t.saving : description ? `${description}${strings.common.separator}${t.savedAt(savedAt)}` : t.savedAt(savedAt);

  const distanceText = distance ? (
    <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textPrimary }]}>
      {distance}
    </Text>
  ) : null;
  const trailing = (
    <>
      <MoreButton label={label} surface="dark" pending={pending} onPress={more} />
      <Icon name="chevronRight" size={size.icon} color={c.textSecondary} />
    </>
  );
  const text = (
    <View style={stacked ? styles.rowTextStacked : styles.rowText}>
      <Text allowFontScaling={false} style={[textStyle("rowName", level), { color: c.textPrimary }]}>
        {label}
      </Text>
      <Text allowFontScaling={false} style={[textStyle("tagMeta", level), { color: c.textSecondary }]}>
        {meta}
      </Text>
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={open}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={t.a11y.rowHint}
      accessibilityState={{ disabled: pending }}
      {...actions}
      style={({ pressed }) => [
        styles.row,
        { minHeight: size.listRowMin, borderBottomColor: c.divider, borderBottomWidth: theme.borderWidth.hairline },
        stacked ? styles.rowStacked : null,
        pressed ? { backgroundColor: c.surfaceRaised } : null,
        pending ? styles.pending : null,
      ]}
    >
      {stacked ? (
        <>
          <View style={styles.rowTop}>
            <Icon name={icon} size={size.icon} color={c.textPrimary} />
            <View style={styles.rowTopEnd}>
              {distanceText}
              {trailing}
            </View>
          </View>
          {text}
        </>
      ) : (
        <>
          <Icon name={icon} size={size.icon} color={c.textPrimary} />
          {text}
          {distanceText}
          {trailing}
        </>
      )}
    </Pressable>
  );
}

/** C08 · SavedPlaceItem – `tent` pass at the top of S07 or a list `row`. */
function SavedPlaceItemBase(props: SavedPlaceItemProps) {
  return props.variant === "tent" ? <TentPass {...props} /> : <PlaceRow {...props} />;
}

export const SavedPlaceItem = memo(SavedPlaceItemBase);

/** ⋯ is 48 × 48 to touch but takes 24 × 24 in the layout. */
const MORE_OVERHANG = (size.iconButton - size.icon) / 2;

const styles = StyleSheet.create({
  // C08: padding 10 / 12 / 12 / 44.
  passBody: { paddingLeft: PASS_CONTENT_LEFT, paddingRight: spacing.s3, paddingTop: 10, paddingBottom: spacing.s3, gap: spacing.s3 },
  passTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.s2 },
  passText: { flex: 1, gap: spacing.s1 },
  guideRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.s3 },
  guideStacked: { flexDirection: "column", alignItems: "stretch" },
  distance: { flexDirection: "row", alignItems: "center", gap: spacing.s2, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  more: { margin: -MORE_OVERHANG },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.s3, paddingVertical: spacing.s3 },
  rowStacked: { flexDirection: "column", alignItems: "stretch" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTopEnd: { flexDirection: "row", alignItems: "center", gap: spacing.s3 },
  rowText: { flex: 1, gap: spacing.s1 },
  rowTextStacked: { gap: spacing.s1 },
  pending: { opacity: PENDING_OPACITY },
});
