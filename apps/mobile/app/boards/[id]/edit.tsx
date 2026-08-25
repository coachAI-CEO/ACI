import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BoardCanvas } from '../../../components/boards/BoardCanvas';
import { BoardToolPalette, toolHint, type Tool } from '../../../components/boards/BoardToolPalette';
import { BoardAiSheet } from '../../../components/boards/BoardAiSheet';
import { PlayerPopover } from '../../../components/boards/PlayerPopover';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { colors } from '../../../constants/colors';
import { webPath } from '../../../constants/web';
import { describeApiError } from '../../../services/api';
import { deleteBoard, getBoard, patchBoard } from '../../../services/boards.service';
import { evictCachedBoard, writeBoardDetailCache } from '../../../services/offline-cache.service';
import { useAuthStore } from '../../../stores/auth.store';
import { formatFromBoard } from '../../../utils/board-format';
import {
  BOARD_SEQUENCE_DEFAULT_DURATION_MS,
  BOARD_SEQUENCE_MAX_FRAMES,
  duplicateActiveFrame,
  ensureSequence,
  interpolateLayers,
  deleteActiveFrame,
  selectFrame,
  syncActiveFrame,
  updateActiveFrameMeta,
} from '@aci/shared';
import type { PitchFormatId, PitchZoom, WebDiagramV1 } from '@aci/shared';
import { extractBoardFrames } from '../../../services/boards.service';

type Orientation = 'HORIZONTAL' | 'VERTICAL';

const HISTORY_LIMIT = 50;

export default function BoardEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Local editable diagram (mirrors the server, with our edits). Root
  // layers are the "working copy" of the active frame — that contract
  // comes from `ensureSequence` / `syncActiveFrame`.
  const [diagram, setDiagram] = useState<WebDiagramV1 | null>(null);
  const [baseline, setBaseline] = useState<WebDiagramV1 | null>(null);
  const [history, setHistory] = useState<WebDiagramV1[]>([]);
  const [future, setFuture] = useState<WebDiagramV1[]>([]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [team, setTeam] = useState<'ATT' | 'DEF' | 'NEUTRAL'>('ATT');

  const [zoom, setZoom] = useState<PitchZoom>('FULL');
  // Mockup is portrait-first: pitch fills the phone vertically.
  const [orientation, setOrientation] = useState<Orientation>('VERTICAL');

  const frames = useMemo(() => extractBoardFrames(diagram), [diagram]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tweenTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const query = useQuery({
    queryKey: ['boards', id],
    queryFn: () => getBoard(String(id)),
    enabled: Boolean(id),
  });

  // Initialize the local diagram.
  useEffect(() => {
    if (query.data && !diagram) {
      const d = query.data.diagram;
      if (!d) return;
      const withSeq = ensureSequence(d);
      setDiagram(withSeq);
      setBaseline(withSeq);
      setOrientation(withSeq.pitch?.orientation ?? 'VERTICAL');
    }
  }, [query.data, diagram]);

  // canEdit gate.
  useEffect(() => {
    if (query.data && !query.data.canEdit) {
      router.replace({ pathname: '/boards/[id]', params: { id: String(id) } });
    }
  }, [query.data, id, router]);

  // Keep frameIndex in range.
  useEffect(() => {
    if (frameIndex >= frames.length) setFrameIndex(Math.max(0, frames.length - 1));
  }, [frames.length, frameIndex]);

  // ─── History (undo/redo) ────────────────────────────────────────────
  const commit = useCallback((next: WebDiagramV1) => {
    setDiagram((prev) => {
      if (prev) {
        setHistory((h) => {
          const next2 = [...h, prev];
          return next2.length > HISTORY_LIMIT ? next2.slice(next2.length - HISTORY_LIMIT) : next2;
        });
      }
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setDiagram((d) => {
        if (d) setFuture((f) => [d, ...f].slice(0, HISTORY_LIMIT));
        return prev;
      });
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setDiagram((d) => {
        if (d) setHistory((h) => [...h, d].slice(-HISTORY_LIMIT));
        return next;
      });
      return f.slice(1);
    });
  }, []);

  const dirty = useMemo(() => {
    return JSON.stringify(diagram || {}) !== JSON.stringify(baseline || {});
  }, [diagram, baseline]);

  // ─── Cleanup hooks (must run before any early returns below) ────────
  useEffect(() => () => stopPlayback(), []);

  // ─── Save ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!diagram) throw new Error('No diagram');
      const synced = syncActiveFrame(diagram);
      return patchBoard(String(id), { diagram: synced });
    },
    onSuccess: (board) => {
      if (!board.diagram) {
        setBaseline(null);
        setDiagram(null);
      } else {
        const withSeq = ensureSequence(board.diagram);
        setBaseline(withSeq);
        setDiagram(withSeq);
      }
      setHistory([]);
      setFuture([]);
      queryClient.setQueryData(['boards', id], board);
      void writeBoardDetailCache(board, user?.id);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
    },
  });

  // ─── Share / delete / open-on-web (Phase G1, G2, G3) ────────────────
  const shareMutation = useMutation({
    mutationFn: (next: 'PRIVATE' | 'CLUB') => patchBoard(String(id), { shareMode: next }),
    onSuccess: (board) => {
      queryClient.setQueryData(['boards', id], board);
      void writeBoardDetailCache(board, user?.id);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBoard(String(id)),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['boards', id] });
      void evictCachedBoard(String(id), user?.id);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
      router.replace('/boards');
    },
  });

  function openOverflow() {
    const currentShare = query.data?.shareMode || 'PRIVATE';
    const otherShare = currentShare === 'CLUB' ? 'Private' : 'Club';
    const otherShareValue: 'PRIVATE' | 'CLUB' = currentShare === 'CLUB' ? 'PRIVATE' : 'CLUB';
    const shareLabel = `Share with ${otherShare}`;
    const deleteLabel = 'Delete board';
    const webLabel = 'Edit on web';
    const aiLabel = 'AI coach';
    const orientLabel =
      orientation === 'HORIZONTAL' ? 'Switch to vertical pitch' : 'Switch to horizontal pitch';
    const cancel = 'Cancel';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Board actions',
          options: [aiLabel, shareLabel, orientLabel, webLabel, deleteLabel, cancel],
          cancelButtonIndex: 5,
          destructiveButtonIndex: 4,
        },
        (idx) => {
          if (idx === 0) {
            setAiOpen(true);
            return;
          }
          if (idx === 1) {
            shareMutation.mutate(otherShareValue, {
              onError: (err) =>
                Alert.alert('Share failed', describeApiError(err, 'Could not update share mode.')),
            });
            return;
          }
          if (idx === 2) {
            setOrientationLocal(orientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL');
            return;
          }
          if (idx === 3) {
            void Linking.openURL(webPath(`/board/${id}`));
            return;
          }
          if (idx === 4) confirmDelete();
        }
      );
      return;
    }
    Alert.alert('Board actions', undefined, [
      { text: aiLabel, onPress: () => setAiOpen(true) },
      {
        text: shareLabel,
        onPress: () =>
          shareMutation.mutate(otherShareValue, {
            onError: (err) =>
              Alert.alert('Share failed', describeApiError(err, 'Could not update share mode.')),
          }),
      },
      {
        text: orientLabel,
        onPress: () =>
          setOrientationLocal(orientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'),
      },
      {
        text: webLabel,
        onPress: () => void Linking.openURL(webPath(`/board/${id}`)),
      },
      { text: deleteLabel, style: 'destructive', onPress: () => confirmDelete() },
      { text: cancel, style: 'cancel' },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this board?',
      'This permanently removes the board and its frames. You can’t undo this on mobile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(undefined, {
              onError: (err) =>
                Alert.alert('Delete failed', describeApiError(err, 'Could not delete board.')),
            }),
        },
      ]
    );
  }

  // ─── Frame operations ────────────────────────────────────────────────
  function jumpToFrame(index: number) {
    if (!diagram) return;
    setPlaying(false);
    if (playTimer.current) clearTimeout(playTimer.current);
    if (tweenTimer.current) clearInterval(tweenTimer.current);
    const synced = syncActiveFrame(diagram);
    const next = selectFrameByIndex(synced, index);
    // Ensure the new active frame's players/arrows write to root.
    commit(next);
    setFrameIndex(index);
    setSelectedKey(null);
  }

  function selectFrameByIndex(d: WebDiagramV1, index: number): WebDiagramV1 {
    const synced = syncActiveFrame(d);
    const list = synced.sequence?.frames || [];
    if (!list.length) return synced;
    const clamped = Math.max(0, Math.min(list.length - 1, index));
    return selectFrame(synced, list[clamped].id);
  }

  function addFrame() {
    if (!diagram) return;
    if (frames.length >= BOARD_SEQUENCE_MAX_FRAMES) return;
    const synced = syncActiveFrame(diagram);
    const appended = ensureSequence({
      ...synced,
      sequence: {
        ...synced.sequence!,
        frames: [
          ...synced.sequence!.frames,
          {
            id: `f-${Date.now().toString(36)}`,
            title: `Frame ${synced.sequence!.frames.length + 1}`,
            note: '',
            durationMs: BOARD_SEQUENCE_DEFAULT_DURATION_MS,
            players: [],
            arrows: [],
            areas: [],
            labels: [],
          },
        ],
        activeFrameId: synced.sequence!.frames[synced.sequence!.frames.length - 1].id, // current stays active
      },
    });
    commit(appended);
  }

  function duplicateFrame() {
    if (!diagram) return;
    if (frames.length >= BOARD_SEQUENCE_MAX_FRAMES) return;
    const synced = syncActiveFrame(diagram);
    const dup = duplicateActiveFrame(synced);
    commit(dup);
    setFrameIndex(dup.sequence!.frames.findIndex((f) => f.id === dup.sequence!.activeFrameId));
  }

  function deleteFrame() {
    if (!diagram) return;
    if (frames.length <= 1) return;
    const synced = syncActiveFrame(diagram);
    const next = deleteActiveFrame(synced);
    commit(next);
    setFrameIndex(next.sequence!.frames.findIndex((f) => f.id === next.sequence!.activeFrameId));
  }

  function renameFrame(title: string) {
    if (!diagram) return;
    commit(updateActiveFrameMeta(diagram, { title }));
  }

  // ─── Playback (frame-to-frame tween) ────────────────────────────────
  function stopPlayback() {
    setPlaying(false);
    if (playTimer.current) clearTimeout(playTimer.current);
    if (tweenTimer.current) clearInterval(tweenTimer.current);
  }

  function togglePlay() {
    if (!diagram) return;
    if (playing) {
      stopPlayback();
      return;
    }
    if (frames.length < 2) return;
    setPlaying(true);
    schedulePlay();
  }

  function schedulePlay() {
    if (!diagram) return;
    const synced = syncActiveFrame(diagram);
    const list = synced.sequence?.frames || [];
    if (list.length < 2) {
      stopPlayback();
      return;
    }
    const idx = list.findIndex((f) => f.id === synced.sequence!.activeFrameId);
    const next = list[(idx + 1) % list.length];
    const duration = next.durationMs ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS;
    const targetTime = Date.now() + duration;

    // Each tick advances the interpolation ratio.
    const tick = () => {
      if (!diagram) return;
      const remaining = targetTime - Date.now();
      const total = duration;
      const t = Math.max(0, Math.min(1, 1 - remaining / total));
      const from = synced.sequence!.frames[idx];
      const to = next;
      const interpolated = interpolateLayers(from, to, t);
      setDiagram((d) => (d ? { ...d, ...interpolated, sequence: d.sequence } : d));

      if (t >= 1) {
        // Snap to next frame as active.
        const nextDiagram = selectFrame(synced, next.id);
        commit(nextDiagram);
        setFrameIndex((idx + 1) % list.length);
        playTimer.current = setTimeout(() => schedulePlay(), BOARD_SEQUENCE_DEFAULT_DURATION_MS);
        if (tweenTimer.current) clearInterval(tweenTimer.current);
      }
    };

    tweenTimer.current = setInterval(tick, 16);
    playTimer.current = setTimeout(() => {
      tick();
      if (tweenTimer.current) clearInterval(tweenTimer.current);
    }, duration);
  }

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
          <ErrorMessage message={describeApiError(query.error, 'Board unavailable.')} />
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const board = query.data;
  const format: PitchFormatId = formatFromBoard({ ageGroup: board.ageGroup, diagram: board.diagram });
  const activeFrame = frames[frameIndex] || frames[0];
  const activeTitle = activeFrame?.title || `Frame ${frameIndex + 1}`;
  const canAddFrame = frames.length < BOARD_SEQUENCE_MAX_FRAMES;

  function setFormatLocal(next: PitchFormatId) {
    if (!diagram) return;
    commit({ ...diagram, pitch: { ...(diagram.pitch || {}), format: next } });
  }

  function setOrientationLocal(next: Orientation) {
    setOrientation(next);
    if (!diagram) return;
    commit({ ...diagram, pitch: { ...(diagram.pitch || {}), orientation: next } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit board',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Undo"
                onPress={undo}
                disabled={history.length === 0}
                style={({ pressed }) => [
                  styles.navIconBtn,
                  history.length === 0 ? styles.navIconDisabled : null,
                  pressed ? { opacity: 0.5 } : null,
                ]}
              >
                <Text style={styles.navIcon}>↶</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Redo"
                onPress={redo}
                disabled={future.length === 0}
                style={({ pressed }) => [
                  styles.navIconBtn,
                  future.length === 0 ? styles.navIconDisabled : null,
                  pressed ? { opacity: 0.5 } : null,
                ]}
              >
                <Text style={styles.navIcon}>↷</Text>
              </Pressable>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={dirty ? 'Save' : 'Saved'}
                onPress={() => dirty && saveMutation.mutate()}
                disabled={!dirty || saveMutation.isPending}
                style={({ pressed }) => [pressed ? { opacity: 0.5 } : null]}
              >
                <Text style={[styles.navSave, !dirty ? styles.navSaveIdle : null]}>
                  {saveMutation.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More"
                onPress={openOverflow}
                style={({ pressed }) => [pressed ? { opacity: 0.5 } : null]}
              >
                <Text style={styles.navMore}>⋯</Text>
              </Pressable>
            </View>
          ),
          headerBackVisible: false,
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Format + Zoom — matches mockup meta-row */}
        <View style={styles.metaRow}>
          <View style={styles.metaSeg}>
            <SegmentedControl
              accessibilityLabel="Pitch format"
              compact
              value={format}
              onChange={setFormatLocal as (v: string) => void}
              options={[
                { value: '7V7', label: '7v7' },
                { value: '9V9', label: '9v9' },
                { value: '11V11', label: '11v11' },
              ]}
            />
          </View>
          <View style={styles.metaSegCompact}>
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

        {/* Canvas first — tool hint + team pill overlays */}
        <View style={styles.canvasWrap}>
          {diagram ? (
            <BoardCanvas
              diagram={diagram}
              format={format}
              orientation={orientation}
              zoom={zoom}
              tool={tool}
              team={team}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onPlayerEdit={(idx) => setEditingPlayer(idx)}
              onDiagramChange={(next) => commit(next)}
            />
          ) : null}

          <View style={styles.toolBadge} pointerEvents="none">
            <Text style={styles.toolBadgeText}>{toolHint(tool)}</Text>
          </View>

          <View style={styles.teamPill}>
            {(['ATT', 'DEF', 'NEUTRAL'] as const).map((t) => {
              const selected = team === t;
              const label = t === 'NEUTRAL' ? 'NEU' : t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={`Team ${label}`}
                  accessibilityState={{ selected }}
                  onPress={() => setTeam(t)}
                  style={[
                    styles.teamPillBtn,
                    selected && t === 'ATT' ? styles.teamPillAtt : null,
                    selected && t === 'DEF' ? styles.teamPillDef : null,
                    selected && t === 'NEUTRAL' ? styles.teamPillNeu : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.teamPillLabel,
                      selected ? styles.teamPillLabelSelected : null,
                      selected && t === 'DEF' ? styles.teamPillLabelOnDef : null,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {editingPlayer != null && diagram ? (
          <View style={styles.popoverOverlay} pointerEvents="box-none">
            <PlayerPopover
              player={diagram.players?.[editingPlayer]}
              onChange={(p) => {
                if (!diagram) return;
                commit({
                  ...diagram,
                  players: (diagram.players || []).map((cur, i) => (i === editingPlayer ? p : cur)),
                });
              }}
              onDelete={() => {
                if (!diagram) return;
                commit({
                  ...diagram,
                  players: (diagram.players || []).filter((_, i) => i !== editingPlayer),
                });
                setEditingPlayer(null);
                setSelectedKey(null);
              }}
              onClose={() => setEditingPlayer(null)}
            />
          </View>
        ) : null}

        {/* Frame bar — below canvas per mockup */}
        <View style={styles.seq}>
          <View style={styles.seqHead}>
            <Text style={styles.seqTitle} numberOfLines={1}>
              Frame {frameIndex + 1} · {activeTitle}
            </Text>
            <Text style={styles.seqCounter}>
              {frameIndex + 1} of {frames.length}
            </Text>
          </View>

          <View style={styles.seqFrames}>
            {frames.map((f, i) => {
              const selected = i === frameIndex;
              const name = f.title || `Frame ${i + 1}`;
              return (
                <Pressable
                  key={f.id || `f-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  accessibilityState={{ selected }}
                  onPress={() => jumpToFrame(i)}
                  onLongPress={() => {
                    if (Platform.OS === 'ios') {
                      Alert.prompt(
                        'Rename frame',
                        undefined,
                        (text) => {
                          if (text != null && text.trim()) renameFrame(text.trim());
                        },
                        'plain-text',
                        name
                      );
                    }
                  }}
                  style={[styles.seqFrame, selected ? styles.seqFrameActive : null]}
                >
                  <Text style={[styles.seqFrameNum, selected ? styles.seqFrameTextActive : null]}>
                    {i + 1}
                  </Text>
                  <Text
                    style={[styles.seqFrameName, selected ? styles.seqFrameTextActive : null]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.seqTools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add frame"
              onPress={addFrame}
              disabled={!canAddFrame}
              style={[styles.seqGhost, !canAddFrame ? styles.seqGhostDisabled : null]}
            >
              <Text style={styles.seqGhostLabel}>+ Frame</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Duplicate frame"
              onPress={duplicateFrame}
              disabled={!canAddFrame}
              style={[styles.seqGhost, !canAddFrame ? styles.seqGhostDisabled : null]}
            >
              <Text style={styles.seqGhostLabel}>Duplicate</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete frame"
              onPress={deleteFrame}
              disabled={frames.length <= 1}
              style={[styles.seqGhost, frames.length <= 1 ? styles.seqGhostDisabled : null]}
            >
              <Text style={styles.seqGhostLabel}>Delete</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause' : 'Play'}
              onPress={togglePlay}
              style={[styles.seqGhost, styles.seqGhostPrimary]}
            >
              <Text style={[styles.seqGhostLabel, styles.seqGhostPrimaryLabel]}>
                {playing ? '❚❚ Pause' : '▶ Play'}
              </Text>
            </Pressable>
          </View>
        </View>

        {saveMutation.error ? (
          <View style={styles.saveError}>
            <ErrorMessage message={describeApiError(saveMutation.error, 'Save failed.')} />
          </View>
        ) : null}

        <BoardAiSheet
          visible={aiOpen}
          boardId={String(id)}
          diagram={diagram}
          onClose={() => setAiOpen(false)}
          onApplyDiagram={(next) => {
            const staged: WebDiagramV1 = {
              ...next,
              pitch: next.pitch ?? diagram?.pitch,
            };
            commit(staged);
            setAiOpen(false);
          }}
        />

        <BoardToolPalette tool={tool} onTool={setTool} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  container: { gap: 12, padding: 16 },
  headerLeft: { flexDirection: 'row', gap: 2, marginLeft: 4 },
  headerRight: { alignItems: 'center', flexDirection: 'row', gap: 4, marginRight: 4 },
  navIconBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  navIconDisabled: { opacity: 0.35 },
  navIcon: { color: colors.primary, fontSize: 20, fontWeight: '600' },
  navSave: { color: colors.primary, fontSize: 14, fontWeight: '800', paddingHorizontal: 6 },
  navSaveIdle: { color: colors.muted, fontWeight: '600' },
  navMore: { color: colors.primary, fontSize: 22, fontWeight: '700', paddingHorizontal: 6 },
  metaRow: {
    backgroundColor: colors.background,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaSeg: { flex: 1 },
  metaSegCompact: { flex: 0.85 },
  canvasWrap: {
    backgroundColor: '#062816',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  toolBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    left: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: 'absolute',
    top: 14,
  },
  toolBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  teamPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    position: 'absolute',
    right: 14,
    top: 14,
  },
  teamPillBtn: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  teamPillAtt: { backgroundColor: '#22c55e' },
  teamPillDef: { backgroundColor: '#ef4444' },
  teamPillNeu: { backgroundColor: '#f59e0b' },
  teamPillLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  teamPillLabelSelected: { color: '#052e16' },
  teamPillLabelOnDef: { color: '#fff' },
  seq: {
    backgroundColor: colors.background,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  seqHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  seqTitle: { color: colors.text, flex: 1, fontSize: 12, fontWeight: '700', marginRight: 8 },
  seqCounter: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  seqFrames: { flexDirection: 'row', gap: 6 },
  seqFrame: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 6,
  },
  seqFrameActive: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: colors.primary,
  },
  seqFrameNum: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  seqFrameName: { color: colors.muted, fontSize: 10, marginTop: 1, textAlign: 'center' },
  seqFrameTextActive: { color: colors.text },
  seqTools: { flexDirection: 'row', gap: 6, marginTop: 6 },
  seqGhost: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 6,
  },
  seqGhostPrimary: { borderColor: 'rgba(34,197,94,0.35)' },
  seqGhostDisabled: { opacity: 0.35 },
  seqGhostLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  seqGhostPrimaryLabel: { color: colors.primary, fontWeight: '700' },
  saveError: { paddingHorizontal: 12, paddingTop: 4 },
  popoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
