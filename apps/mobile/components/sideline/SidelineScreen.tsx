import { Alert, PanResponder, StyleSheet, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SidelineDrillView } from './SidelineDrillView';
import { SidelineHeader } from './SidelineHeader';
import { SidelineNavBar } from './SidelineNavBar';
import { SidelineTimer } from './SidelineTimer';
import type { SidelineDrill } from '../../utils/session-payload';
import { getSessionDisplayRef } from '../../utils/session-payload';

type Props = {
  session: any;
  drills: SidelineDrill[];
};

export function SidelineScreen({ session, drills }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [timerDoneHint, setTimerDoneHint] = useState(false);

  useEffect(() => {
    activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    setTimerDoneHint(false);
  }, [index]);

  const current = drills[index] || drills[0];

  const goPrev = () => {
    if (index <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setIndex((value) => Math.max(0, value - 1));
  };

  const goNext = () => {
    if (index >= drills.length - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setIndex((value) => Math.min(drills.length - 1, value + 1));
  };

  const exit = () => {
    Alert.alert('End practice mode?', '', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'End Practice',
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 24 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -40) {
            goNext();
            return;
          }
          if (gestureState.dx >= 40) {
            goPrev();
          }
        },
      }),
    [index, drills.length]
  );

  return (
    <View style={styles.safe} {...panResponder.panHandlers}>
      <SidelineHeader
        sessionRef={getSessionDisplayRef(session)}
        index={index}
        total={drills.length || 1}
        onExit={exit}
      />
      <SidelineDrillView drill={current} />
      <SidelineTimer
        durationMin={Number(current?.durationMin || 10)}
        onComplete={() => setTimerDoneHint(true)}
      />
      {timerDoneHint && index < drills.length - 1 ? (
        <SidelineNavBar
          canPrev={false}
          canNext
          prevLabel=""
          nextLabel="Swipe to next drill"
          onPrev={() => undefined}
          onNext={goNext}
        />
      ) : (
        <SidelineNavBar
          canPrev={index > 0}
          canNext={index < drills.length - 1}
          prevLabel={drills[index - 1]?.title || 'Previous'}
          nextLabel={drills[index + 1]?.title || 'Next'}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#000',
    flex: 1,
    gap: 14,
    padding: 14,
  },
});
