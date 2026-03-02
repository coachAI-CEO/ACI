import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useVideoStore } from '../../stores/video.store';

function TabSelector({ active, onChange }: { active: 'summary' | 'observations' | 'diagrams' | 'plan'; onChange: (tab: 'summary' | 'observations' | 'diagrams' | 'plan') => void }) {
  const tabs: Array<'summary' | 'observations' | 'diagrams' | 'plan'> = ['summary', 'observations', 'diagrams', 'plan'];
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => (
        <Text key={tab} style={[styles.tab, tab === active ? styles.tabActive : null]} onPress={() => onChange(tab)}>
          {tab.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

export default function VideoResultScreen() {
  const analysis = useVideoStore((s) => s.latestAnalysis) as any;
  const [activeTab, setActiveTab] = useState<'summary' | 'observations' | 'diagrams' | 'plan'>('summary');

  const observations = useMemo(() => {
    const items = analysis?.analysisArray || analysis?.observations || [];
    return Array.isArray(items) ? items : [];
  }, [analysis]);

  const diagrams = useMemo(() => {
    const frames = analysis?.diagramFrames || analysis?.frames || [];
    return Array.isArray(frames) ? frames : [];
  }, [analysis]);

  const summaryText =
    analysis?.summary ||
    analysis?.overallAssessment ||
    analysis?.status ||
    'No summary field was returned.';

  const planText =
    analysis?.plan ||
    analysis?.trainingRecommendations ||
    analysis?.nextSteps ||
    'No corrective plan field was returned.';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Video Analysis Result</Text>
        <TabSelector active={activeTab} onChange={setActiveTab} />

        {activeTab === 'summary' ? (
          <View style={styles.card}>
            <Text style={styles.body}>{String(summaryText)}</Text>
          </View>
        ) : null}

        {activeTab === 'observations' ? (
          <View style={styles.card}>
            {observations.length ? (
              observations.map((item: any, index: number) => (
                <Text key={`${index}-${item?.title || item?.observation || 'obs'}`} style={styles.line}>
                  {index + 1}. {item?.title || item?.observation || JSON.stringify(item)}
                </Text>
              ))
            ) : (
              <Text style={styles.body}>No observation entries returned.</Text>
            )}
          </View>
        ) : null}

        {activeTab === 'diagrams' ? (
          <View style={styles.card}>
            {diagrams.length ? (
              diagrams.map((item: any, index: number) => (
                <Text key={`${index}-${item?.id || 'frame'}`} style={styles.line}>
                  Frame {index + 1}: {item?.label || item?.timestamp || 'Diagram frame'}
                </Text>
              ))
            ) : (
              <Text style={styles.body}>No diagram frames returned.</Text>
            )}
          </View>
        ) : null}

        {activeTab === 'plan' ? (
          <View style={styles.card}>
            <Text style={styles.body}>{String(planText)}</Text>
          </View>
        ) : null}
      </ScrollView>
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
  body: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  line: {
    color: colors.text,
    fontSize: 14,
  },
});
