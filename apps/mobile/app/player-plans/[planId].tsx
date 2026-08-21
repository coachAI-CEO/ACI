import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { describeApiError } from '../../services/api';
import { exportPlayerPlanPdf } from '../../services/pdf.service';
import { deletePlayerPlan, getPlayerPlan } from '../../services/player-plans.service';
import { sharePdfArrayBuffer } from '../../utils/share-pdf';

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

export default function PlayerPlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['player-plans', planId],
    queryFn: () => getPlayerPlan(String(planId)),
    enabled: Boolean(planId),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error || !query.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error, 'Plan not found.')} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const plan = query.data;
  const payload = plan.plan || plan.json || plan;
  const focusPoints = asList(payload?.focusPoints || payload?.coachingPoints || payload?.objectives);
  const activities = Array.isArray(payload?.activities)
    ? payload.activities
    : Array.isArray(payload?.drills)
      ? payload.drills
      : [];

  const onShareText = async () => {
    await Share.share({
      message: `Player plan ${plan.title || ''} (${plan.refCode || plan.id})`,
    });
  };

  const onSharePdf = async () => {
    if (!user?.features?.canExportPDF && !user?.features?.canCreatePlayerPlans) {
      Alert.alert('PDF export', 'PDF export is not available on your current plan.');
      return;
    }
    setBusy('pdf');
    setError(null);
    try {
      const buffer = await exportPlayerPlanPdf(plan.id);
      await sharePdfArrayBuffer(buffer, `player-plan-${plan.refCode || plan.id}.pdf`);
      setStatus('PDF ready to share.');
    } catch (err) {
      setError(describeApiError(err, 'Could not export PDF.'));
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    setBusy('delete');
    setError(null);
    try {
      await deletePlayerPlan(plan.id);
      router.replace('/player-plans');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{plan.title || 'Player plan'}</Text>
        <Text style={styles.meta}>
          {plan.refCode || plan.id} · {plan.ageGroup || '--'} · {plan.playerLevel || '--'} · {plan.durationMin || '--'} min
        </Text>

        {focusPoints.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Focus</Text>
            {focusPoints.map((item, idx) => (
              <Text key={`${idx}-${item}`} style={styles.line}>
                {idx + 1}. {item}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activities ({activities.length})</Text>
          {activities.length ? (
            activities.map((item: any, idx: number) => (
              <Text key={`${item?.id || idx}`} style={styles.line}>
                {idx + 1}. {item?.title || item?.name || String(item)}
              </Text>
            ))
          ) : (
            <Text style={styles.line}>No activity breakdown available.</Text>
          )}
        </View>

        {error ? <ErrorMessage message={error} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Button title="Share PDF" onPress={() => void onSharePdf()} loading={busy === 'pdf'} />
        <Button title="Share text" onPress={() => void onShareText()} variant="secondary" />
        <Button title="Delete" onPress={() => void onDelete()} loading={busy === 'delete'} variant="danger" />
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  line: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  status: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
