import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BoardPreview } from '../../components/boards/BoardPreview';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { describeApiError } from '../../services/api';
import { extractBoardFrames, getBoard, setBoardFavorited } from '../../services/boards.service';

const PAGE_WIDTH = Dimensions.get('window').width;

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [slideIndex, setSlideIndex] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const query = useQuery({
    queryKey: ['boards', id],
    queryFn: () => getBoard(String(id)),
    enabled: Boolean(id),
  });

  const favoriteMutation = useMutation({
    mutationFn: (favorited: boolean) => setBoardFavorited(String(id), favorited),
    onSuccess: (board) => {
      queryClient.setQueryData(['boards', id], board);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
    },
  });

  const frames = useMemo(() => extractBoardFrames(query.data?.diagram), [query.data?.diagram]);

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
  const favorited = Boolean(board.favorited);
  const activeFrame = frames[slideIndex] || frames[0];
  const slideTitle = activeFrame?.title || `Slide ${slideIndex + 1}`;

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setSlideIndex(Math.max(0, Math.min(next, frames.length - 1)));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{board.title || 'Board'}</Text>
            <Text style={styles.subtitle}>
              {board.ageGroup || '--'} · {board.gameModelId || '--'} · {board.shareMode || 'PRIVATE'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorited ? 'Remove favorite' : 'Add favorite'}
            onPress={() => favoriteMutation.mutate(!favorited)}
            style={styles.favoriteBtn}
          >
            <Text style={styles.favorite}>{favorited ? '★' : '☆'}</Text>
          </Pressable>
        </View>

        <Text style={styles.slideMeta}>
          {frames.length > 1 ? `${slideIndex + 1} / ${frames.length}` : '1 slide'} · {slideTitle}
        </Text>

        {frames.length > 1 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            style={styles.pager}
          >
            {frames.map((frame, idx) => (
              <View key={frame?.id || `frame-${idx}`} style={styles.page}>
                <BoardPreview diagram={board.diagram} frame={frame} height={340} />
                {frame?.note ? <Text style={styles.noteInline}>{frame.note}</Text> : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <BoardPreview diagram={board.diagram} frame={activeFrame} height={340} />
        )}

        {frames.length > 1 ? (
          <View style={styles.dots}>
            {frames.map((frame, idx) => (
              <Pressable
                key={frame?.id || `dot-${idx}`}
                onPress={() => {
                  setSlideIndex(idx);
                  pagerRef.current?.scrollTo({ x: idx * PAGE_WIDTH, animated: true });
                }}
                style={[styles.dot, idx === slideIndex ? styles.dotActive : null]}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.note}>
          Phone view is read-only. Use the web editor for drawing tools, principles, and AI chat.
        </Text>

        <View style={styles.actions}>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, paddingBottom: 28 },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerText: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.muted },
  favoriteBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  favorite: { color: colors.warning, fontSize: 28 },
  slideMeta: { color: colors.muted, fontSize: 13, paddingHorizontal: 16 },
  pager: { width: PAGE_WIDTH },
  page: { gap: 8, paddingHorizontal: 16, width: PAGE_WIDTH },
  noteInline: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingHorizontal: 16 },
  dot: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  actions: { gap: 12, paddingHorizontal: 16 },
});
