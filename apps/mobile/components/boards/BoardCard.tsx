import { Link, router } from 'expo-router';
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

  function openDetail() {
    if (board.canEdit) {
      router.push({ pathname: '/boards/[id]/edit', params: { id: board.id } });
      return;
    }
    router.push({ pathname: '/boards/[id]', params: { id: board.id } });
  }

  function openEditor() {
    router.push({ pathname: '/boards/[id]/edit', params: { id: board.id } });
  }

  return (
    <Pressable
      onPress={openDetail}
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
            accessibilityLabel="Edit on web"
            style={({ pressed }) => [styles.actionBtn, pressed ? styles.actionBtnPressed : null]}
            onPress={() => void Linking.openURL(webPath(`/board/${board.id}`))}
          >
            <Text style={styles.editBtnLabel}>Edit on web</Text>
          </Pressable>
          {board.canEdit ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Edit ${board.title || 'Untitled'} in the editor`}
              style={({ pressed }) => [styles.editLink, pressed ? styles.editLinkPressed : null]}
              onPress={openEditor}
            >
              Edit →
            </Pressable>
          ) : (
            <Link
              href={{ pathname: '/boards/[id]', params: { id: board.id } }}
              style={styles.editLink}
            >
              Open →
            </Link>
          )}
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
  actions: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  actionBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnPressed: { opacity: 0.7 },
  editBtnLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  editLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 8,
  },
  editLinkPressed: { opacity: 0.7 },
});
