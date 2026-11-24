import { memo, useCallback, useMemo } from "react";
import { type AccessibilityActionEvent, Pressable, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { SavedPlaceItemProps } from "@/types/components";

import { Button } from "./Button";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

/** Pass slot like NowPass (C01): 16 from the left, 46 from the top; content from 44. */
const SLOT_LEFT = 16;
const SLOT_TOP = 46;
const CONTENT_LEFT = 44;
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

/** C08 tent: laminate pass – band, name, description, distance and „Prowadź”. */
function TentPass(props: SavedPlaceItemProps) {
  const { id, label, description, distance, walk, savedAt, accessibilityLabel, pending, onGuide, onMore, testID } = props;
  const { theme, level } = useTheme();
  const c = theme.colors;
  const actions = usePlaceActions(props);
  const guide = useCallback(() => onGuide(id), [onGuide, id]);
  const more = useCallback(() => onMore(id), [onMore, id]);

  return (
    <View testID={testID} style={[styles.pass, { backgroundColor: c.laminate }, pending ? styles.pending : null]}>
      <View style={[styles.band, { backgroundColor: c.accent }]}>
        <Text allowFontScaling={false} style={[textStyle("eyebrow", level), styles.shrink, { color: c.textOnAccent }]}>
          {t.passBand(savedAt)}
        </Text>
      </View>
      <View style={styles.passBody}>
        <View style={styles.passTop}>
          <View accessible accessibilityLabel={accessibilityLabel} {...actions} style={styles.passText}>
            <Text allowFontScaling={false} style={[textStyle("passName", level), { color: c.textOnLaminate }]}>
              {label}
            </Text>
            <Text allowFontScaling={false} style={[textStyle("bodyM", level), { color: c.textOnLaminateSecondary }]}>
              {description}
            </Text>
            {distance ? (
              <View style={styles.distance}>
                <Icon name="navArrow" size={size.iconSmall} color={c.textOnLaminate} />
                <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textOnLaminate }]}>
                  {walk ? t.distanceWalk(distance, walk) : distance}
                </Text>
              </View>
            ) : null}
          </View>
          <IconButton
            icon="more"
            accessibilityLabel={t.a11y.more(label)}
            accessibilityHint={t.a11y.moreHint}
            surface="laminate"
            disabled={pending}
            onPress={more}
          />
        </View>
        <Button
          label={t.guideButton}
          variant="primary"
          surface="laminate"
          icon="arrowRight"
          disabled={pending}
          {...(pending ? { disabledReason: t.saving } : null)}
          width="fill"
          accessibilityHint={t.a11y.guideHint}
          onPress={guide}
        />
      </View>
      <View
        style={[styles.slot, { width: size.passSlot.width, height: size.passSlot.height, backgroundColor: c.background }]}
      />
    </View>
  );
}

/** C08 row: type icon, name, description, distance and a chevron; the whole row opens guidance. */
function PlaceRow(props: SavedPlaceItemProps) {
  const { id, label, description, icon, distance, savedAt, accessibilityLabel, pending, onPress, onMore, testID } = props;
  const { theme, level } = useTheme();
  const c = theme.colors;
  const actions = usePlaceActions(props);
  const open = useCallback(() => onPress(id), [onPress, id]);
  const more = useCallback(() => onMore(id), [onMore, id]);

  return (
    <View
      testID={testID}
      style={[
        styles.row,
        { borderBottomColor: c.divider, borderBottomWidth: theme.borderWidth.hairline },
        pending ? styles.pending : null,
      ]}
    >
      <Pressable
        onPress={open}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t.a11y.rowHint}
        accessibilityState={{ disabled: pending }}
        {...actions}
        style={({ pressed }) => [
          styles.rowMain,
          { minHeight: size.listRowMin },
          level === 2 ? styles.rowStacked : null,
          pressed ? { backgroundColor: c.surfaceRaised } : null,
        ]}
      >
        <Icon name={icon} size={size.icon} color={c.textPrimary} />
        <View style={styles.rowText}>
          <Text allowFontScaling={false} style={[textStyle("rowName", level), { color: c.textPrimary }]}>
            {label}
          </Text>
          <Text allowFontScaling={false} style={[textStyle("tagMeta", level), { color: c.textSecondary }]}>
            {pending ? t.saving : `${description}${strings.common.separator}${t.savedAt(savedAt)}`}
          </Text>
        </View>
        {distance ? (
          <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textPrimary }]}>
            {distance}
          </Text>
        ) : null}
        <Icon name="chevronRight" size={size.icon} color={c.textSecondary} />
      </Pressable>
      <IconButton
        icon="more"
        accessibilityLabel={t.a11y.more(label)}
        accessibilityHint={t.a11y.moreHint}
        surface="dark"
        disabled={pending}
        onPress={more}
      />
    </View>
  );
}

/** C08 · SavedPlaceItem – `tent` pass at the top of S07 or a list `row`. */
function SavedPlaceItemBase(props: SavedPlaceItemProps) {
  return props.variant === "tent" ? <TentPass {...props} /> : <PlaceRow {...props} />;
}

export const SavedPlaceItem = memo(SavedPlaceItemBase);

const styles = StyleSheet.create({
  pass: { borderRadius: radius.pass, overflow: "hidden" },
  band: {
    minHeight: size.passBand,
    justifyContent: "center",
    paddingLeft: CONTENT_LEFT,
    paddingRight: spacing.s4,
  },
  passBody: { paddingLeft: CONTENT_LEFT, paddingRight: spacing.s3, paddingVertical: spacing.s3, gap: spacing.s3 },
  passTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.s2 },
  passText: { flex: 1, gap: spacing.s1 },
  distance: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
  slot: { position: "absolute", left: SLOT_LEFT, top: SLOT_TOP, borderRadius: radius.slot },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.s3, paddingVertical: spacing.s3 },
  rowStacked: { flexWrap: "wrap" },
  rowText: { flex: 1, gap: spacing.s1 },
  shrink: { flexShrink: 1 },
  pending: { opacity: PENDING_OPACITY },
});
