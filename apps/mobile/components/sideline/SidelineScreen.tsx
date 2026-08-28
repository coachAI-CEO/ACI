import { PanResponder, StyleSheet, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SidelineDiagramWarmup, SidelineDrillView } from './SidelineDrillView';
import { SidelineHeader } from './SidelineHeader';
import { SidelineNavBar } from './SidelineNavBar';
import { SidelineTimer } from './SidelineTimer';
import { humanizeLabel } from '../../utils/format';
import type { SidelineDrill } from '../../utils/session-payload';
import { getSessionDisplayRef } from '../../utils/session-payload';

function drillKindLabel(drill?: SidelineDrill | null): string {
  const raw = String(drill?.drillType || drill?.phase || '').trim();
  return raw ? humanizeLabel(raw) : 'Drill';
}

type Props = {
  session: any;
  drills: SidelineDrill[];
};

export function SidelineScreen({ session, drills }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [timerDoneHint, setTimerDoneHint] = useState(false);
  const indexRef = useRef(0);
  const drillsLenRef = useRef(drills.length);

  useEffect(() => {
    activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    setTimerDoneHint(false);
  }, [index]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    drillsLenRef.current = drills.length;
  }, [drills.length]);

  const current = drills[index] || drills[0];

  const goPrev = () => {
    if (indexRef.current <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setIndex((value) => Math.max(0, value - 1));
  };

  const goNext = () => {
    if (indexRef.current >= drillsLenRef.current - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setIndex((value) => Math.min(drillsLenRef.current - 1, value + 1));
  };

  // Always leave via replace — router.back() is unreliable after deep links / Simulator.
  const exit = () => {
    router.replace('/(tabs)/vault');
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
    []
  );

  return (
    <View style={styles.safe}>
      <SidelineDiagramWarmup drills={drills} index={index} />
      <SidelineHeader
        sessionRef={getSessionDisplayRef(session)}
        index={index}
        total={drills.length || 1}
        onExit={exit}
      />
      <View style={styles.body} {...panResponder.panHandlers}>
        <SidelineDrillView drill={current} />
      </View>
      <SidelineTimer
        durationMin={Number(current?.durationMin || 10)}
        onComplete={() => setTimerDoneHint(true)}
      />
      <SidelineNavBar
        canPrev={index > 0}
        canNext={index < drills.length - 1}
        prevHint={index > 0 ? drillKindLabel(drills[index - 1]) : undefined}
        nextHint={
          index < drills.length - 1
            ? timerDoneHint
              ? `${drillKindLabel(drills[index + 1])} · ready`
              : drillKindLabel(drills[index + 1])
            : undefined
        }
        onPrev={goPrev}
        onNext={goNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#000',
    flex: 1,
    gap: 8,
    padding: 12,
    paddingTop: 48,
  },
  body: {
    flex: 1,
  },
});
