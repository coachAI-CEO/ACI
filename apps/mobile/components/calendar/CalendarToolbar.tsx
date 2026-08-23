import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import type { CalendarViewMode } from '../../hooks/useCalendarEvents';

type Props = {
  title: string;
  view: CalendarViewMode;
  onChangeView: (view: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

const VIEW_LABELS: Record<CalendarViewMode, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};
const VIEW_ORDER: CalendarViewMode[] = ['day', 'week', 'month'];

export function CalendarToolbar({ title, view, onChangeView, onPrev, onNext, onToday }: Props) {
  return (
    <View style={styles.toolbar}>
      <View style={styles.topRow}>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous"
            onPress={onPrev}
            style={({ pressed }) => [styles.pillGhost, pressed ? styles.pillPressed : null]}
          >
            <Text style={styles.pillGhostText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Today"
            onPress={onToday}
            style={({ pressed }) => [styles.pill, pressed ? styles.pillPressed : null]}
          >
            <Text style={styles.pillText}>Today</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            onPress={onNext}
            style={({ pressed }) => [styles.pillGhost, pressed ? styles.pillPressed : null]}
          >
            <Text style={styles.pillGhostText}>›</Text>
          </Pressable>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.seg}>
        {VIEW_ORDER.map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={`${VIEW_LABELS[mode]} view`}
            accessibilityState={{ selected: view === mode }}
            onPress={() => onChangeView(mode)}
            style={[styles.segBtn, view === mode ? styles.segBtnActive : null]}
          >
            <Text style={[styles.segText, view === mode ? styles.segTextActive : null]}>
              {VIEW_LABELS[mode]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
  },
  pillGhost: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillPressed: {
    opacity: 0.6,
  },
  pillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  pillGhostText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 2,
    alignSelf: 'stretch',
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segBtnActive: {
    backgroundColor: colors.surfaceAlt,
  },
  segText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  segTextActive: {
    color: colors.text,
  },
});