import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import {
  formatCoachLevelLabel,
  formatGameModelLabel,
  formatPhaseLabel,
  formatPlayerLevelLabel,
  formatShortDate,
  formatZoneLabel,
  humanizeLabel,
} from '../../utils/format';
import type { VaultDrillLite, VaultSeries, VaultSession } from '../../services/vault.service';

function FavoriteButton({ isFavorited, onToggle }: { isFavorited: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      accessibilityState={{ selected: isFavorited }}
      hitSlop={10}
      onPress={onToggle}
      style={styles.favoritePress}
    >
      <Text style={[styles.favorite, isFavorited ? styles.favoriteOn : null]}>{isFavorited ? '★' : '☆'}</Text>
    </Pressable>
  );
}

function shortPhase(value?: string | null): string {
  const label = formatPhaseLabel(value);
  if (!label) return '—';
  if (label.startsWith('Attack')) return 'Attack';
  if (label.startsWith('Defend')) return 'Defend';
  if (label.includes('to Attack')) return 'To Att';
  if (label.includes('to Defend')) return 'To Def';
  if (label.includes('Transition')) return 'Trans';
  return label.length > 8 ? label.slice(0, 8) : label;
}

function shortZone(value?: string | null): string {
  const raw = String(value || '').toUpperCase();
  if (raw.includes('DEFENSIVE')) return 'Def 3rd';
  if (raw.includes('MIDDLE')) return 'Mid 3rd';
  if (raw.includes('ATTACKING')) return 'Att 3rd';
  const label = formatZoneLabel(value);
  return label ? (label.length > 8 ? label.slice(0, 8) : label) : '—';
}

function playerCountShort(session: VaultSession): string {
  const min = session.numbersMin;
  const max = session.numbersMax;
  if (min == null && max == null) return '—';
  if (min != null && max != null && min === max) return String(min);
  if (min != null && max != null) return `${min}–${max}`;
  return String(min ?? max);
}

function creatorLabel(session: VaultSession): string | null {
  const person = session.user || session.creator;
  if (!person) return null;
  return person.name || person.email || null;
}

function SpecCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.specCell}>
      <Text numberOfLines={1} style={styles.specValue}>
        {value}
      </Text>
      <Text style={styles.specLabel}>{label}</Text>
    </View>
  );
}

function CalendarBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View accessibilityLabel={`On calendar ${count} times`} style={styles.calendarBadge}>
      <Text style={styles.calendarBadgeText}>On calendar · {count}</Text>
    </View>
  );
}

function seriesDisplayTitle(series: VaultSeries): string {
  const first = series.sessions?.[0];
  if (first?.title) {
    const stripped = first.title
      .replace(/^(Session\s*\d+:?\s*-?\s*)/i, '')
      .replace(/^(Wk\.?\s*\d+:?\s*-?\s*)/i, '')
      .replace(/^(Week\s*\d+:?\s*-?\s*)/i, '')
      .replace(/\s*-\s*Part\s*\d+\s*$/i, '')
      .replace(/\s*\(\s*Part\s*\d+\s*\)\s*$/i, '')
      .trim();
    if (stripped) return stripped;
  }
  const age = series.ageGroup || first?.ageGroup;
  const model = formatGameModelLabel(series.gameModelId || first?.gameModelId);
  return age ? `${model} series (${age})` : `${model} series`;
}

export function SessionCard({
  session,
  isFavorited,
  onToggleFavorite,
  onPress,
  showGameModel = true,
  calendarCount = 0,
}: {
  session: VaultSession;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onPress?: () => void;
  /** Hide when user is locked to a single club game model. */
  showGameModel?: boolean;
  calendarCount?: number;
}) {
  const coach = formatCoachLevelLabel(session.coachLevel);
  const player = formatPlayerLevelLabel(session.playerLevel);
  const created = formatShortDate(session.createdAt);
  const creator = creatorLabel(session);
  const footerBits = [coach, player].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={session.title || 'Untitled session'}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.rowBetween}>
        <View style={styles.headerLeft}>
          {session.refCode ? (
            <View style={styles.refPill}>
              <Text style={styles.refPillText}>{session.refCode}</Text>
            </View>
          ) : (
            <Text style={styles.ref}>Session</Text>
          )}
          <CalendarBadge count={calendarCount} />
        </View>
        <FavoriteButton isFavorited={isFavorited} onToggle={onToggleFavorite} />
      </View>

      <Text style={styles.title}>{session.title || 'Untitled session'}</Text>

      <View style={styles.metaRow}>
        {showGameModel ? (
          <>
            <View style={styles.modelDot} />
            <Text style={styles.modelText}>{formatGameModelLabel(session.gameModelId)}</Text>
            <Text style={styles.metaSep}>·</Text>
          </>
        ) : null}
        {session.durationMin ? <Text style={styles.duration}>{session.durationMin} min</Text> : null}
      </View>

      <View style={styles.specStrip}>
        <SpecCell value={session.ageGroup || '—'} label="Age" />
        <SpecCell value={shortPhase(session.phase)} label="Phase" />
        <SpecCell value={playerCountShort(session)} label="Players" />
      </View>
      {(session.zone || session.formationUsed) && (
        <Text style={styles.metaLine} numberOfLines={1}>
          {shortZone(session.zone)}
          {session.formationUsed ? ` · ${session.formationUsed}` : ''}
        </Text>
      )}

      {footerBits.length || created || creator ? (
        <View style={styles.footer}>
          <Text style={styles.footerText} numberOfLines={1}>
            {footerBits.length ? footerBits.join(' · ') : creator ? `by ${creator}` : ' '}
          </Text>
          {created ? <Text style={styles.footerText}>{created}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function SeriesCard({
  series,
  isFavorited,
  onToggleFavorite,
  onPress,
  showGameModel = true,
  calendarCount = 0,
  scheduledParts = 0,
}: {
  series: VaultSeries;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onPress?: () => void;
  showGameModel?: boolean;
  /** Total scheduled events across all parts (may double-count if same part scheduled twice). */
  calendarCount?: number;
  /** Number of distinct parts that have at least one scheduled event. */
  scheduledParts?: number;
}) {
  const first = series.sessions?.[0];
  const sessionCount = series.totalSessions || series.sessions?.length || 0;
  const refCode = first?.refCode || series.seriesId;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Progressive series" onPress={onPress} style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.headerLeft}>
          <View style={styles.refPill}>
            <Text style={styles.refPillText}>{refCode}</Text>
          </View>
          {scheduledParts > 0 ? (
            <View accessibilityLabel={`${scheduledParts} of ${sessionCount} parts scheduled`} style={styles.calendarBadge}>
              <Text style={styles.calendarBadgeText}>{scheduledParts}/{sessionCount} scheduled</Text>
            </View>
          ) : null}
        </View>
        <FavoriteButton isFavorited={isFavorited} onToggle={onToggleFavorite} />
      </View>

      <Text style={styles.seriesTitle} numberOfLines={2}>
        {seriesDisplayTitle(series) || 'Untitled series'}
      </Text>

      <View style={styles.metaRow}>
        {showGameModel ? (
          <>
            <View style={styles.modelDot} />
            <Text style={styles.modelText}>{formatGameModelLabel(series.gameModelId || first?.gameModelId)}</Text>
            <Text style={styles.metaSep}>·</Text>
          </>
        ) : null}
        <Text style={styles.duration}>
          {sessionCount} sessions
          {first?.durationMin ? ` · ${first.durationMin} min each` : ''}
        </Text>
      </View>

      <View style={styles.specStrip}>
        <SpecCell value={series.ageGroup || first?.ageGroup || '—'} label="Age" />
        <SpecCell value={shortPhase(first?.phase)} label="Phase" />
        <SpecCell value={String(sessionCount)} label="Parts" />
      </View>
      {(first?.zone || first?.formationUsed) && (
        <Text style={styles.metaLine} numberOfLines={1}>
          {shortZone(first?.zone)}
          {first?.formationUsed ? ` · ${first?.formationUsed}` : ''}
        </Text>
      )}
    </Pressable>
  );
}

export function DrillCard({
  drill,
  isFavorited,
  onToggleFavorite,
}: {
  drill: VaultDrillLite;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.card} accessibilityLabel={drill.title}>
      <View style={styles.rowBetween}>
        <View style={styles.refPill}>
          <Text style={styles.refPillText}>{drill.refCode}</Text>
        </View>
        <FavoriteButton isFavorited={isFavorited} onToggle={onToggleFavorite} />
      </View>
      <Text style={styles.title}>{drill.title}</Text>
      <Text style={styles.meta}>
        {drill.ageGroup || '—'} · {drill.phase ? humanizeLabel(drill.phase) : '—'} · {drill.durationMin || '—'} min
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#121a2a',
    borderRadius: 14,
    gap: 8,
    padding: 12,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  ref: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  refPill: {
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  refPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  calendarBadge: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(59,130,246,0.45)',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  calendarBadgeText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '700',
  },
  favoritePress: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 40,
  },
  favorite: {
    color: colors.muted,
    fontSize: 18,
  },
  favoriteOn: {
    color: colors.warning,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  seriesTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modelDot: {
    backgroundColor: 'rgba(34,197,94,0.7)',
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  modelText: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '600',
  },
  metaSep: {
    color: '#4b5563',
    fontSize: 12,
  },
  duration: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  specStrip: {
    backgroundColor: 'rgba(55,65,81,0.45)',
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  specCell: {
    backgroundColor: '#151e2f',
    flex: 1,
    gap: 2,
    paddingHorizontal: 3,
    paddingVertical: 8,
  },
  specValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  specLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  metaLine: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    borderTopColor: 'rgba(55,65,81,0.7)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: 8,
  },
  footerText: {
    color: '#6b7280',
    flexShrink: 1,
    fontSize: 11,
  },
});
