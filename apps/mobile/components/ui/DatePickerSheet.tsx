import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { dayKey, startOfDay } from '../../hooks/useCalendarEvents';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  visible: boolean;
  /** Initial anchor month shown. Defaults to current month. */
  initialDate?: Date;
  /** Currently-selected date (highlighted). */
  selectedDate?: Date | null;
  onCancel: () => void;
  /** Receives a new Date at midnight in local time. */
  onPick: (date: Date) => void;
};

function monthLabel(d: Date): string {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function buildMonthCells(anchor: Date): Array<{ date: Date; key: string; outside: boolean }> {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay()); // start on Sunday
  const cells: Array<{ date: Date; key: string; outside: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, key: dayKey(d), outside: d.getMonth() !== anchor.getMonth() });
  }
  return cells;
}

export function DatePickerSheet({ visible, initialDate, selectedDate, onCancel, onPick }: Props) {
  const [anchor, setAnchor] = useState(() => {
    const seed = initialDate ?? selectedDate ?? new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  const cells = useMemo(() => buildMonthCells(anchor), [anchor.getFullYear(), anchor.getMonth()]);
  const rows = useMemo(() => {
    const out: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);

  const todayK = dayKey(startOfDay());
  const selectedK = selectedDate ? dayKey(selectedDate) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <View style={styles.titleRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={10}
            onPress={() =>
              setAnchor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
            }
            style={({ pressed }) => [styles.arrow, pressed ? styles.arrowPressed : null]}
          >
            <Text style={styles.arrowGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.title}>{monthLabel(anchor)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={10}
            onPress={() =>
              setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
            }
            style={({ pressed }) => [styles.arrow, pressed ? styles.arrowPressed : null]}
          >
            <Text style={styles.arrowGlyph}>›</Text>
          </Pressable>
        </View>

        <View style={styles.dowRow}>
          {DOW.map((d, i) => (
            <Text key={`${d}-${i}`} style={styles.dow}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {rows.map((row, rowIdx) => (
            <View key={`r-${rowIdx}`} style={styles.row}>
              {row.map((cell) => {
                const isToday = cell.key === todayK;
                const isSelected = cell.key === selectedK;
                return (
                  <Pressable
                    key={cell.key}
                    accessibilityRole="button"
                    accessibilityLabel={cell.date.toDateString()}
                    onPress={() => {
                      const pick = new Date(cell.date);
                      pick.setHours(0, 0, 0, 0);
                      onPick(pick);
                    }}
                    style={({ pressed }) => [
                      styles.cell,
                      isToday ? styles.cellToday : null,
                      isSelected ? styles.cellSelected : null,
                      cell.outside ? styles.cellOutside : null,
                      pressed ? styles.cellPressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellNum,
                        isToday ? styles.cellNumToday : null,
                        isSelected ? styles.cellNumSelected : null,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed ? styles.cancelPressed : null]}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
  },
  grab: {
    alignSelf: 'center',
    backgroundColor: '#374151',
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    width: 36,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  arrow: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  arrowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  arrowGlyph: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '500',
    lineHeight: 30,
  },
  dowRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  dow: {
    color: colors.muted,
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  grid: {
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 44,
    justifyContent: 'center',
    margin: 2,
  },
  cellOutside: {
    opacity: 0.4,
  },
  cellToday: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  cellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cellPressed: {
    opacity: 0.7,
  },
  cellNum: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cellNumToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  cellNumSelected: {
    color: '#062b1d',
    fontWeight: '800',
  },
  cancel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 14,
    paddingVertical: 12,
  },
  cancelPressed: {
    opacity: 0.85,
  },
  cancelLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
