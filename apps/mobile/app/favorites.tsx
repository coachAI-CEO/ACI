import { useQuery } from '@tanstack/react-query';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DrillCard, SeriesCard, SessionCard } from '../components/vault/VaultCards';
import { colors } from '../constants/colors';
import {
  getFavorites,
  toggleDrillFavorite,
  toggleSeriesFavorite,
  toggleSessionFavorite,
} from '../services/favorites.service';

export default function FavoritesScreen() {
  const query = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const payload = query.data || { sessions: [], drills: [], series: [], counts: { sessions: 0, drills: 0, series: 0, total: 0 } };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Favorites</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sessions ({payload.counts.sessions})</Text>
          {payload.sessions.map((session: any) => (
            <SessionCard
              key={session.id}
              session={session}
              isFavorited
              onToggleFavorite={() => {
                toggleSessionFavorite(session.id, true)
                  .then(() => query.refetch())
                  .catch(() => undefined);
              }}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Series ({payload.counts.series})</Text>
          {payload.series.map((series: any) => (
            <SeriesCard
              key={series.seriesId}
              series={series}
              isFavorited
              onToggleFavorite={() => {
                toggleSeriesFavorite(series.seriesId, true)
                  .then(() => query.refetch())
                  .catch(() => undefined);
              }}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drills ({payload.counts.drills})</Text>
          {payload.drills.map((drill: any) => (
            <DrillCard
              key={drill.id || drill.refCode}
              drill={{
                id: drill.id,
                refCode: drill.refCode || drill.id,
                title: drill.title || 'Drill',
                ageGroup: drill.ageGroup,
                gameModelId: drill.gameModelId,
                phase: drill.phase,
                zone: drill.zone,
                durationMin: drill.durationMin,
              }}
              isFavorited
              onToggleFavorite={() => {
                toggleDrillFavorite(drill.refCode || drill.id, true)
                  .then(() => query.refetch())
                  .catch(() => undefined);
              }}
            />
          ))}
        </View>

        {!payload.counts.total ? <Text style={styles.empty}>No favorites yet.</Text> : null}
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
    padding: 14,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  empty: {
    color: colors.muted,
  },
});
