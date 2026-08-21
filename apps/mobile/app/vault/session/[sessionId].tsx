import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScheduleSessionSheet } from '../../../components/calendar/ScheduleSessionSheet';
import { StoredDrillDiagram } from '../../../components/diagram/StoredDrillDiagram';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { describeApiError } from '../../../services/api';
import { createCalendarEvent } from '../../../services/calendar.service';
import { writeSessionDetailCache } from '../../../services/offline-cache.service';
import { exportSessionPdf, sessionPayloadForPdf } from '../../../services/pdf.service';
import { createPlayerPlanFromSession } from '../../../services/player-plans.service';
import { getVaultSession } from '../../../services/vault.service';
import { extractSessionDrills } from '../../../utils/session-payload';
import { sharePdfArrayBuffer } from '../../../utils/share-pdf';

export default function VaultSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const query = useQuery({
    queryKey: ['vault', 'session', sessionId],
    queryFn: () => getVaultSession(String(sessionId)),
    enabled: Boolean(sessionId),
  });

  const session = query.data;
  const drills = useMemo(() => extractSessionDrills(session), [session]);

  useEffect(() => {
    if (!session || !user?.id) return;
    writeSessionDetailCache(session, user.id).catch(() => undefined);
  }, [session, user?.id]);

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error || !session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error, 'Session not found or outside your club vault.')} />
          <Button title="Back to vault" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const onScheduleConfirm = async (payload: { scheduledAt: Date; durationMin: number }) => {
    setBusy('schedule');
    setActionError(null);
    try {
      await createCalendarEvent({
        sessionId: session.id,
        scheduledDate: payload.scheduledAt.toISOString(),
        durationMin: payload.durationMin,
      });
      setScheduleOpen(false);
      setStatus(`Scheduled for ${payload.scheduledAt.toLocaleString()}.`);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const onSharePdf = async () => {
    if (!user?.features?.canExportPDF) {
      Alert.alert('PDF export', 'Your plan does not include PDF export. Upgrade on the web to unlock.');
      return;
    }
    setBusy('pdf');
    setActionError(null);
    try {
      const buffer = await exportSessionPdf(sessionPayloadForPdf(session), 'full');
      await sharePdfArrayBuffer(buffer, `session-${session.refCode || session.id}.pdf`);
      setStatus('PDF ready to share.');
    } catch (err) {
      setActionError(describeApiError(err, 'Could not export PDF.'));
    } finally {
      setBusy(null);
    }
  };

  const onPlayerPlan = async () => {
    setBusy('plan');
    setActionError(null);
    try {
      const result = await createPlayerPlanFromSession(session.id, {
        sourceRefCode: session.refCode,
      });
      router.push({ pathname: '/player-plans/[planId]', params: { planId: result.id } });
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{session.title || 'Vault session'}</Text>
        <Text style={styles.meta}>
          {session.ageGroup || '--'} · {session.gameModelId || '--'} · {session.durationMin || '--'} min
          {session.refCode ? ` · ${session.refCode}` : ''}
        </Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Drills ({drills.length})</Text>
          {drills.map((drill: any, idx: number) => (
            <View key={`${drill?.id || drill?.refCode || idx}`} style={styles.row}>
              <Pressable onPress={() => setExpandedIndex((value) => (value === idx ? -1 : idx))} style={styles.rowHeader}>
                <Text style={styles.rowTitle}>
                  {expandedIndex === idx ? '▼' : '▶'} {idx + 1}. {drill?.title || 'Untitled drill'}
                </Text>
                <Text style={styles.rowMeta}>{drill?.durationMin || '--'} min</Text>
              </Pressable>
              {expandedIndex === idx ? (
                <View style={styles.drillBody}>
                  <StoredDrillDiagram drillId={drill?.id || drill?.refCode} height={200} />
                  <Text
                    style={styles.link}
                    onPress={() =>
                      router.push({
                        pathname: '/session/drill/[drillId]',
                        params: { drillId: String(drill?.id || drill?.refCode || idx) },
                      })
                    }
                  >
                    Open drill detail
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {actionError ? <ErrorMessage message={actionError} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Button
          title="Sideline Mode"
          onPress={() => router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: session.id } })}
        />
        <Button title="Share PDF" onPress={() => void onSharePdf()} loading={busy === 'pdf'} variant="secondary" />
        <Button
          title="Schedule…"
          onPress={() => setScheduleOpen(true)}
          disabled={!user?.features?.canAccessCalendar}
          variant="secondary"
        />
        <Button
          title="Create player plan"
          onPress={() => void onPlayerPlan()}
          disabled={!user?.features?.canCreatePlayerPlans}
          loading={busy === 'plan'}
          variant="secondary"
        />
      </ScrollView>

      <ScheduleSessionSheet
        visible={scheduleOpen}
        durationMin={Number(session.durationMin) || 60}
        loading={busy === 'schedule'}
        onCancel={() => setScheduleOpen(false)}
        onConfirm={(payload) => void onScheduleConfirm(payload)}
      />
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
    flex: 1,
    fontSize: 14,
    paddingRight: 8,
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  drillBody: {
    gap: 8,
    marginTop: 8,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  status: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
