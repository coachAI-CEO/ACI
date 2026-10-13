import type { CalendarEvent } from '@aci/shared';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '../ui/Card';
import { colors } from '../../constants/colors';
import { dayKey } from '../../hooks/useCalendarEvents';
import {
  formatDateTimeLine,
  formatEventTime,
  formatEventTitle,
} from '../../utils/format';

type Props = {
  events: CalendarEvent[];
  todayKey: string;
  onPressEvent?: (event: CalendarEvent) => void;
};

function DayAgendaBase({ events, todayKey, onPressEvent }: Props) {
  const groups = useMemo(() => groupByDay(events), [events]);

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No upcoming events.</Text>
        <Text style={styles.emptyHint}>Tap + to schedule a session.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => {
        const isToday = group.key === todayKey;
        return (
          <Card key={group.key} variant="default" compact>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLine}>
                  {formatDateTimeLine(group.date.toISOString()).split(' · ')[0]}
                </Text>
                {isToday ? <Text style={styles.todayBadge}>Today</Text> : null}
              </View>
              <Text style={styles.count}>
                {group.events.length} event{group.events.length === 1 ? '' : 's'}
              </Text>
            </View>
            {group.events.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={formatEventTitle(event)}
                onPress={() => onPressEvent?.(event)}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
              >
                <Text style={[styles.time, event.cancelled ? styles.timeCancel : null]}>
                  {formatEventTime(event.scheduledDate)}
                </Text>
                <View style={styles.body}>
                  <Text
                    style={[
                      styles.title,
                      event.completed ? styles.titleDone : null,
                      event.cancelled ? styles.titleCancel : null,
                    ]}
                    numberOfLines={2}
                  >
                    {formatEventTitle(event)}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {buildMetaLine(event)}
                  </Text>
                  {event.sessionId ? (
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Start practice"
                        onPress={() =>
                          router.push({
                            pathname: '/sideline/[sessionId]',
                            params: { sessionId: String(event.sessionId) },
                          })
                        }
                        style={styles.actionLink}
                      >
                        <Text style={styles.actionText}>Start practice →</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

export const DayAgenda = memo(DayAgendaBase);

function buildMetaLine(event: CalendarEvent): string {
  const parts: string[] = [];
  if (event.durationMin) parts.push(`${event.durationMin} min`);
  if (event.location) parts.push(`📍 ${event.location}`);
  if (event.teamName) parts.push(`👥 ${event.teamName}`);
  if (event.cancelled) parts.push('Cancelled');
  else if (event.completed) parts.push('Completed');
  return parts.join(' · ');
}

function groupByDay(events: CalendarEvent[]): { date: Date; key: string; events: CalendarEvent[] }[] {
  const map = new Map<string, { date: Date; events: CalendarEvent[] }>();
  for (const event of events) {
    const when = event.scheduledDate || event.startAt || event.date;
    if (!when) continue;
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    const entry = map.get(key);
    if (entry) entry.events.push(event);
    else map.set(key, { date: d, events: [event] });
  }
  const groups = Array.from(map.entries()).map(([key, value]) => ({
    key,
    date: value.date,
    events: value.events,
  }));
  groups.sort((a, b) => a.date.getTime() - b.date.getTime());
  return groups;
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 4,
    gap: 10,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 4,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyHint: {
    color: colors.muted,
    fontSize: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  dateLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  todayBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  count: {
    color: colors.muted,
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
  },
  rowPressed: {
    opacity: 0.6,
  },
  time: {
    width: 56,
    flexShrink: 0,
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  timeCancel: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  body: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  titleDone: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  titleCancel: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  meta: {
    color: colors.muted,
    fontSize: 11.5,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  actionLink: {
    paddingVertical: 0,
  },
  actionText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
});