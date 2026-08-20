import type { CalendarEvent } from '@aci/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  event: CalendarEvent;
};

function formatDate(dateValue: string | undefined): string {
  if (!dateValue) {
    return 'TBD';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function UpcomingEventItem({ event }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{event.title || 'Training Session'}</Text>
      <Text style={styles.time}>{formatDate(event.startAt || event.date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
});
