import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { DropdownCell, DropdownRow } from '../ui/DropdownCell';
import { PickerSheet } from '../ui/PickerSheet';

type Props = {
  visible: boolean;
  title?: string;
  initialDate?: Date;
  durationMin?: number;
  onCancel: () => void;
  onConfirm: (payload: { scheduledAt: Date; durationMin: number }) => void;
  loading?: boolean;
  /** Allow caller to lock duration (hides the row). Defaults to showing it. */
  hideDuration?: boolean;
};

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
  { value: '75', label: '75 min' },
  { value: '90', label: '90 min' },
];

const TIME_OPTIONS = (() => {
  const out: Array<{ value: string; label: string }> = [];
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 30]) {
      const hour12 = ((h + 11) % 12) + 1;
      const mm = m.toString().padStart(2, '0');
      const suffix = h < 12 ? 'AM' : 'PM';
      out.push({ value: `${h.toString().padStart(2, '0')}:${mm}`, label: `${hour12}:${mm} ${suffix}` });
    }
  }
  return out;
})();

function formatDateForSheet(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeForSheet(d: Date): string {
  return d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildDateOptions(anchor: Date, days = 60): Array<{ value: string; label: string; sublabel?: string }> {
  const out: Array<{ value: string; label: string; sublabel?: string }> = [];
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const value = d.toISOString();
    out.push({
      value,
      label: d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      sublabel: d.toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    });
  }
  return out;
}

export function ScheduleSessionSheet({
  visible,
  title = 'Schedule session',
  initialDate,
  durationMin = 60,
  onCancel,
  onConfirm,
  loading,
  hideDuration,
}: Props) {
  const [scheduledAt, setScheduledAt] = useState(() => {
    const seed = initialDate ?? new Date();
    return new Date(seed);
  });
  const [duration, setDuration] = useState(String(durationMin));
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [durationSheetOpen, setDurationSheetOpen] = useState(false);

  const dateOptions = useMemo(() => buildDateOptions(scheduledAt), [scheduledAt]);

  const onPickDate = (value: string) => {
    const next = new Date(value);
    const merged = new Date(scheduledAt);
    merged.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
    setScheduledAt(merged);
    setDateSheetOpen(false);
  };

  const onPickTime = (value: string) => {
    const [hh, mm] = value.split(':').map(Number);
    const next = new Date(scheduledAt);
    next.setHours(hh, mm, 0, 0);
    setScheduledAt(next);
    setTimeSheetOpen(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Pick a date and time, then confirm.</Text>

        <DropdownRow>
          <DropdownCell
            fullWidth
            label="Date"
            value={formatDateForSheet(scheduledAt)}
            pairLeft={false}
            onPress={() => {
              setDateSheetOpen(true);
              setTimeSheetOpen(false);
              setDurationSheetOpen(false);
            }}
          />
        </DropdownRow>
        <DropdownRow>
          <DropdownCell
            fullWidth
            label="Time"
            value={formatTimeForSheet(scheduledAt)}
            pairLeft={false}
            onPress={() => {
              setTimeSheetOpen(true);
              setDateSheetOpen(false);
              setDurationSheetOpen(false);
            }}
          />
        </DropdownRow>

        {!hideDuration ? (
          <DropdownRow>
            <DropdownCell
              fullWidth
              label="Duration"
              value={duration ? `${duration} min` : 'Pick'}
              pairLeft={false}
              onPress={() => {
                setDurationSheetOpen(true);
                setDateSheetOpen(false);
                setTimeSheetOpen(false);
              }}
            />
          </DropdownRow>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm schedule"
          disabled={Boolean(loading)}
          onPress={() =>
            onConfirm({
              scheduledAt,
              durationMin: Math.max(15, Number(duration) || durationMin || 60),
            })
          }
          style={({ pressed }) => [
            styles.confirm,
            pressed ? styles.confirmPressed : null,
            loading ? styles.confirmDisabled : null,
          ]}
        >
          <Text style={styles.confirmLabel}>{loading ? 'Scheduling…' : 'Confirm schedule'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed ? styles.cancelPressed : null]}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>

        <PickerSheet
          visible={dateSheetOpen}
          title="Pick a date"
          subTitle={`From ${formatDateForSheet(scheduledAt)}`}
          options={dateOptions}
          selectedValue={scheduledAt.toISOString()}
          onCancel={() => setDateSheetOpen(false)}
          onPick={onPickDate}
        />
        <PickerSheet
          visible={timeSheetOpen}
          title="Pick a time"
          subTitle={`Currently ${formatTimeForSheet(scheduledAt)}`}
          options={TIME_OPTIONS}
          selectedValue={`${scheduledAt.getHours().toString().padStart(2, '0')}:${scheduledAt
            .getMinutes()
            .toString()
            .padStart(2, '0')}`}
          onCancel={() => setTimeSheetOpen(false)}
          onPick={onPickTime}
        />
        <PickerSheet
          visible={durationSheetOpen}
          title="Pick a duration"
          options={DURATION_OPTIONS}
          selectedValue={duration}
          onCancel={() => setDurationSheetOpen(false)}
          onPick={(value) => {
            setDuration(value);
            setDurationSheetOpen(false);
          }}
        />
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
    gap: 6,
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
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  confirm: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 14,
  },
  confirmDisabled: {
    opacity: 0.6,
  },
  confirmPressed: {
    opacity: 0.85,
  },
  confirmLabel: {
    color: '#062b1d',
    fontSize: 16,
    fontWeight: '800',
  },
  cancel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 8,
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
