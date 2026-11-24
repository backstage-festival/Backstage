import { useCallback } from "react";
import { FlatList, type ListRenderItem, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PlaceMenuSheet } from "@/components/PlaceMenuSheet";
import { PlanNoteRow } from "@/components/PlanNoteRow";
import { SavedPlaceItem } from "@/components/SavedPlaceItem";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenState, type ScreenStateKind } from "@/components/ScreenState";
import { SectionHeader } from "@/components/SectionHeader";
import type { TentRow } from "@/hooks/tentRows";
import { type TentScreen as TentScreenData, useTentScreen } from "@/hooks/useTentScreen";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

const t = strings.tent;

const keyOf = (row: TentRow): string => row.key;

/** Whole-screen state only when there is no list to show (X-Stan). */
function stateFor(screen: TentScreenData): ScreenStateKind | null {
  if (screen.count > 0) return null;
  if (screen.loadStatus === "idle" || screen.loadStatus === "loading") return { kind: "loading" };
  const error = screen.lastError;
  if (error?.kind === "noLocation") {
    return {
      kind: "message",
      empty: {
        kind: "loadError",
        eyebrow: t.noLocation.eyebrow,
        title: t.noLocation.title,
        body: error.permissionDenied ? t.noLocation.bodyPermission : t.noLocation.body,
        primary: error.permissionDenied
          ? { label: t.noLocation.openSettings, onPress: screen.openSettings, prominent: true }
          : { label: t.noLocation.retry, onPress: screen.savePosition, prominent: true },
      },
    };
  }
  if (screen.loadStatus === "error") {
    return {
      kind: "message",
      empty: {
        kind: "loadError",
        eyebrow: t.note.loadFailed,
        title: t.note.loadFailed,
        body: t.note.loadFailedA11y,
        primary: { label: t.noLocation.retry, onPress: screen.reload, prominent: true },
      },
    };
  }
  return {
    kind: "message",
    empty: {
      kind: "noPlaces",
      eyebrow: t.count(0),
      title: t.empty.title,
      body: t.empty.body,
      primary: {
        label: t.savePosition,
        onPress: screen.savePosition,
        prominent: true,
        icon: "pin",
        ...(screen.saving ? { disabledReason: t.locating } : null),
      },
    },
  };
}

interface TentHeaderProps {
  count: number;
  screen: TentScreenData;
}

/** S07 top: title, counter, inline note and the tent pass. */
function TentHeader({ count, screen }: TentHeaderProps) {
  const { theme, level } = useTheme();
  const { note, tent } = screen;
  return (
    <View style={styles.header}>
      <ScreenHeader
        title={t.title}
        accessory={
          <Text allowFontScaling={false} style={[textStyle("eyebrow", level), { color: theme.colors.textSecondary }]}>
            {t.count(count)}
          </Text>
        }
      />
      {note ? (
        <PlanNoteRow
          label={note.label}
          accessibilityLabel={note.accessibilityLabel}
          tone="error"
          {...(note.action ? { action: note.action } : null)}
          onDismiss={screen.clearError}
        />
      ) : null}
      {tent ? (
        <SavedPlaceItem
          {...tent}
          onPress={screen.openPlace}
          onGuide={screen.openPlace}
          onMore={screen.openMenu}
          onRename={screen.openRename}
          onDelete={screen.askDelete}
        />
      ) : null}
    </View>
  );
}

/** S07 · Namiot – saved places with the tent pass, guidance works offline. */
export default function TentScreen() {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const screen = useTentScreen();
  const { openPlace, openMenu, openRename, askDelete } = screen;

  const renderItem = useCallback<ListRenderItem<TentRow>>(
    ({ item }) =>
      item.type === "header" ? (
        <SectionHeader label={item.label} />
      ) : (
        <SavedPlaceItem {...item.item} onPress={openPlace} onGuide={openPlace} onMore={openMenu} onRename={openRename} onDelete={askDelete} />
      ),
    [openPlace, openMenu, openRename, askDelete],
  );

  const state = stateFor(screen);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={["top"]}>
      {state ? (
        <ScreenState title={t.title} state={state} />
      ) : (
        <>
          {/* Height depends on the text (names wrap), so no getItemLayout. */}
          <FlatList
            data={screen.rows}
            keyExtractor={keyOf}
            renderItem={renderItem}
            ListHeaderComponent={<TentHeader count={screen.count} screen={screen} />}
            contentContainerStyle={styles.list}
          />
          <View style={[styles.footer, { borderTopColor: c.divider, borderTopWidth: theme.borderWidth.hairline }]}>
            <Button
              label={t.savePosition}
              variant="primary"
              surface="dark"
              icon="pin"
              disabled={screen.saving}
              {...(screen.saving ? { disabledReason: t.locating } : null)}
              width="fill"
              accessibilityHint={t.a11y.saveHint}
              onPress={screen.savePosition}
            />
            <Text allowFontScaling={false} style={[textStyle("statusMeta", level), { color: c.textSecondary }]}>
              {screen.gpsMeta}
            </Text>
          </View>
        </>
      )}

      {screen.menu ? (
        <PlaceMenuSheet
          key={`${screen.menu.placeId}-${String(screen.menu.renaming)}`}
          visible
          label={screen.menu.label}
          startRenaming={screen.menu.renaming}
          onRename={screen.rename}
          onDelete={screen.deleteFromMenu}
          onClose={screen.closeMenu}
        />
      ) : null}
      <ConfirmDialog
        visible={screen.confirm !== null}
        title={t.confirm.title(screen.confirm?.label ?? "")}
        body={t.confirm.body}
        cancelLabel={t.confirm.keep}
        confirmLabel={t.confirm.delete}
        onCancel={screen.cancelDelete}
        onConfirm={screen.confirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: spacing.s4, paddingBottom: spacing.s2 },
  list: { padding: spacing.screen },
  footer: { paddingHorizontal: spacing.screen, paddingVertical: spacing.s3, gap: spacing.s2 },
});
