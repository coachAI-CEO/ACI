import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { describeApiError } from '../../services/api';
import { listBoards } from '../../services/boards.service';

export default function BoardsHomeScreen() {
  const query = useQuery({
    queryKey: ['boards', 'list'],
    queryFn: () => listBoards(40),
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
          <ErrorMessage message={describeApiError(query.error, 'Boards unavailable.')} />
          <Button title="Open on web" onPress={() => void Linking.openURL(webPath('/boards'))} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const boards = query.data?.boards || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Boards</Text>
        <Text style={styles.subtitle}>View boards on phone. Edit on web for drawing tools.</Text>

        {boards.length ? (
          boards.map((board) => (
            <View key={board.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{board.title || 'Untitled board'}</Text>
                {board.favorited ? <Text style={styles.star}>★</Text> : null}
              </View>
              <Text style={styles.meta}>
                {board.ageGroup || '--'} · {board.gameModelId || '--'}
                {board.phase ? ` · ${board.phase}` : ''}
                {board.slideCount ? ` · ${board.slideCount} slides` : ''}
              </Text>
              <View style={styles.row}>
                <Button
                  title="View"
                  onPress={() => router.push({ pathname: '/boards/[id]', params: { id: board.id } })}
                  variant="secondary"
                />
                <Button
                  title="Edit on web"
                  onPress={() => void Linking.openURL(webPath(`/board/${board.id}`))}
                  variant="secondary"
                />
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.meta}>No boards yet. Create one on the web.</Text>
        )}

        <Button title="Open boards on web" onPress={() => void Linking.openURL(webPath('/boards'))} />
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
    gap: 8,
    padding: 12,
  },
  cardTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  star: { color: colors.warning, fontSize: 18 },
  meta: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
});
