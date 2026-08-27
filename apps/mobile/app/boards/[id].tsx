import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
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
  useWindowDimensions,
  View,
} from 'react-native';
import { BoardPreview } from '../../components/boards/BoardPreview';
import { BoardSequenceBar } from '../../components/boards/BoardSequenceBar';
import { BoardAiSheet } from '../../components/boards/BoardAiSheet';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { describeApiError } from '../../services/api';
import { extractBoardFrames, getBoard, patchBoard, setBoardFavorited } from '../../services/boards.service';
import { readCachedBoardDetail, writeBoardDetailCache } from '../../services/offline-cache.service';
import { useAuthStore } from '../../stores/auth.store';
import { formatGameModelLabel } from '../../utils/format';
import { formatFromBoard } from '../../utils/board-format';
import { useDevicePitchOrientation } from '../../hooks/useDevicePitchOrientation';
import type { PitchFormatId, PitchZoom, WebDiagramV1 } from '@aci/shared';
import { zoomFromPitchVariant } from '@aci/shared';

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [slideIndex, setSlideIndex] = useState(0);
  const pagerRef = useRef<ScrollView>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const orientation = useDevicePitchOrientation();

  // Local viewer-only state — never mutates the saved diagram (except zoom when canEdit).
  const [zoom, setZoom] = useState<PitchZoom>('FULL');

  // Pitch height: fill width; aspect follows device posture.
  const pitchHeight =
    orientation === 'VERTICAL'
      ? Math.round((windowWidth - 32) * (120 / 80))
      : Math.round(Math.min(windowHeight * 0.45, (windowWidth - 32) * (80 / 120)));

  // AI chat state.
  const [aiOpen, setAiOpen] = useState(false);
  const [previewOverlay, setPreviewOverlay] = useState<{ diagram: WebDiagramV1; reply: string } | null>(null);

  const userId = useAuthStore((s) => s.user?.id);

  // Seed from offline cache so first paint isn't a spinner when offline.
  const [seededBoard] = useState(() => null as Awaited<ReturnType<typeof readCachedBoardDetail>>);

  const query = useQuery({
    queryKey: ['boards', id],
    queryFn: async () => {
      try {
        const board = await getBoard(String(id));
        void writeBoardDetailCache(board, userId);
        return board;
      } catch (err) {
        // Network unreachable? Fall back to the cached detail if we have one.
        const cached = await readCachedBoardDetail(String(id), userId);
        if (cached) return cached;
        throw err;
      }
    },
    enabled: Boolean(id),
    initialData: seededBoard ?? undefined,
    staleTime: 60_000,
  });

  useEffect(() => {
    setSlideIndex(0);
    setZoom(zoomFromPitchVariant(query.data?.diagram?.pitch?.variant));
  }, [id, query.data?.diagram?.pitch?.variant]);

  const favoriteMutation = useMutation({
    mutationFn: (favorited: boolean) => setBoardFavorited(String(id), favorited),
    onSuccess: (board) => {
      queryClient.setQueryData(['boards', id], board);
      void writeBoardDetailCache(board, userId);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
    },
  });

  const patchDiagramMutation = useMutation({
    mutationFn: (next: WebDiagramV1) => patchBoard(String(id), { diagram: next }),
    onSuccess: (board) => {
      queryClient.setQueryData(['boards', id], board);
      void writeBoardDetailCache(board, userId);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
    },
  });

  const applyZoom = useCallback(
    (next: PitchZoom) => {
      setZoom(next);
      const diagram = query.data?.diagram;
      if (!diagram || !query.data?.canEdit) return;
      if (zoomFromPitchVariant(diagram.pitch?.variant) === next) return;
      patchDiagramMutation.mutate({
        ...diagram,
        pitch: {
          ...diagram.pitch,
          variant: next,
        },
      });
    },
    [query.data?.canEdit, query.data?.diagram, patchDiagramMutation]
  );

  const frames = useMemo(() => extractBoardFrames(query.data?.diagram), [query.data?.diagram]);

  // Keep these hooks above the early returns so the hook order is stable
  // across loading / error / loaded renders.
  const boardId = query.data?.id ?? '';
  const copyShareLink = useCallback(async () => {
    if (!boardId) return;
    const link = webPath(`/board/${boardId}`);
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('Link copied', 'Board link is on your clipboard.');
    } catch {
      Alert.alert('Copy failed', 'Please copy the link from the Share sheet instead.');
    }
  }, [boardId]);

  const onShare = useCallback(async () => {
    if (!boardId) return;
    try {
      await Share.share({ message: webPath(`/board/${boardId}`) });
    } catch {
      // user cancelled
    }
  }, [boardId]);

  const onLongPress = useCallback(() => {
    if (!boardId) return;
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
      Alert.alert('Board', webPath(`/board/${boardId}`), [
        { text: 'Copy link', onPress: () => void copyShareLink() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [boardId, copyShareLink]);

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
    const next = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setSlideIndex(Math.max(0, Math.min(next, frames.length - 1)));
  };

  function jumpToFrame(index: number) {
    setSlideIndex(index);
    pagerRef.current?.scrollTo({ x: index * windowWidth, animated: true });
  }

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
            <Text style={styles.formatReadonly}>{format.replace('V', 'v')}</Text>
          </View>

          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarLabel}>Zoom</Text>
            <SegmentedControl
              accessibilityLabel="Pitch zoom"
              compact
              value={zoom}
              onChange={applyZoom}
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
              style={[styles.pager, { width: windowWidth }]}
            >
              {frames.map((frame, idx) => (
                <View key={frame?.id || `frame-${idx}`} style={[styles.page, { width: windowWidth }]}>
                  <BoardPreview
                    diagram={board.diagram}
                    frame={frame}
                    zoom={zoom}
                    orientation={orientation}
                    height={pitchHeight}
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
              height={pitchHeight}
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
          {canEdit
            ? 'Open the editor to draw players, arrows, frames, and AI chat. Web still has denser desktop tools.'
            : 'This board is view-only on phone. Open it on web if you need to edit.'}
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
          <View style={styles.actionsRow}>
            <Button title="AI coach" variant="secondary" onPress={() => setAiOpen(true)} />
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

        {previewOverlay ? (
          <View style={styles.previewOverlay}>
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>AI preview</Text>
              <Text style={styles.previewBody} numberOfLines={3}>{previewOverlay.reply}</Text>
              <View style={styles.previewActions}>
                <Button
                  title="Discard"
                  variant="secondary"
                  onPress={() => setPreviewOverlay(null)}
                />
                <Button
                  title="Apply"
                  onPress={() => {
                    patchDiagramMutation.mutate(previewOverlay.diagram);
                    setPreviewOverlay(null);
                  }}
                  disabled={!canEdit || patchDiagramMutation.isPending}
                />
              </View>
            </View>
          </View>
        ) : null}

        <BoardAiSheet
          visible={aiOpen}
          boardId={board.id}
          diagram={board.diagram || null}
          onClose={() => setAiOpen(false)}
          onApplyDiagram={(next, reply) => {
            setAiOpen(false);
            if (canEdit) {
              patchDiagramMutation.mutate(next);
            } else {
              setPreviewOverlay({ diagram: next, reply });
            }
          }}
        />
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
  formatReadonly: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  slideMeta: { color: colors.muted, fontSize: 13, paddingHorizontal: 16 },
  pager: {},
  page: { gap: 8, paddingHorizontal: 16 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingHorizontal: 16 },
  dot: { backgroundColor: colors.border, borderRadius: 999, height: 8, width: 8 },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  actions: { gap: 12, paddingHorizontal: 16 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 10,
    padding: 16,
    width: '90%',
  },
  previewTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  previewBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  previewActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', paddingTop: 4 },
});
