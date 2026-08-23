import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { createCalendarEvent, getVaultCalendarEvents } from '../../../services/calendar.service';
import { writeSessionDetailCache } from '../../../services/offline-cache.service';
import { exportSessionPdf, sessionPayloadForPdf } from '../../../services/pdf.service';
import { createPlayerPlanFromSession, getPlayerPlanBySource } from '../../../services/player-plans.service';
import { getVaultSession } from '../../../services/vault.service';
import { formatGameModelLabel } from '../../../utils/format';
import { extractSessionDrills } from '../../../utils/session-payload';
import { sharePdfArrayBuffer } from '../../../utils/share-pdf';

export default function VaultSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  const calendarQuery = useQuery({
    queryKey: ['vault', 'calendar-counts'],
    queryFn: getVaultCalendarEvents,
    enabled: Boolean(user?.features?.canAccessCalendar),
    staleTime: 60_000,
  });

  const playerPlanQuery = useQuery({
    queryKey: ['vault', 'session', sessionId, 'player-plan'],
    queryFn: () => getPlayerPlanBySource('SESSION', String(sessionId)),
    enabled: Boolean(sessionId) && Boolean(user?.features?.canCreatePlayerPlans),
    staleTime: 60_000,
  });

  const session = query.data;
  const drills = useMemo(() => extractSessionDrills(session), [session]);

  const scheduledForSession = useMemo(() => {
    const id = session?.id;
    if (!id) return [];
    return (calendarQuery.data || [])
      .filter((event) => event.sessionId === id && !event.cancelled)
      .sort((a, b) => new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime());
  }, [calendarQuery.data, session?.id]);

  const nextScheduledLabel = useMemo(() => {
    const next =
      scheduledForSession.find((event) => {
        const when = event.scheduledDate ? new Date(event.scheduledDate) : null;
        return when && when.getTime() >= Date.now() - 60 * 60 * 1000;
      }) || scheduledForSession[0];
    if (!next?.scheduledDate) return null;
    return new Date(next.scheduledDate).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [scheduledForSession]);

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
      await queryClient.invalidateQueries({ queryKey: ['vault', 'calendar-counts'] });
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
    if (existingPlayerPlan) {
      router.push({ pathname: '/player-plans/[planId]', params: { planId: existingPlayerPlan.id } });
      return;
    }
    setBusy('plan');
    setActionError(null);
    try {
      const result = await createPlayerPlanFromSession(session.id, {
        sourceRefCode: session.refCode,
      });
      queryClient.setQueryData(
        ['vault', 'session', sessionId, 'player-plan'],
        { id: result.id, refCode: result.refCode, title: result.plan?.title || null, createdAt: result.plan?.createdAt }
      );
      router.push({ pathname: '/player-plans/[planId]', params: { planId: result.id } });
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const alreadyScheduled = scheduledForSession.length > 0;
  const existingPlayerPlan = playerPlanQuery.data || null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{session.title || 'Vault session'}</Text>
        <Text style={styles.meta}>
          {session.ageGroup || '--'} · {formatGameModelLabel(session.gameModelId) || '--'} ·{' '}
          {session.durationMin || '--'} min
          {session.refCode ? ` · ${session.refCode}` : ''}
        </Text>

        {alreadyScheduled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            onPress={() => router.push('/(tabs)/calendar')}
            style={styles.calendarBanner}
          >
            <Text style={styles.calendarBannerTitle}>Already on your calendar</Text>
            <Text style={styles.calendarBannerMeta}>
              {scheduledForSession.length} scheduled
              {nextScheduledLabel ? ` · next ${nextScheduledLabel}` : ''}
            </Text>
            <Text style={styles.calendarBannerLink}>View calendar</Text>
          </Pressable>
        ) : null}

        {existingPlayerPlan ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open player plan"
            onPress={() =>
              router.push({ pathname: '/player-plans/[planId]', params: { planId: existingPlayerPlan.id } })
            }
            style={styles.playerPlanBanner}
          >
            <Text style={styles.playerPlanBannerTitle}>Player plan exists</Text>
            <Text style={styles.playerPlanBannerMeta}>
              {existingPlayerPlan.refCode ? `${existingPlayerPlan.refCode} · ` : ''}
              {existingPlayerPlan.title || 'Saved player version'}
            </Text>
            <Text style={styles.playerPlanBannerLink}>View player plan</Text>
          </Pressable>
        ) : null}

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
                  <StoredDrillDiagram
                    key={String(drill?.id || drill?.refCode || idx)}
                    drillId={drill?.id || drill?.refCode}
                    svg={drill?.diagramSvg || null}
                    height={220}
                  />
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
        {user?.features?.canExportPDF ? (
          <Button title="Share PDF" onPress={() => void onSharePdf()} loading={busy === 'pdf'} variant="secondary" />
        ) : null}
        {user?.features?.canAccessCalendar ? (
          <Button
            title={alreadyScheduled ? 'Schedule again…' : 'Schedule…'}
            onPress={() => setScheduleOpen(true)}
            variant="secondary"
          />
        ) : null}
        {user?.features?.canCreatePlayerPlans ? (
          <Button
            title={existingPlayerPlan ? 'View player plan' : 'Create player plan'}
            onPress={() => void onPlayerPlan()}
            loading={busy === 'plan'}
            variant="secondary"
          />
        ) : null}
        {!user?.features?.canExportPDF ||
        !user?.features?.canAccessCalendar ||
        !user?.features?.canCreatePlayerPlans ? (
          <Text style={styles.gateHint}>
            More actions (PDF, calendar, player plans) are available on higher plans. Upgrade on the web.
          </Text>
        ) : null}
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
  calendarBanner: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  calendarBannerTitle: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '800',
  },
  calendarBannerMeta: {
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarBannerLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  playerPlanBanner: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  playerPlanBannerTitle: {
    color: '#86efac',
    fontSize: 14,
    fontWeight: '800',
  },
  playerPlanBannerMeta: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '600',
  },
  playerPlanBannerLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
  gateHint: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: -4,
  },
});
