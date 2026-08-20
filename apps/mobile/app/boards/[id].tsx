import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoardPreview } from '../../components/boards/BoardPreview';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { describeApiError } from '../../services/api';
import { getBoard } from '../../services/boards.service';

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['boards', id],
    queryFn: () => getBoard(String(id)),
    enabled: Boolean(id),
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
          <ErrorMessage message={describeApiError(query.error, 'Board not found.')} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const board = query.data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{board.title || 'Board'}</Text>
        <Text style={styles.subtitle}>
          {board.ageGroup || '--'} · {board.gameModelId || '--'} · {board.shareMode || 'PRIVATE'}
        </Text>

        <BoardPreview diagram={board.diagram} height={260} />

        <Text style={styles.note}>
          Phone view is read-only. Use the web editor for drawing tools, principles, and AI chat.
        </Text>

        <Button title="Edit on web" onPress={() => void Linking.openURL(webPath(`/board/${board.id}`))} />
        {board.sourceSessionId ? (
          <Button
            title="Open source session"
            onPress={() =>
              router.push({
                pathname: '/vault/session/[sessionId]',
                params: { sessionId: board.sourceSessionId! },
              })
            }
            variant="secondary"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.muted },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
