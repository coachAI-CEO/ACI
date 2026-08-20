import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = {
  durationMin: number;
  onComplete?: () => void;
};

export function SidelineTimer({ durationMin, onComplete }: Props) {
  const initialSeconds = Math.max(1, Math.round((durationMin || 1) * 60));
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
    setRunning(false);
    setFlash(false);
  }, [initialSeconds]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          setRunning(false);
          setFlash(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          onComplete?.();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, onComplete]);

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => setFlash(false), 200);
    return () => clearTimeout(timeout);
  }, [flash]);

  const display = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [secondsLeft]);

  const startLabel =
    secondsLeft === 0 ? 'Restart' : running ? 'Pause' : secondsLeft < initialSeconds ? 'Resume' : 'Start';

  return (
    <View style={styles.wrap}>
      {flash ? <View pointerEvents="none" style={styles.flashOverlay} /> : null}
      <Text style={styles.time}>⏱ {display}</Text>
      {secondsLeft === 0 ? <Text style={styles.done}>Done — swipe to next drill</Text> : null}
      <View style={styles.controls}>
        <Text
          style={styles.control}
          onPress={() => {
            if (secondsLeft === 0) {
              setSecondsLeft(initialSeconds);
              setRunning(true);
              return;
            }
            setRunning((value) => !value);
          }}
        >
          {startLabel}
        </Text>
        <Text
          style={styles.control}
          onPress={() => {
            setRunning(false);
            setSecondsLeft(initialSeconds);
            setFlash(false);
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
    overflow: 'hidden',
    padding: 10,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  time: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  done: {
    color: '#86efac',
    fontSize: 14,
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
