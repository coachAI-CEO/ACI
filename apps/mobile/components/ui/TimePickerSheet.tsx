import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  visible: boolean;
  initialDate?: Date;
  /** Currently-selected date. */
  selectedDate?: Date;
  onCancel: () => void;
  /** Receives a new Date with the picked hour/minute applied (preserves date). */
  onPick: (date: Date) => void;
};

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/** Convert 0–23 hour into the 12-hour display value (1–12). */
function hour12(h: number): number {
  return ((h + 11) % 12) + 1;
}
function ampmFor(h: number): 'AM' | 'PM' {
  return h < 12 ? 'AM' : 'PM';
}
function formatHourLabel(h12: number): string {
  return h12.toString();
}

export function TimePickerSheet({ visible, initialDate, selectedDate, onCancel, onPick }: Props) {
  const [hour, setHour] = useState<number>(() => {
    const seed = initialDate ?? selectedDate ?? new Date();
    return seed.getHours();
  });
  const [minute, setMinute] = useState<number>(() => {
    const seed = initialDate ?? selectedDate ?? new Date();
    // Round to nearest 5
    const m = seed.getMinutes();
    return Math.round(m / 5) * 5;
  });
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');

  const hour12Val = hour12(hour);
  const ampm = ampmFor(hour);

  const hourDisplay = useMemo(() => `${hour12Val}`.padStart(2, '0'), [hour12Val]);
  const minuteDisplay = useMemo(() => `${minute}`.padStart(2, '0'), [minute]);

  const onToggleAmPm = () => {
    setHour((h) => (h + 12) % 24);
  };

  const onPickHour = (h: number) => {
    setHour(h);
    setMode('minute');
  };

  const onPickMinute = (m: number) => {
    setMinute(m);
    finalize(hour, m);
  };

  const finalize = (h: number, m: number) => {
    const next = new Date(selectedDate ?? initialDate ?? new Date());
    next.setHours(h, m, 0, 0);
    onPick(next);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.title}>Pick a time</Text>

        <View style={styles.displayRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hour ${hourDisplay}, tap to edit`}
            onPress={() => setMode('hour')}
            style={({ pressed }) => [styles.bigCell, mode === 'hour' ? styles.bigCellActive : null, pressed ? styles.bigCellPressed : null]}
          >
            <Text style={[styles.bigText, mode === 'hour' ? styles.bigTextActive : styles.bigTextInactive]}>{hourDisplay}</Text>
            <Text style={[styles.bigCellLabel, mode === 'hour' ? styles.bigCellLabelActive : null]}>Hour</Text>
          </Pressable>
          <Text style={styles.colon}>:</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Minute ${minuteDisplay}, tap to edit`}
            onPress={() => setMode('minute')}
            style={({ pressed }) => [styles.bigCell, mode === 'minute' ? styles.bigCellActive : null, pressed ? styles.bigCellPressed : null]}
          >
            <Text style={[styles.bigText, mode === 'minute' ? styles.bigTextActive : styles.bigTextInactive]}>{minuteDisplay}</Text>
            <Text style={[styles.bigCellLabel, mode === 'minute' ? styles.bigCellLabelActive : null]}>Min</Text>
          </Pressable>
          <View style={styles.ampmCol}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="AM"
              onPress={() => setHour((h) => (h >= 12 ? h - 12 : h))}
              style={({ pressed }) => [styles.ampmBtn, ampm === 'AM' ? styles.ampmBtnActive : null, pressed ? styles.btnPressed : null]}
            >
              <Text style={[styles.ampmText, ampm === 'AM' ? styles.ampmTextActive : null]}>AM</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="PM"
              onPress={() => setHour((h) => (h < 12 ? h + 12 : h))}
              style={({ pressed }) => [styles.ampmBtn, ampm === 'PM' ? styles.ampmBtnActive : null, pressed ? styles.btnPressed : null]}
            >
              <Text style={[styles.ampmText, ampm === 'PM' ? styles.ampmTextActive : null]}>PM</Text>
            </Pressable>
          </View>
        </View>

        {mode === 'hour' ? (
          <View style={styles.padWrap}>
            <View style={styles.pad}>
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => {
                const selected = h === hour12Val;
                return (
                  <Pressable
                    key={h}
                    accessibilityRole="button"
                    accessibilityLabel={`${h} ${ampm}`}
                    onPress={() => onPickHour(h === 12 ? (ampm === 'AM' ? 0 : 12) : (ampm === 'AM' ? h : h + 12))}
                    style={({ pressed }) => [
                      styles.padBtn,
                      selected ? styles.padBtnActive : null,
                      pressed ? styles.btnPressed : null,
                    ]}
                  >
                    <Text style={[styles.padBtnText, selected ? styles.padBtnTextActive : null]}>{formatHourLabel(h)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.minuteWrap}>
            <ScrollView
              contentContainerStyle={styles.minuteScroll}
              showsVerticalScrollIndicator={false}
            >
              {MINUTES.map((m) => {
                const selected = m === minute;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityLabel={`${m} minutes`}
                    onPress={() => onPickMinute(m)}
                    style={({ pressed }) => [
                      styles.minuteRow,
                      selected ? styles.minuteRowActive : null,
                      pressed ? styles.btnPressed : null,
                    ]}
                  >
                    <Text style={[styles.minuteText, selected ? styles.minuteTextActive : null]}>
                      :{m.toString().padStart(2, '0')}
                    </Text>
                    {selected ? <Text style={styles.minuteCheck}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.btnRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelBtn, pressed ? styles.btnPressed : null]}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Set time ${hourDisplay}:${minuteDisplay} ${ampm}`}
            onPress={() => finalize(hour, minute)}
            style={({ pressed }) => [styles.confirmBtn, pressed ? styles.btnPressed : null]}
          >
            <Text style={styles.confirmBtnText}>Set</Text>
          </Pressable>
        </View>
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
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  displayRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  bigCell: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bigCellActive: {
    backgroundColor: '#102a17',
  },
  bigCellPressed: {
    opacity: 0.85,
  },
  bigCellLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  bigCellLabelActive: {
    color: colors.primary,
  },
  bigText: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
  },
  bigTextActive: {
    color: colors.primary,
  },
  bigTextInactive: {
    color: colors.muted,
  },
  colon: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  ampmCol: {
    gap: 4,
    marginLeft: 12,
    paddingBottom: 4,
  },
  ampmBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 38,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  ampmBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ampmText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  ampmTextActive: {
    color: '#062b1d',
  },
  padWrap: {
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  padBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 56,
    justifyContent: 'center',
    marginBottom: 8,
    width: '23%',
  },
  padBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  padBtnText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  padBtnTextActive: {
    color: '#062b1d',
  },
  minuteWrap: {
    maxHeight: 220,
    paddingHorizontal: 16,
  },
  minuteScroll: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 4,
  },
  minuteRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  minuteRowActive: {
    backgroundColor: '#102a17',
  },
  minuteText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  minuteTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  minuteCheck: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  cancelBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  confirmBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flex: 1.4,
    paddingVertical: 14,
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmBtnText: {
    color: '#062b1d',
    fontSize: 15,
    fontWeight: '800',
  },
  btnPressed: {
    opacity: 0.8,
  },
});
