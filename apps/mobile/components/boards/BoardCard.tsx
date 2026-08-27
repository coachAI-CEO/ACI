import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../ui/Badge';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { formatGameModelLabel, formatPhaseLabel, formatZoneLabel } from '../../utils/format';
import type { BoardListItem, BoardShareMode } from '../../services/boards.service';

type Props = {
  board: BoardListItem;
  onLongPress?: () => void;
};

function shareBadge(mode: BoardShareMode | string | null | undefined): { label: string; tone: 'default' | 'amber' | 'muted' } | null {
  if (mode === 'CLUB') return { label: 'Club', tone: 'amber' };
  if (mode === 'PRIVATE') return { label: 'Private', tone: 'muted' };
  return null;
}

function formatUpdatedAt(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

export function BoardCard({ board, onLongPress }: Props) {
  const summary = board.summary;
  const share = shareBadge(board.shareMode);
  const updated = formatUpdatedAt(board.updatedAt);

  const phase = summary?.phase ? formatPhaseLabel(summary.phase) : null;
  const zone = summary?.zone ? formatZoneLabel(summary.zone) : null;
  const formationLine =
    summary?.attFormation || summary?.defFormation
      ? summary.attFormation && summary.defFormation
        ? `${summary.attFormation} vs ${summary.defFormation}`
        : summary.attFormation || summary.defFormation
      : null;

  function openBoard() {
    if (board.canEdit) {
      router.push({ pathname: '/boards/[id]/edit', params: { id: board.id } });
      return;
    }
    router.push({ pathname: '/boards/[id]', params: { id: board.id } });
  }

  return (
    <Pressable
      onPress={openBoard}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Open board ${board.title || 'Untitled'}`}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {board.title || 'Untitled board'}
        </Text>
        {board.favorited ? <Text style={styles.star}>★</Text> : null}
      </View>

      {(phase || zone || formationLine) ? (
        <View style={styles.chips}>
          {phase ? <Badge label={phase} /> : null}
          {zone ? <Badge label={zone} tone="muted" /> : null}
          {formationLine ? <Badge label={formationLine} tone="muted" /> : null}
        </View>
      ) : null}

      <Text style={styles.meta} numberOfLines={1}>
        {board.ageGroup || '--'} · {board.gameModelId ? formatGameModelLabel(board.gameModelId) : '--'}
        {summary?.slideCount ? ` · ${summary.slideCount} slide${summary.slideCount === 1 ? '' : 's'}` : ''}
        {updated ? ` · ${updated}` : ''}
      </Text>

      <View style={styles.footer}>
        {share ? <Badge label={share.label} tone={share.tone} /> : <View style={styles.spacer} />}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              board.canEdit
                ? `Edit ${board.title || 'Untitled'} in the editor`
                : `Open ${board.title || 'Untitled'}`
            }
            hitSlop={8}
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.primaryBtnPressed : null]}
            onPress={openBoard}
          >
            <Text style={styles.primaryBtnLabel}>{board.canEdit ? 'Edit' : 'Open'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit on web"
            hitSlop={8}
            style={({ pressed }) => [styles.webLink, pressed ? styles.webLinkPressed : null]}
            onPress={() => void Linking.openURL(webPath(`/board/${board.id}`))}
          >
            <Text style={styles.webLinkLabel}>Web</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  cardPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  title: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' },
  star: { color: colors.warning, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { color: colors.muted, fontSize: 12 },
  footer: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  spacer: { flex: 0 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  primaryBtnPressed: { opacity: 0.75 },
  primaryBtnLabel: { color: '#052e16', fontSize: 13, fontWeight: '800' },
  webLink: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  webLinkPressed: { opacity: 0.7 },
  webLinkLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
