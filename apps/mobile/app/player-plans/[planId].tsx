import { useQuery } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { describeApiError } from '../../services/api';
import { exportPlayerPlanPdf } from '../../services/pdf.service';
import { deletePlayerPlan, getPlayerPlan } from '../../services/player-plans.service';
import { sharePdfArrayBuffer } from '../../utils/share-pdf';

type AdaptedDrill = {
  drillType?: string;
  title?: string;
  description?: string;
  durationMin?: number;
  organization?: {
    setupSteps?: string[];
    area?: { lengthYards?: number; widthYards?: number; notes?: string };
    equipment?: string[];
    reps?: string;
    rest?: string;
  };
  coachingPoints?: string[];
  progressions?: string[];
  sessionNumber?: number;
  sessionTitle?: string;
};

type PlayerPlanDrill = {
  drills?: AdaptedDrill[];
};

const DRILL_TYPE_LABEL: Record<string, string> = {
  WARMUP: 'Warm-up',
  TECHNICAL: 'Technical',
  TACTICAL: 'Tactical',
  CONDITIONED_GAME: 'Conditioned Game',
  FULL_GAME: 'Full Game',
  COOLDOWN: 'Cool-down',
};

type BadgeTone = 'default' | 'amber' | 'muted';
// Compact tone palette mirrors the webapp's tailwind palette mapped onto our tokens.
const DRILL_TYPE_TONE: Record<string, BadgeTone> = {
  WARMUP: 'amber',
  TECHNICAL: 'muted',
  TACTICAL: 'muted',
  CONDITIONED_GAME: 'default',
  FULL_GAME: 'default',
  COOLDOWN: 'muted',
};

const PLAYER_LEVEL_TONE: Record<string, BadgeTone> = {
  BEGINNER: 'muted',
  INTERMEDIATE: 'default',
  ADVANCED: 'amber',
};

const PLAYER_LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function areaLabel(area?: AdaptedDrill['organization'] extends infer T ? (T extends { area?: infer A } ? A : never) : never): string {
  if (!area) return '';
  if (area.lengthYards && area.widthYards) {
    return `${area.lengthYards} × ${area.widthYards} yards`;
  }
  return area.notes || 'Small space';
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
          <Button title="Back to plans" onPress={() => router.replace('/player-plans')} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const plan = query.data;
  const drills = (plan.json as PlayerPlanDrill | undefined)?.drills ?? [];
  const playerLevelKey = (plan.playerLevel || '').toUpperCase();
  const playerLevelTone = PLAYER_LEVEL_TONE[playerLevelKey] ?? 'default';

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
        <Link href="/player-plans" style={styles.backLink}>← Back to plans</Link>

        <Text style={styles.title}>{plan.title || 'Player plan'}</Text>

        <View style={styles.metaRow}>
          {plan.refCode ? (
            <View style={styles.refPill}>
              <Text style={styles.refPillText}>{plan.refCode}</Text>
            </View>
          ) : null}
          {plan.ageGroup ? <Text style={styles.metaItem}>{plan.ageGroup}</Text> : null}
          {plan.playerLevel ? (
            <Badge
              label={PLAYER_LEVEL_LABEL[playerLevelKey] ?? plan.playerLevel}
              tone={playerLevelTone}
            />
          ) : null}
          {plan.durationMin ? <Text style={styles.metaItem}>{plan.durationMin} min</Text> : null}
        </View>

        {plan.sourceRefCode ? (
          <Text style={styles.metaSource}>
            Source:{' '}
            <Text
              style={styles.metaSourceLink}
              onPress={() =>
                router.push({
                  pathname: '/vault/session/[sessionId]',
                  params: { sessionId: String(plan.sourceId || '') },
                })
              }
            >
              {plan.sourceRefCode}
            </Text>
          </Text>
        ) : null}

        {plan.objectives ? (
          <Card>
            <Text style={styles.sectionEyebrowGreen}>Objectives</Text>
            <Text style={styles.bodyText}>{plan.objectives}</Text>
          </Card>
        ) : null}

        {Array.isArray((plan as any).equipment) && (plan as any).equipment.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Equipment needed</Text>
            <View style={styles.chipsRow}>
              {(plan as any).equipment.map((eq: string, i: number) => (
                <View key={`${i}-${eq}`} style={styles.chip}>
                  <Text style={styles.chipText}>{eq}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Exercises</Text>
          {drills.length === 0 ? (
            <Text style={styles.bodyTextMuted}>No exercises in this plan.</Text>
          ) : (
            drills.map((drill, index) => {
              const drillTypeKey = (drill.drillType || '').toUpperCase();
              const drillTypeLabel = DRILL_TYPE_LABEL[drillTypeKey] || drill.drillType;
              const drillTypeTone = DRILL_TYPE_TONE[drillTypeKey] || 'muted';
              return (
                <Card key={`${index}-${drill.title || ''}`}>
                  <View style={styles.drillHeader}>
                    <View style={styles.drillBadges}>
                      {drillTypeLabel ? (
                        <Badge label={drillTypeLabel} tone={drillTypeTone} />
                      ) : null}
                      {drill.sessionNumber ? (
                        <Text style={styles.sessionBadge}>Session {drill.sessionNumber}</Text>
                      ) : null}
                      {drill.durationMin ? (
                        <Text style={styles.drillMeta}>{drill.durationMin} min</Text>
                      ) : null}
                    </View>
                    <Text style={styles.drillTitle}>{drill.title || 'Untitled drill'}</Text>
                    {drill.description ? (
                      <Text style={styles.bodyText}>{drill.description}</Text>
                    ) : null}
                  </View>

                  {drill.organization?.setupSteps && drill.organization.setupSteps.length > 0 ? (
                    <View style={styles.drillBlock}>
                      <Text style={styles.sectionEyebrowGreen}>Setup &amp; instructions</Text>
                      <View style={styles.steps}>
                        {drill.organization.setupSteps.map((step: string, i: number) => (
                          <View key={`setup-${index}-${i}`} style={styles.step}>
                            <Text style={styles.stepIndex}>{i + 1}.</Text>
                            <Text style={styles.bodyText}>{step}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {(drill.organization?.area || drill.organization?.equipment) ? (
                    <View style={styles.metaGrid}>
                      {drill.organization?.area ? (
                        <View style={styles.metaGridCell}>
                          <Text style={styles.metaLabel}>Area</Text>
                          <Text style={styles.metaValue}>{areaLabel(drill.organization.area)}</Text>
                        </View>
                      ) : null}
                      {drill.organization?.equipment && drill.organization.equipment.length > 0 ? (
                        <View style={styles.metaGridCell}>
                          <Text style={styles.metaLabel}>Equipment</Text>
                          <Text style={styles.metaValue}>
                            {drill.organization.equipment.join(', ')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {(drill.organization?.reps || drill.organization?.rest) ? (
                    <View style={styles.metaRow}>
                      {drill.organization?.reps ? (
                        <View style={styles.metaGridCell}>
                          <Text style={styles.metaLabel}>Reps</Text>
                          <Text style={styles.metaValueStrong}>{drill.organization.reps}</Text>
                        </View>
                      ) : null}
                      {drill.organization?.rest ? (
                        <View style={styles.metaGridCell}>
                          <Text style={styles.metaLabel}>Rest</Text>
                          <Text style={styles.metaValue}>{drill.organization.rest}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {drill.coachingPoints && drill.coachingPoints.length > 0 ? (
                    <View style={styles.drillBlock}>
                      <Text style={styles.sectionEyebrowPrimary}>Self-coaching points</Text>
                      {drill.coachingPoints.map((point: string, i: number) => (
                        <View key={`cp-${index}-${i}`} style={styles.bullet}>
                          <Text style={styles.bulletDot}>•</Text>
                          <Text style={styles.bodyText}>{point}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {drill.progressions && drill.progressions.length > 0 ? (
                    <View style={styles.drillBlock}>
                      <Text style={styles.sectionEyebrowAmber}>Progressions</Text>
                      {drill.progressions.map((prog: string, i: number) => (
                        <View key={`pg-${index}-${i}`} style={styles.bullet}>
                          <Text style={styles.bulletIndex}>{i + 1}.</Text>
                          <Text style={styles.bodyText}>{prog}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}
        </View>

        {error ? <ErrorMessage message={error} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Button title="Share PDF" onPress={() => void onSharePdf()} loading={busy === 'pdf'} />
        <Button title="Share text" onPress={() => void onShareText()} variant="secondary" />
        <Button title="Delete plan" onPress={() => void onDelete()} loading={busy === 'delete'} variant="danger" />
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
    gap: 14,
    padding: 16,
    paddingBottom: 40,
  },
  backLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: -4,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    color: colors.muted,
    fontSize: 13,
  },
  metaSource: {
    color: colors.muted,
    fontSize: 12,
  },
  metaSourceLink: {
    color: colors.primary,
    fontFamily: 'Menlo',
    fontSize: 12,
    fontWeight: '600',
  },
  refPill: {
    backgroundColor: '#0e2c1d',
    borderColor: '#1c4a30',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  refPillText: {
    color: colors.primary,
    fontFamily: 'Menlo',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  sectionEyebrow: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionEyebrowGreen: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionEyebrowPrimary: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionEyebrowAmber: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  bodyText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
  },
  bodyTextMuted: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1f2937',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
  },
  drillHeader: {
    gap: 8,
  },
  drillBadges: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  drillMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  sessionBadge: {
    color: colors.muted,
    fontSize: 12,
  },
  drillTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  drillBlock: {
    gap: 6,
    marginTop: 12,
  },
  steps: {
    gap: 6,
  },
  step: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  stepIndex: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 18,
  },
  bullet: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  bulletDot: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 19,
  },
  bulletIndex: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 18,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metaGridCell: {
    flexShrink: 1,
    gap: 2,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
  },
  metaValueStrong: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  status: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
