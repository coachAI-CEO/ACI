import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../../constants/colors';
import { useGenerateStore } from '../../../stores/generate.store';

type DrillTab = 'setup' | 'coaching' | 'progressions';

function Tabs({ active, onChange }: { active: DrillTab; onChange: (tab: DrillTab) => void }) {
  const tabs: DrillTab[] = ['setup', 'coaching', 'progressions'];
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => (
        <Text key={tab} style={[styles.tab, active === tab ? styles.tabActive : null]} onPress={() => onChange(tab)}>
          {tab.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

export default function DrillDetailScreen() {
  const { drillId } = useLocalSearchParams<{ drillId?: string }>();
  const session = useGenerateStore((s) => s.latestSession) as any;
  const [tab, setTab] = useState<DrillTab>('setup');
  const [showDiagram, setShowDiagram] = useState(false);

  const drills = useMemo(() => session?.drills || session?.json?.drills || [], [session]);
  const index = Number(drillId || 0);
  const drill = drills[index] || null;

  if (!drill) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <Text style={styles.title}>Drill not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const setupSteps = Array.isArray(drill?.organization?.setupSteps) ? drill.organization.setupSteps : [];
  const coachingPoints = Array.isArray(drill?.coachingPoints) ? drill.coachingPoints : [];
  const progressions = Array.isArray(drill?.progressions) ? drill.progressions : [];
  const diagram = drill?.diagram || {};
  const players = Array.isArray(diagram?.players) ? diagram.players : [];
  const arrows = Array.isArray(diagram?.arrows) ? diagram.arrows : [];
  const annotations = Array.isArray(diagram?.annotations) ? diagram.annotations : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{drill.title || `Drill ${index + 1}`}</Text>
        <Text style={styles.meta}>{drill.drillType || 'Drill'} · {drill.durationMin || drill.duration || '--'} min</Text>

        <Tabs active={tab} onChange={setTab} />

        <View style={styles.card}>
          <Text style={styles.diagramTitle}>Diagram</Text>
          <Text style={styles.diagramOpen} onPress={() => setShowDiagram(true)}>
            Open Fullscreen Diagram
          </Text>
          <Svg height={180} width="100%" viewBox="0 0 100 70">
            <Rect x={0} y={0} width={100} height={70} stroke="#6b7280" strokeWidth={0.8} fill="#0f172a" />
            {players.slice(0, 16).map((player: any, idx: number) => (
              <Circle
                key={`p-${idx}-${player?.id || 'x'}`}
                cx={Number(player?.x || 50)}
                cy={Number(player?.y || 35)}
                r={2.2}
                fill={player?.team === 'DEF' ? '#ef4444' : player?.team === 'NEUTRAL' ? '#f59e0b' : '#22c55e'}
              />
            ))}
            {arrows.slice(0, 14).map((arrow: any, idx: number) => (
              <Line
                key={`a-${idx}-${arrow?.id || 'x'}`}
                x1={Number(arrow?.from?.x || 10)}
                y1={Number(arrow?.from?.y || 10)}
                x2={Number(arrow?.to?.x || 90)}
                y2={Number(arrow?.to?.y || 60)}
                stroke="#93c5fd"
                strokeWidth={0.7}
              />
            ))}
          </Svg>
        </View>

        <View style={styles.card}>
          {tab === 'setup' ? (
            setupSteps.length ? (
              setupSteps.map((step: unknown, idx: number) => (
                <Text key={`${idx}-${step}`} style={styles.line}>{idx + 1}. {String(step)}</Text>
              ))
            ) : (
              <Text style={styles.line}>{drill.description || 'No setup steps available.'}</Text>
            )
          ) : null}

          {tab === 'coaching' ? (
            coachingPoints.length ? (
              coachingPoints.map((point: unknown, idx: number) => (
                <Text key={`${idx}-${point}`} style={styles.line}>{idx + 1}. {String(point)}</Text>
              ))
            ) : (
              <Text style={styles.line}>No coaching points available.</Text>
            )
          ) : null}

          {tab === 'progressions' ? (
            progressions.length ? (
              progressions.map((item: unknown, idx: number) => (
                <Text key={`${idx}-${item}`} style={styles.line}>{idx + 1}. {String(item)}</Text>
              ))
            ) : (
              <Text style={styles.line}>No progressions available.</Text>
            )
          ) : null}
        </View>
      </ScrollView>

      <Modal animationType="slide" visible={showDiagram} onRequestClose={() => setShowDiagram(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Diagram (Pinch to Zoom)</Text>
            <Text style={styles.modalClose} onPress={() => setShowDiagram(false)}>
              Close
            </Text>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            minimumZoomScale={1}
            maximumZoomScale={4}
            bouncesZoom
            centerContent
          >
            <Svg height={720} width={960} viewBox="0 0 100 70">
              <Rect x={0} y={0} width={100} height={70} stroke="#9ca3af" strokeWidth={0.6} fill="#020617" />
              {players.map((player: any, idx: number) => (
                <Circle
                  key={`fp-${idx}-${player?.id || 'x'}`}
                  cx={Number(player?.x || 50)}
                  cy={Number(player?.y || 35)}
                  r={2.4}
                  fill={player?.team === 'DEF' ? '#ef4444' : player?.team === 'NEUTRAL' ? '#f59e0b' : '#22c55e'}
                />
              ))}
              {arrows.map((arrow: any, idx: number) => (
                <Line
                  key={`fa-${idx}-${arrow?.id || 'x'}`}
                  x1={Number(arrow?.from?.x || 10)}
                  y1={Number(arrow?.from?.y || 10)}
                  x2={Number(arrow?.to?.x || 90)}
                  y2={Number(arrow?.to?.y || 60)}
                  stroke="#93c5fd"
                  strokeWidth={0.5}
                />
              ))}
              {annotations.slice(0, 20).map((annotation: any, idx: number) => (
                <SvgText
                  key={`t-${idx}-${annotation?.id || 'x'}`}
                  x={Number(annotation?.x || 50)}
                  y={Number(annotation?.y || 35)}
                  fill={annotation?.color || '#fde68a'}
                  fontSize={Number(annotation?.fontSize || 2.5)}
                >
                  {String(annotation?.text || '')}
                </SvgText>
              ))}
            </Svg>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    gap: 12,
    padding: 14,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
  },
  tabs: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  line: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  diagramTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  diagramOpen: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalSafe: {
    backgroundColor: '#000',
    flex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalClose: {
    color: '#93c5fd',
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
});
