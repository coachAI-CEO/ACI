import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { describeApiError } from '../../services/api';
import { createCalendarEvent } from '../../services/calendar.service';
import { toggleSessionFavorite } from '../../services/favorites.service';
import { createPlayerPlanFromSession } from '../../services/player-plans.service';
import { saveSessionToVault } from '../../services/session.service';
import { useGenerateStore } from '../../stores/generate.store';

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

export default function SessionResultScreen() {
  const { user } = useAuth();
  const session = useGenerateStore((s) => s.latestSession) as any;
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const drills = useMemo(() => session?.drills || session?.json?.drills || [], [session]);
  const sessionId = session?.id;
  const sessionObjectives = asList(session?.objectives || session?.json?.objectives);
  const coachingTheme = session?.coachingTheme || session?.json?.coachingTheme || session?.focus;

  const onSave = async () => {
    if (!sessionId) return;
    setBusy('save');
    setError(null);
    try {
      await saveSessionToVault(sessionId);
      setStatus('Saved to vault.');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const onFavorite = async () => {
    if (!sessionId) return;
    setBusy('favorite');
    setError(null);
    try {
      await toggleSessionFavorite(sessionId, false);
      setStatus('Added to favorites.');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const onSchedule = async () => {
    if (!sessionId) return;
    setBusy('schedule');
    setError(null);
    try {
      const when = new Date();
      when.setDate(when.getDate() + 1);
      when.setHours(16, 0, 0, 0);
      await createCalendarEvent({
        sessionId,
        scheduledDate: when.toISOString(),
        durationMin: Number(session?.durationMin) || 60,
        notes: session?.title || undefined,
      });
      setStatus('Scheduled for tomorrow at 4:00 PM.');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const onPlayerPlan = async () => {
    if (!sessionId) return;
    if (!user?.features?.canCreatePlayerPlans) {
      Alert.alert('Player plans', 'Your plan does not include player plans.');
      return;
    }
    setBusy('plan');
    setError(null);
    try {
      const result = await createPlayerPlanFromSession(sessionId, {
        sourceRefCode: session?.refCode,
        playerLevel: session?.playerLevel,
      });
      setStatus(`Player plan created (${result.refCode}).`);
      router.push({ pathname: '/player-plans/[planId]', params: { planId: result.id } });
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `${session?.title || 'Session'} (${session?.refCode || sessionId || 'draft'})`,
      });
    } catch {
      // ignore cancel
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{session?.title || 'Generated Session'}</Text>
        <Text style={styles.meta}>
          {session?.ageGroup || '--'} · {session?.gameModelId || '--'} · {session?.durationMin || '--'} min
          {session?.refCode ? ` · ${session.refCode}` : ''}
        </Text>

        {coachingTheme ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Theme</Text>
            <Text style={styles.bodyLine}>{String(coachingTheme)}</Text>
          </View>
        ) : null}

        {sessionObjectives.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Objectives</Text>
            {sessionObjectives.map((item, idx) => (
              <Text key={`${idx}-${item}`} style={styles.bodyLine}>
                {idx + 1}. {item}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Drills ({drills.length})</Text>
          {drills.length ? (
            drills.map((drill: any, idx: number) => {
              const coachingPoints = asList(drill?.coachingPoints);
              const progressions = asList(drill?.progressions);
              return (
                <View key={`${drill?.id || drill?.title || 'drill'}-${idx}`} style={styles.row}>
                  <Pressable onPress={() => setExpandedIndex((value) => (value === idx ? -1 : idx))} style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>
                      {expandedIndex === idx ? '▼' : '▶'} {idx + 1}. {drill?.title || 'Untitled drill'}
                    </Text>
                    <Text style={styles.rowMeta}>{drill?.durationMin || drill?.duration || '--'} min</Text>
                  </Pressable>
                  {expandedIndex === idx ? (
                    <View style={styles.drillBody}>
                      <Text style={styles.bodyLine}>Type: {drill?.drillType || 'N/A'}</Text>
                      <Text style={styles.bodyLine}>Phase: {drill?.phase || session?.phase || 'N/A'}</Text>
                      {coachingPoints.slice(0, 3).map((point, pointIdx) => (
                        <Text key={`cp-${pointIdx}`} style={styles.bodyLine}>
                          • {point}
                        </Text>
                      ))}
                      {progressions.slice(0, 2).map((item, progressionIdx) => (
                        <Text key={`pr-${progressionIdx}`} style={styles.bodyLine}>
                          ↗ {item}
                        </Text>
                      ))}
                      <Text
                        style={styles.openLink}
                        onPress={() =>
                          router.push({
                            pathname: '/session/drill/[drillId]',
                            params: {
                              drillId: String(drill?.id || drill?.refCode || idx),
                              source: 'session',
                            },
                          })
                        }
                      >
                        Open Drill Detail
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>No drills found in response.</Text>
          )}
        </View>

        {error ? <ErrorMessage message={error} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Button title="Save to Vault" onPress={() => void onSave()} disabled={!sessionId} loading={busy === 'save'} />
        <Button title="Favorite" onPress={() => void onFavorite()} disabled={!sessionId} loading={busy === 'favorite'} variant="secondary" />
        <Button
          title="Schedule tomorrow"
          onPress={() => void onSchedule()}
          disabled={!sessionId || !user?.features?.canAccessCalendar}
          loading={busy === 'schedule'}
          variant="secondary"
        />
        <Button
          title="Create player plan"
          onPress={() => void onPlayerPlan()}
          disabled={!sessionId}
          loading={busy === 'plan'}
          variant="secondary"
        />
        <Button title="Share ref" onPress={() => void onShare()} variant="secondary" />
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
    flex: 1,
    fontSize: 14,
    paddingRight: 8,
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
    lineHeight: 18,
  },
  openLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  status: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
