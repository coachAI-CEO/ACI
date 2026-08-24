import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOARD_SEQUENCE_DEFAULT_DURATION_MS } from '@aci/shared';
import type { WebDiagramSequence, WebDiagramSequenceFrame } from '@aci/shared';
import { colors } from '../../constants/colors';

type Props = {
  /** Sequence pulled from the diagram. If null/empty, the bar is hidden. */
  sequence: WebDiagramSequence | null | undefined;
  /** Currently displayed frame index. */
  activeIndex: number;
  /** Called when the user taps a frame chip. */
  onSelect: (index: number) => void;
  /** Optional frame note shown to the right of the chips on the active row. */
  showNote?: boolean;
};

/**
 * Frame timeline for the tactical board viewer.
 *
 * Mirrors the web's `BoardSequenceBar`:
 *   - Title chips for each frame ("Frame 1", "Frame 2"…) with the active
 *     frame highlighted.
 *   - Dot row underneath the title bar; the active dot is wider.
 *   - Prev / Next buttons + an autoplay toggle.
 *   - Auto-advance on the active frame's `durationMs` (defaults to
 *     `BOARD_SEQUENCE_DEFAULT_DURATION_MS`).
 *   - Frame `note` rendered inline below the bar when present.
 */
export function BoardSequenceBar({ sequence, activeIndex, onSelect, showNote = true }: Props) {
  const frames = sequence?.frames || [];
  if (!frames.length) return null;

  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop autoplay when the active frame changes underneath us (e.g. parent
  // resets it) so we don't double-advance.
  useEffect(() => {
    if (!playing) return;
    const f = frames[activeIndex];
    const ms = f?.durationMs ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS;
    timer.current = setTimeout(() => {
      const next = activeIndex + 1;
      if (next >= frames.length) {
        // Stop at the end (matches web behaviour; coach can hit play again).
        setPlaying(false);
        return;
      }
      onSelect(next);
    }, ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeIndex, frames.length]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    // If we're at the end, restart from frame 0.
    if (activeIndex >= frames.length - 1) {
      onSelect(0);
    }
    setPlaying(true);
  }

  const goPrev = () => {
    if (activeIndex > 0) onSelect(activeIndex - 1);
  };
  const goNext = () => {
    if (activeIndex < frames.length - 1) onSelect(activeIndex + 1);
  };

  const activeFrame: WebDiagramSequenceFrame | undefined = frames[activeIndex];

  return (
    <View style={styles.wrap}>
      <View style={styles.controlsRow}>
        <View style={styles.controlsLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous frame"
            onPress={goPrev}
            disabled={activeIndex === 0}
            style={({ pressed }) => [
              styles.iconBtn,
              activeIndex === 0 ? styles.iconBtnDisabled : null,
              pressed && activeIndex > 0 ? styles.iconBtnPressed : null,
            ]}
          >
            <Text style={styles.iconBtnLabel}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            onPress={togglePlay}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.iconBtnPrimary,
              pressed ? styles.iconBtnPressed : null,
            ]}
          >
            <Text style={[styles.iconBtnLabel, styles.iconBtnLabelPrimary]}>
              {playing ? '❚❚' : '▶'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next frame"
            onPress={goNext}
            disabled={activeIndex === frames.length - 1}
            style={({ pressed }) => [
              styles.iconBtn,
              activeIndex === frames.length - 1 ? styles.iconBtnDisabled : null,
              pressed && activeIndex < frames.length - 1 ? styles.iconBtnPressed : null,
            ]}
          >
            <Text style={styles.iconBtnLabel}>›</Text>
          </Pressable>
        </View>

        <ScrollRow>
          {frames.map((f, i) => {
            const selected = i === activeIndex;
            return (
              <Pressable
                key={f.id || `frame-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Go to frame ${i + 1}`}
                accessibilityState={{ selected }}
                onPress={() => onSelect(i)}
                style={({ pressed }) => [
                  styles.chip,
                  selected ? styles.chipSelected : null,
                  pressed && !selected ? styles.chipPressed : null,
                ]}
              >
                <Text
                  style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}
                  numberOfLines={1}
                >
                  {f.title || `Frame ${i + 1}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollRow>
      </View>

      <View style={styles.dotsRow}>
        {frames.map((f, i) => (
          <Pressable
            key={f.id || `dot-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`Go to frame ${i + 1}`}
            onPress={() => onSelect(i)}
            style={[styles.dot, i === activeIndex ? styles.dotActive : null]}
          />
        ))}
        <Text style={styles.counter}>
          {activeIndex + 1} / {frames.length}
        </Text>
      </View>

      {showNote && activeFrame?.note ? (
        <Text style={styles.note} numberOfLines={2}>
          {activeFrame.note}
        </Text>
      ) : null}
    </View>
  );
}

// Lightweight horizontal scroll without importing ScrollView (keeps the bar
// self-contained — no scroll chaining, no ref plumbing in the parent).
function ScrollRow({ children }: { children: React.ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ScrollView } = require('react-native');
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsScroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 4 },
  controlsRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  controlsLeft: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    minWidth: 36,
  },
  iconBtnPressed: { opacity: 0.7 },
  iconBtnDisabled: { opacity: 0.35 },
  iconBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconBtnLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  iconBtnLabelPrimary: { color: '#062816' },
  chipsScroll: { gap: 6, paddingRight: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipPressed: { opacity: 0.7 },
  chipSelected: { backgroundColor: '#14381f', borderColor: colors.primary },
  chipLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipLabelSelected: { color: colors.primary, fontWeight: '800' },
  dotsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-start',
  },
  dot: { backgroundColor: colors.border, borderRadius: 999, height: 6, width: 6 },
  dotActive: { backgroundColor: colors.primary, width: 16 },
  counter: { color: colors.muted, fontSize: 11, marginLeft: 6 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 16 },
});
