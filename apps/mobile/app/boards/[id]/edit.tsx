import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BoardCanvas } from '../../../components/boards/BoardCanvas';
import { BoardSequenceBar } from '../../../components/boards/BoardSequenceBar';
import { BoardToolPalette, type Tool } from '../../../components/boards/BoardToolPalette';
import { BoardAiSheet } from '../../../components/boards/BoardAiSheet';
import { PlayerPopover } from '../../../components/boards/PlayerPopover';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import { getBoard, patchBoard } from '../../../services/boards.service';
import { formatGameModelLabel } from '../../../utils/format';
import { formatFromBoard } from '../../../utils/board-format';
import {
  BOARD_SEQUENCE_DEFAULT_DURATION_MS,
  BOARD_SEQUENCE_MAX_FRAMES,
  BOARD_SEQUENCE_TWEEN_MS,
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
  const [orientation, setOrientation] = useState<Orientation>('HORIZONTAL');

  const frames = useMemo(() => extractBoardFrames(diagram), [diagram]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
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
      setOrientation(withSeq.pitch?.orientation ?? 'HORIZONTAL');
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

  // ─── Navigation guard ────────────────────────────────────────────────
  const navAway = useCallback(
    (after: () => void) => {
      if (!dirty) {
        after();
        return;
      }
      // Real alert via the prompt card shown at the bottom of the screen.
      const evt = new CustomEvent('board:prompt-leave', { detail: { after } });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(evt);
      } else {
        // Mobile: just go if user agreed (expo-router gestures back). We
        // emit a native alert via the embedded PromptSaveOnExit below.
        after();
      }
    },
    [dirty]
  );

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
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
    },
  });

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

  function setFrameDuration(ms: number) {
    if (!diagram) return;
    commit(updateActiveFrameMeta(diagram, { durationMs: ms }));
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
  const activeDuration = activeFrame?.durationMs ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS;
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
          headerTitle: () => (
            <View>
              <Text style={styles.headerTitle}>{board.title || 'Edit board'}</Text>
              <Text style={styles.headerSubtitle}>
                {board.ageGroup || '--'} · {board.gameModelId ? formatGameModelLabel(board.gameModelId) : '--'}
              </Text>
            </View>
          ),
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() =>
                navAway(() =>
                  router.replace({ pathname: '/boards/[id]', params: { id: String(id) } })
                )
              }
              style={({ pressed }) => [pressed ? { opacity: 0.5 } : null]}
            >
              <Text style={styles.headerBack}>← Back</Text>
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.toolbar}>
          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarLabel}>Format</Text>
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
          <View style={styles.toolbarRow}>
            <Text style={styles.toolbarLabel}>Orientation</Text>
            <SegmentedControl
              accessibilityLabel="Pitch orientation"
              compact
              value={orientation}
              onChange={setOrientationLocal}
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

        <View style={styles.frameMetaRow}>
          <Text style={styles.frameMetaLabel}>Frame {frameIndex + 1} of {frames.length}</Text>
          <TextInput
            value={editingTitle}
            onChangeText={setEditingTitle}
            onEndEditing={() => editingTitle !== activeTitle && renameFrame(editingTitle)}
            placeholder={activeTitle}
            placeholderTextColor={colors.muted}
            style={styles.frameTitleInput}
            returnKeyType="done"
          />
          <View style={styles.frameActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause' : 'Play'}
              onPress={togglePlay}
              style={styles.frameActionBtn}
            >
              <Text style={styles.frameActionLabel}>{playing ? '❚❚' : '▶'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add frame"
              onPress={addFrame}
              disabled={!canAddFrame}
              style={[styles.frameActionBtn, !canAddFrame ? styles.frameActionDisabled : null]}
            >
              <Text style={styles.frameActionLabel}>+</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Duplicate frame"
              onPress={duplicateFrame}
              disabled={!canAddFrame}
              style={[styles.frameActionBtn, !canAddFrame ? styles.frameActionDisabled : null]}
            >
              <Text style={styles.frameActionLabel}>⎘</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete frame"
              onPress={deleteFrame}
              disabled={frames.length <= 1}
              style={[styles.frameActionBtn, frames.length <= 1 ? styles.frameActionDisabled : null]}
            >
              <Text style={styles.frameActionLabel}>×</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.frameDurationRow}>
          <Text style={styles.toolbarLabel}>Frame duration ({(activeDuration / 1000).toFixed(1)}s)</Text>
          <View style={styles.frameDurationBtns}>
            {[800, 1600, 3200, 6000].map((ms) => (
              <Pressable
                key={ms}
                accessibilityRole="button"
                accessibilityLabel={`${ms / 1000}s`}
                onPress={() => setFrameDuration(ms)}
                style={[styles.durationBtn, activeDuration === ms ? styles.durationBtnSelected : null]}
              >
                <Text style={[styles.durationLabel, activeDuration === ms ? styles.durationLabelSelected : null]}>
                  {ms / 1000}s
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

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

        <View style={styles.frameBar}>
          <BoardSequenceBar
            sequence={{
              frames,
              activeFrameId: frames[frameIndex]?.id || null,
            } as any}
            activeIndex={frameIndex}
            onSelect={jumpToFrame}
          />
        </View>

        <View style={styles.actions}>
          <View style={styles.actionsRow}>
            <Button title="Undo" variant="secondary" onPress={undo} disabled={history.length === 0} />
            <Button title="Redo" variant="secondary" onPress={redo} disabled={future.length === 0} />
            <Button title="AI coach" variant="secondary" onPress={() => setAiOpen(true)} />
          </View>
          <View style={styles.actionsRow}>
            <Button
              title={dirty ? 'Save' : 'Saved'}
              onPress={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
            />
            <Button
              title="Save & exit"
              variant="secondary"
              onPress={() =>
                saveMutation.mutate(undefined, {
                  onSuccess: () => router.replace({ pathname: '/boards/[id]', params: { id: String(id) } }),
                })
              }
              disabled={!diagram || saveMutation.isPending}
            />
          </View>
          {saveMutation.error ? (
            <ErrorMessage message={describeApiError(saveMutation.error, 'Save failed.')} />
          ) : null}
        </View>

        <BoardAiSheet
          visible={aiOpen}
          boardId={String(id)}
          diagram={diagram}
          onClose={() => setAiOpen(false)}
          onApplyDiagram={(next) => {
            // Stage the AI's updated diagram into the active frame using the
            // same sequence helper that drag-and-drop uses. The next save
            // flushes root → frame via syncActiveFrame() inside `commit`.
            const staged: WebDiagramV1 = {
              ...next,
              pitch: next.pitch ?? diagram?.pitch,
            };
            commit(staged);
            setAiOpen(false);
          }}
        />

        <BoardToolPalette tool={tool} onTool={setTool} team={team} onTeam={setTeam} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  container: { gap: 12, padding: 16 },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: colors.muted, fontSize: 11 },
  headerBack: { color: colors.primary, fontSize: 16, fontWeight: '600', paddingHorizontal: 8 },
  toolbar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    margin: 12,
    padding: 10,
  },
  toolbarRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  toolbarLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  frameMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  frameMetaLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  frameTitleInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  frameActions: { flexDirection: 'row', gap: 6 },
  frameActionBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    minWidth: 32,
  },
  frameActionDisabled: { opacity: 0.35 },
  frameActionLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  frameDurationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  frameDurationBtns: { flexDirection: 'row', flex: 1, gap: 6, justifyContent: 'flex-end' },
  durationBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  durationBtnSelected: { backgroundColor: '#14381f', borderColor: colors.primary },
  durationLabel: { color: colors.text, fontSize: 11, fontWeight: '600' },
  durationLabelSelected: { color: colors.primary, fontWeight: '800' },
  canvasWrap: { flex: 1, minHeight: 320 },
  frameBar: { paddingHorizontal: 12 },
  actions: { gap: 8, padding: 12 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  popoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
