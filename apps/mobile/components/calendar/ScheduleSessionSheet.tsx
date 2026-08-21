import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Props = {
  visible: boolean;
  title?: string;
  initialDate?: Date;
  durationMin?: number;
  onCancel: () => void;
  onConfirm: (payload: { scheduledAt: Date; durationMin: number }) => void;
  loading?: boolean;
};

function formatPreview(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ScheduleSessionSheet({
  visible,
  title = 'Schedule session',
  initialDate,
  durationMin = 60,
  onCancel,
  onConfirm,
  loading,
}: Props) {
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (initialDate) return initialDate;
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(16, 0, 0, 0);
    return next;
  });
  const [duration, setDuration] = useState(String(durationMin));
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === 'ios');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.preview}>{formatPreview(scheduledAt)}</Text>

        {Platform.OS === 'android' ? (
          <View style={styles.row}>
            <Button title="Pick date" onPress={() => setShowDatePicker(true)} variant="secondary" />
            <Button title="Pick time" onPress={() => setShowTimePicker(true)} variant="secondary" />
          </View>
        ) : null}

        {showDatePicker ? (
          <DateTimePicker
            value={scheduledAt}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            onChange={(_, date) => {
              if (Platform.OS === 'android') setShowDatePicker(false);
              if (!date) return;
              setScheduledAt((current) => {
                const next = new Date(current);
                next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                return next;
              });
            }}
          />
        ) : null}

        {showTimePicker || Platform.OS === 'ios' ? (
          <DateTimePicker
            value={scheduledAt}
            mode="time"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            onChange={(_, date) => {
              if (Platform.OS === 'android') setShowTimePicker(false);
              if (!date) return;
              setScheduledAt((current) => {
                const next = new Date(current);
                next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                return next;
              });
            }}
          />
        ) : null}

        <Input label="Duration (minutes)" value={duration} onChangeText={setDuration} placeholder="60" />

        <Button
          title="Confirm schedule"
          loading={loading}
          onPress={() =>
            onConfirm({
              scheduledAt,
              durationMin: Math.max(15, Number(duration) || durationMin || 60),
            })
          }
        />
        <Button title="Cancel" onPress={onCancel} variant="secondary" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 12,
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  preview: {
    color: colors.muted,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
