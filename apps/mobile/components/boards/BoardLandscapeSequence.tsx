import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type FrameChip = {
  id?: string;
  title?: string | null;
};

type Props = {
  frames: FrameChip[];
  activeIndex: number;
  playing: boolean;
  canAdd: boolean;
  onSelect: (index: number) => void;
  onRename: (index: number, title: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePlay: () => void;
};

/**
 * Bottom sequence strip for landscape — Play · named phases · frame actions.
 * Matches Gemini TacticsLab footer chrome.
 */
export function BoardLandscapeSequence({
  frames,
  activeIndex,
  playing,
  canAdd,
  onSelect,
  onRename,
  onAdd,
  onDuplicate,
  onDelete,
  onTogglePlay,
}: Props) {
  return (
    <View style={styles.wrap} accessibilityLabel="Frame sequence">
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause sequence' : 'Play sequence'}
          onPress={onTogglePlay}
          style={({ pressed }) => [styles.playBtn, playing ? styles.playBtnOn : null, pressed ? { opacity: 0.85 } : null]}
        >
          <Text style={styles.playLabel}>{playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Text style={styles.meta}>
          <Text style={styles.metaStrong}>{activeIndex + 1}</Text>/{Math.max(frames.length, 1)}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.phases}
        style={styles.phasesScroll}
      >
        {frames.map((f, i) => {
          const active = i === activeIndex;
          const name = f.title?.trim() || `Frame ${i + 1}`;
          return (
            <Pressable
              key={f.id || `phase-${i}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(i)}
              onLongPress={() => onRename(i, name)}
              style={[styles.phase, active ? styles.phaseActive : null]}
            >
              <View style={styles.phaseHead}>
                <Text style={[styles.phaseIdx, active ? styles.phaseIdxActive : null]}>{i + 1}</Text>
                {active ? <View style={styles.phaseDot} /> : null}
              </View>
              <Text style={[styles.phaseName, active ? styles.phaseNameActive : null]} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add frame"
          disabled={!canAdd}
          onPress={onAdd}
          style={[styles.actionBtn, !canAdd ? styles.actionDisabled : null]}
        >
          <Text style={styles.actionLabel}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Duplicate frame"
          disabled={!canAdd}
          onPress={onDuplicate}
          style={[styles.actionBtn, !canAdd ? styles.actionDisabled : null]}
        >
          <Text style={styles.actionLabel}>Dup</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete frame"
          disabled={frames.length <= 1}
          onPress={onDelete}
          style={[styles.actionIcon, frames.length <= 1 ? styles.actionDisabled : null]}
        >
          <Text style={styles.actionIconLabel}>⌫</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  left: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  playBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  playBtnOn: { backgroundColor: '#f59e0b' },
  playLabel: { color: '#052e16', fontSize: 11, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 10 },
  metaStrong: { color: colors.text, fontWeight: '800' },
  phasesScroll: { flex: 1, minWidth: 0 },
  phases: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingRight: 4 },
  phase: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  phaseActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  phaseHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  phaseIdx: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  phaseIdxActive: { color: colors.primary },
  phaseDot: { backgroundColor: colors.primary, borderRadius: 999, height: 4, width: 4 },
  phaseName: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  phaseNameActive: { color: colors.text },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  actionIcon: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  actionDisabled: { opacity: 0.35 },
  actionLabel: { color: colors.text, fontSize: 10, fontWeight: '700' },
  actionIconLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
});
