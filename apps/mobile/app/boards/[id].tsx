import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Dimensions,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BoardPreview } from '../../components/boards/BoardPreview';
import { BoardSequenceBar } from '../../components/boards/BoardSequenceBar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { describeApiError } from '../../services/api';
import { extractBoardFrames, getBoard, setBoardFavorited } from '../../services/boards.service';
import { formatGameModelLabel } from '../../utils/format';
import { formatFromBoard } from '../../utils/board-format';
import type { PitchFormatId, PitchZoom } from '@aci/shared';

type Orientation = 'HORIZONTAL' | 'VERTICAL';

const PAGE_WIDTH = Dimensions.get('window').width;
// BoardPreview preserves aspect ratio internally via preserveAspectRatio,
// so the height is just a hint; we size to roughly an 11v11 aspect for
// dense toolbars.
const PITCH_HEIGHT = Math.round((PAGE_WIDTH - 32) * (120 / 80));

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [slideIndex, setSlideIndex] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  // Local viewer-only state — never mutates the saved diagram.
  const [zoom, setZoom] = useState<PitchZoom>('FULL');
  const [orientation, setOrientation] = useState<Orientation>('HORIZONTAL');

  const query = useQuery({
    queryKey: ['boards', id],
    queryFn: () => getBoard(String(id)),
    enabled: Boolean(id),
  });

  useEffect(() => {
    setSlideIndex(0);
    setZoom('FULL');
    setOrientation(query.data?.diagram?.pitch?.orientation ?? 'HORIZONTAL');
  }, [id, query.data?.diagram?.pitch?.orientation]);

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
  const format: PitchFormatId = formatFromBoard({ ageGroup: board.ageGroup, diagram: board.diagram });
  const canEdit = Boolean(board.canEdit);
  const sequence = (board.diagram?.sequence?.frames?.length ?? 0) > 0 ? board.diagram?.sequence : null;

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setSlideIndex(Math.max(0, Math.min(next, frames.length - 1)));
  };

  function jumpToFrame(index: number) {
    setSlideIndex(index);
    pagerRef.current?.scrollTo({ x: index * PAGE_WIDTH, animated: true });
  }

  const copyShareLink = useCallback(async () => {
    const link = webPath(`/board/${board.id}`);
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('Link copied', 'Board link is on your clipboard.');
    } catch {
      Alert.alert('Copy failed', 'Please copy the link from the Share sheet instead.');
    }
  }, [board.id]);

  const onShare = useCallback(async () => {
    try {
      await Share.share({ message: webPath(`/board/${board.id}`) });
    } catch {
      // user cancelled
    }
  }, [board.id]);

  const onLongPress = useCallback(() => {
    const copyIdx = 0;
    const cancelIdx = 1;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Copy share link', 'Cancel'], cancelButtonIndex: cancelIdx },
        (idx) => {
          if (idx === copyIdx) void copyShareLink();
        }
      );
    } else {
      Alert.alert('Board actions', undefined, [
        { text: 'Copy share link', onPress: () => void copyShareLink() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [copyShareLink]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{board.title || 'Board'}</Text>
            <Text style={styles.subtitle}>
              {board.ageGroup || '--'} · {board.gameModelId ? formatGameModelLabel(board.gameModelId) : '--'} ·{' '}
              {board.shareMode || 'PRIVATE'}
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

        <View style={styles.toolbar}>
          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarLabel}>Format</Text>
            <SegmentedControl
              accessibilityLabel="Pitch format"
              compact
              value={format}
              onChange={() => {
                /* Read-only viewer: format follows the saved diagram +
                   ageGroup. Mutations live in Phase D. */
              }}
              options={[
                { value: '7V7', label: '7v7' },
                { value: '9V9', label: '9v9' },
                { value: '11V11', label: '11v11' },
              ]}
            />
          </View>

          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarLabel}>Orientation</Text>
            <SegmentedControl
              accessibilityLabel="Pitch orientation"
              compact
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: 'HORIZONTAL', label: 'Horizontal' },
                { value: 'VERTICAL', label: 'Vertical' },
              ]}
            />
          </View>

          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarLabel}>Zoom</Text>
            <SegmentedControl
              accessibilityLabel="Pitch zoom"
              compact
              value={zoom}
              onChange={setZoom}
              options={[
                { value: 'FULL', label: 'Full' },
                { value: 'HALF', label: 'Half' },
                { value: 'THIRD', label: 'Third' },
              ]}
            />
          </View>
        </View>

        <Text style={styles.slideMeta}>
          {frames.length > 1 ? `${slideIndex + 1} / ${frames.length}` : '1 slide'} · {slideTitle}
        </Text>

        {/* Long-press the pitch to copy a share link (C8 partial). */}
        <Pressable onLongPress={onLongPress} delayLongPress={400}>
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
                  <BoardPreview
                    diagram={board.diagram}
                    frame={frame}
                    zoom={zoom}
                    orientation={orientation}
                    height={PITCH_HEIGHT}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <BoardPreview
              diagram={board.diagram}
              frame={activeFrame}
              zoom={zoom}
              orientation={orientation}
              height={PITCH_HEIGHT}
            />
          )}
        </Pressable>

        {sequence ? (
          <BoardSequenceBar sequence={sequence} activeIndex={slideIndex} onSelect={jumpToFrame} />
        ) : frames.length > 1 ? (
          <View style={styles.dots}>
            {frames.map((frame, idx) => (
              <Pressable
                key={frame?.id || `dot-${idx}`}
                onPress={() => jumpToFrame(idx)}
                style={[styles.dot, idx === slideIndex ? styles.dotActive : null]}
              />
            ))}
          </View>
        ) : null}

        <Text style={styles.note}>
          Phone view is read-only. Use the web editor for drawing tools, principles, and AI chat.
        </Text>

        <View style={styles.actions}>
          {canEdit ? <Badge label="You can edit" tone="default" /> : <Badge label="View only" tone="muted" />}
          <View style={styles.actionsRow}>
            {canEdit ? (
              <Button
                title="Open editor"
                onPress={() => router.push({ pathname: '/boards/[id]/edit', params: { id: board.id } })}
              />
            ) : (
              <Button
                title="Edit on web"
                onPress={() => void Linking.openURL(webPath(`/board/${board.id}`))}
              />
            )}
            <Button title="Share" variant="secondary" onPress={onShare} />
          </View>
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
  toolbar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 16,
    padding: 10,
  },
  toolbarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  toolbarLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  slideMeta: { color: colors.muted, fontSize: 13, paddingHorizontal: 16 },
  pager: { width: PAGE_WIDTH },
  page: { gap: 8, paddingHorizontal: 16, width: PAGE_WIDTH },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingHorizontal: 16 },
  dot: { backgroundColor: colors.border, borderRadius: 999, height: 8, width: 8 },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  actions: { gap: 12, paddingHorizontal: 16 },
  actionsRow: { flexDirection: 'row', gap: 8 },
});
