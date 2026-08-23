import type { CalendarEvent } from '@aci/shared';
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { dayKey } from '../../hooks/useCalendarEvents';
import { formatCompactDay, formatEventTime, formatEventTitle } from '../../utils/format';

type Props = {
  weekStart: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  todayKey: string;
  onPressEvent?: (event: CalendarEvent) => void;
};

function WeekStripBase({ weekStart, eventsByDay, todayKey, onPressEvent }: Props) {
  const days = useMemo(() => buildWeekDays(weekStart), [weekStart.getTime()]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {days.map((day) => {
        const dayEvents = eventsByDay.get(day.key) ?? [];
        const isToday = day.key === todayKey;
        return (
          <View key={day.key} style={styles.col}>
            <View style={[styles.colHeader, isToday ? styles.colHeaderToday : null]}>
              <Text style={[styles.dowText, isToday ? styles.dowTextToday : null]}>
                {formatCompactDay(day.date.toISOString()).split(' ')[0]}
              </Text>
              <Text style={[styles.dayText, isToday ? styles.dayTextToday : null]}>
                {day.date.getDate()}
              </Text>
            </View>
            {dayEvents.length === 0 ? (
              <Text style={styles.empty}>—</Text>
            ) : (
              dayEvents.map((event) => {
                const stateStyle = event.cancelled
                  ? styles.blockCancel
                  : event.completed
                    ? styles.blockDone
                    : null;
                return (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityLabel={formatEventTitle(event)}
                    onPress={() => onPressEvent?.(event)}
                    style={[styles.block, stateStyle]}
                  >
                    <Text style={styles.blockWhen}>{formatEventTime(event.scheduledDate)}</Text>
                    <Text style={styles.blockTitle} numberOfLines={3}>
                      {formatEventTitle(event)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

export const WeekStrip = memo(WeekStripBase);

function buildWeekDays(weekStart: Date): { date: Date; key: string }[] {
  const days: { date: Date; key: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push({ date: d, key: dayKey(d) });
  }
  return days;
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 4,
    gap: 4,
  },
  col: {
    width: 130,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
    minHeight: 320,
  },
  colHeader: {
    paddingBottom: 4,
    borderBottomColor: colors.border,
    borderBottomWidth: 0.5,
    alignItems: 'center',
  },
  colHeaderToday: {
    borderBottomColor: colors.primary,
  },
  dowText: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dowTextToday: {
    color: colors.primary,
  },
  dayText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  dayTextToday: {
    color: colors.primary,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 12,
  },
  block: {
    backgroundColor: 'rgba(96,165,250,0.16)',
    borderLeftColor: '#60A5FA',
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  blockDone: {
    backgroundColor: 'rgba(156,163,175,0.16)',
    borderLeftColor: colors.muted,
    opacity: 0.7,
  },
  blockCancel: {
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderLeftColor: colors.danger,
  },
  blockWhen: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '700',
  },
  blockTitle: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
});