import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import type { VaultDrillLite, VaultSeries, VaultSession } from '../../services/vault.service';

export function SessionCard({
  session,
  isFavorited,
  onToggleFavorite,
}: {
  session: VaultSession;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.ref}>{session.refCode || 'Session'}</Text>
        <Text onPress={onToggleFavorite} style={[styles.favorite, isFavorited ? styles.favoriteOn : null]}>
          {isFavorited ? '★' : '☆'}
        </Text>
      </View>
      <Text style={styles.title}>{session.title || 'Untitled Session'}</Text>
      <Text style={styles.meta}>
        {session.ageGroup || '--'} · {session.gameModelId || '--'} · {session.durationMin || '--'} min
      </Text>
    </View>
  );
}

export function SeriesCard({
  series,
  isFavorited,
  onToggleFavorite,
}: {
  series: VaultSeries;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.ref}>{series.seriesId}</Text>
        <Text onPress={onToggleFavorite} style={[styles.favorite, isFavorited ? styles.favoriteOn : null]}>
          {isFavorited ? '★' : '☆'}
        </Text>
      </View>
      <Text style={styles.title}>{series.sessions?.[0]?.title || 'Progressive Series'}</Text>
      <Text style={styles.meta}>{series.totalSessions || series.sessions?.length || 0} sessions</Text>
    </View>
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
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.ref}>{drill.refCode}</Text>
        <Text onPress={onToggleFavorite} style={[styles.favorite, isFavorited ? styles.favoriteOn : null]}>
          {isFavorited ? '★' : '☆'}
        </Text>
      </View>
      <Text style={styles.title}>{drill.title}</Text>
      <Text style={styles.meta}>
        {drill.ageGroup || '--'} · {drill.phase || '--'} · {drill.durationMin || '--'} min
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ref: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  favorite: {
    color: colors.muted,
    fontSize: 18,
  },
  favoriteOn: {
    color: '#fbbf24',
  },
});
