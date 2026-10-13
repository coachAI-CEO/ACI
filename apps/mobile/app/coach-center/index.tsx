import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { describeApiError } from '../../services/api';
import { getCoachCenterAccess } from '../../services/coach-center.service';
import { useCoachCenterStore } from '../../stores/coach-center.store';

export default function CoachCenterHomeScreen() {
  const selectedTeamId = useCoachCenterStore((s) => s.selectedTeamId);
  const setSelectedTeamId = useCoachCenterStore((s) => s.setSelectedTeamId);

  const query = useQuery({
    queryKey: ['coach-center', 'access'],
    queryFn: getCoachCenterAccess,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error, 'Coach Center is unavailable.')} />
          <Button title="Open on web" onPress={() => void Linking.openURL(webPath('/coach-center'))} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const teams = query.data?.teams || [];
  const clubs = query.data?.clubs || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Coach Center</Text>
        <Text style={styles.subtitle}>
          Team week, sideline links, and game-day packs stay in-app. Curriculum, chat, and team editing stay on web.
        </Text>

        {clubs.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Clubs</Text>
            {clubs.map((club) => (
              <Text key={club.clubId} style={styles.meta}>
                {club.clubName} · {club.role}
                {club.gameModelId ? ` · ${club.gameModelId}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Teams ({teams.length})</Text>
          {teams.length ? (
            teams.map((team) => {
              const selected = selectedTeamId === team.id;
              return (
                <View key={team.id} style={[styles.teamRow, selected ? styles.teamSelected : null]}>
                  <View style={styles.teamMeta}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.meta}>
                      {team.ageGroup || '--'} · {team.gameModelLabel || team.gameModelId || '--'}
                      {team.clubName ? ` · ${team.clubName}` : ''}
                    </Text>
                    {team.season?.currentWeek?.theme ? (
                      <Text style={styles.meta}>Week focus: {team.season.currentWeek.theme}</Text>
                    ) : null}
                  </View>
                  <Button
                    title="Open"
                    onPress={() => {
                      setSelectedTeamId(team.id);
                      router.push({ pathname: '/coach-center/[teamId]', params: { teamId: team.id } });
                    }}
                    variant="secondary"
                  />
                </View>
              );
            })
          ) : (
            <Text style={styles.meta}>No teams assigned yet. Create or assign teams on the web.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Web-only tools</Text>
          <Text style={styles.meta}>Edit teams, curriculum, and coach chat on the website.</Text>
          <Button title="Open Coach Center on web" onPress={() => void Linking.openURL(webPath('/coach-center'))} variant="secondary" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  teamRow: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  teamSelected: { borderColor: colors.primary },
  teamMeta: { gap: 4 },
  teamName: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
