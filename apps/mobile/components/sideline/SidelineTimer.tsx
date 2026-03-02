import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = {
  durationMin: number;
};

export function SidelineTimer({ durationMin }: Props) {
  const initialSeconds = Math.max(1, Math.round((durationMin || 1) * 60));
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
    setRunning(false);
  }, [initialSeconds]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          setRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const display = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [secondsLeft]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.time}>⏱ {display}</Text>
      <View style={styles.controls}>
        <Text style={styles.control} onPress={() => setRunning((v) => !v)}>
          {running ? 'Pause' : secondsLeft === 0 ? 'Restart' : 'Start'}
        </Text>
        <Text
          style={styles.control}
          onPress={() => {
            setRunning(false);
            setSecondsLeft(initialSeconds);
          }}
        >
          Reset
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    borderColor: '#374151',
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  time: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  control: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    color: '#fff',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
