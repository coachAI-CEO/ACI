import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { saveSessionToVault } from '../../services/session.service';
import { useGenerateStore } from '../../stores/generate.store';

export default function SessionResultScreen() {
  const session = useGenerateStore((s) => s.latestSession) as any;
  const [expandedIndex, setExpandedIndex] = useState<number>(0);

  const drills = useMemo(() => session?.drills || session?.json?.drills || [], [session]);
  const sessionId = session?.id;

  const onSave = async () => {
    if (!sessionId) {
      return;
    }
    await saveSessionToVault(sessionId);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{session?.title || 'Generated Session'}</Text>
        <Text style={styles.meta}>
          {session?.ageGroup || '--'} · {session?.gameModelId || '--'} · {session?.durationMin || '--'} min
        </Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Drills ({drills.length})</Text>
          {drills.length ? (
            drills.map((drill: any, idx: number) => (
              <View key={`${drill?.id || drill?.title || 'drill'}-${idx}`} style={styles.row}>
                <Pressable onPress={() => setExpandedIndex((value) => (value === idx ? -1 : idx))} style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{expandedIndex === idx ? '▼' : '▶'} {idx + 1}. {drill?.title || 'Untitled drill'}</Text>
                  <Text style={styles.rowMeta}>{drill?.durationMin || drill?.duration || '--'} min</Text>
                </Pressable>
                {expandedIndex === idx ? (
                  <View style={styles.drillBody}>
                    <Text style={styles.bodyLine}>Type: {drill?.drillType || 'N/A'}</Text>
                    <Text style={styles.bodyLine}>Phase: {drill?.phase || session?.phase || 'N/A'}</Text>
                    <Text style={styles.openLink} onPress={() => router.push({ pathname: '/session/drill/[drillId]', params: { drillId: String(idx) } })}>
                      Open Drill Detail
                    </Text>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No drills found in response.</Text>
          )}
        </View>

        <Button title="Save to Vault" onPress={() => void onSave()} disabled={!sessionId} />
        <Button
          title="Sideline Mode"
          onPress={() => router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: String(sessionId || 'latest') } })}
          variant="secondary"
        />
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
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
  },
  block: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingBottom: 8,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  empty: {
    color: colors.muted,
  },
  drillBody: {
    gap: 6,
    marginTop: 8,
  },
  bodyLine: {
    color: colors.muted,
    fontSize: 12,
  },
  openLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
