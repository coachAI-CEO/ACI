import type { CalendarEvent } from '@aci/shared';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { dayKey } from '../../hooks/useCalendarEvents';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_BARS_PER_DAY = 3;

type Props = {
  rangeStart: Date;
  events: CalendarEvent[];
  anchorMonth: number;
  todayKey: string;
  selectedKey?: string | null;
  onPressDay?: (date: Date, dayEvents: CalendarEvent[]) => void;
};

function MonthGridBase({ rangeStart, events, anchorMonth, todayKey, selectedKey, onPressDay }: Props) {
  const rows = useMemo(() => chunkRows(buildCells(rangeStart), 7), [rangeStart.getTime()]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const when = event.scheduledDate || event.startAt || event.date;
      if (!when) continue;
      const d = new Date(when);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  return (
    <View style={styles.root}>
      <View style={styles.dowRow}>
        {DOW_LABELS.map((label) => (
          <Text key={label} style={styles.dow}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={row[0]?.key ?? rowIdx} style={styles.row}>
            {row.map((cell) => {
              const dayEvents = eventsByDay.get(cell.key) ?? [];
              const visible = dayEvents.slice(0, MAX_BARS_PER_DAY);
              const overflow = Math.max(0, dayEvents.length - visible.length);
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedKey;
              const isOutside = cell.date.getMonth() !== anchorMonth;
              return (
                <Pressable
                  key={cell.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.date.toDateString()}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
                  onPress={() => onPressDay?.(cell.date, dayEvents)}
                  style={({ pressed }) => [
                    styles.cell,
                    isToday ? styles.cellToday : null,
                    isSelected && !isToday ? styles.cellSelected : null,
                    isOutside ? styles.cellOutside : null,
                    pressed ? styles.cellPressed : null,
                  ]}
                >
                  <Text style={[styles.cellNum, isToday ? styles.cellNumToday : null]}>{cell.date.getDate()}</Text>
                  {visible.length > 0 ? (
                    <View style={styles.barStack} pointerEvents="none">
                      {visible.map((event, idx) => {
                        const stateStyle =
                          event.cancelled ? styles.barCancel : event.completed ? styles.barDone : null;
                        return <View key={event.id ?? `${cell.key}-${idx}`} style={[styles.bar, stateStyle]} />;
                      })}
                      {overflow > 0 ? <Text style={styles.overflow}>+{overflow}</Text> : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export const MonthGrid = memo(MonthGridBase);

function buildCells(rangeStart: Date): { date: Date; key: string }[] {
  const cells: { date: Date; key: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    cells.push({ date: d, key: dayKey(d) });
  }
  return cells;
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  dowRow: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  dow: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  grid: {
    flex: 1,
    minHeight: 0,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
    paddingTop: 6,
    paddingBottom: 5,
    justifyContent: 'space-between',
  },
  cellOutside: {
    opacity: 0.45,
  },
  cellToday: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  cellSelected: {
    borderColor: '#60A5FA',
    borderWidth: 1.5,
  },
  cellPressed: {
    opacity: 0.7,
  },
  cellNum: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  cellNumToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  barStack: {
    gap: 3,
  },
  bar: {
    height: 5,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
  },
  barDone: {
    backgroundColor: colors.muted,
    opacity: 0.5,
  },
  barCancel: {
    backgroundColor: colors.danger,
  },
  overflow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
});
