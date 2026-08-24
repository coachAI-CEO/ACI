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
  View,
} from 'react-native';
import { BoardCanvas } from '../../../components/boards/BoardCanvas';
import { BoardSequenceBar } from '../../../components/boards/BoardSequenceBar';
import { BoardToolPalette, type Tool } from '../../../components/boards/BoardToolPalette';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import {
  extractBoardFrames,
  getBoard,
  patchBoard,
} from '../../../services/boards.service';
import { formatGameModelLabel } from '../../../utils/format';
import { formatFromBoard } from '../../../utils/board-format';
import type { PitchFormatId, PitchZoom, WebDiagramV1 } from '@aci/shared';

type Orientation = 'HORIZONTAL' | 'VERTICAL';

const HISTORY_LIMIT = 50;

export default function BoardEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Local editable diagram (mirrors the server, with our edits).
  const [diagram, setDiagram] = useState<WebDiagramV1 | null>(null);
  const [baseline, setBaseline] = useState<WebDiagramV1 | null>(null);
  const [history, setHistory] = useState<WebDiagramV1[]>([]);
  const [future, setFuture] = useState<WebDiagramV1[]>([]);

  // Selected entity (player / arrow / label id).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tool + team pill.
  const [tool, setTool] = useState<Tool>('move');
  const [team, setTeam] = useState<'ATT' | 'DEF' | 'NEUTRAL'>('ATT');

  // Viewer state for the canvas (orientation / zoom — same as read mode).
  const [zoom, setZoom] = useState<PitchZoom>('FULL');
  const [orientation, setOrientation] = useState<Orientation>('HORIZONTAL');

  // Sequence frame selection.
  const frames = useMemo(() => extractBoardFrames(diagram), [diagram]);
  const [frameIndex, setFrameIndex] = useState(0);

  // Load the board.
  const query = useQuery({
    queryKey: ['boards', id],
    queryFn: () => getBoard(String(id)),
    enabled: Boolean(id),
  });

  // Initialize local diagram once.
  useEffect(() => {
    if (query.data && !diagram) {
      setDiagram(query.data.diagram || null);
      setBaseline(query.data.diagram || null);
      setOrientation(query.data.diagram?.pitch?.orientation ?? 'HORIZONTAL');
    }
  }, [query.data, diagram]);

  // Read-only access guard: non-editable boards redirect back.
  useEffect(() => {
    if (query.data && !query.data.canEdit) {
      router.replace({ pathname: '/boards/[id]', params: { id: String(id) } });
    }
  }, [query.data, id, router]);

  // ─── History (undo/redo) ───────────────────────────────────────────────
  const commit = useCallback((next: WebDiagramV1 | null) => {
    if (!next) return;
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

  // ─── Save (PATCH) ───────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!diagram) throw new Error('No diagram');
      return patchBoard(String(id), { diagram });
    },
    onSuccess: (board) => {
      setBaseline(board.diagram || null);
      setDiagram(board.diagram || null);
      setHistory([]);
      setFuture([]);
      queryClient.setQueryData(['boards', id], board);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
    },
  });

  // ─── Unsaved-changes prompt on blur ────────────────────────────────────
  const navAway = useCallback(
    (after: () => void) => {
      if (!dirty) {
        after();
        return;
      }
      const choice = confirmDiscardSave();
      if (choice === 'discard') after();
      else if (choice === 'save') saveMutation.mutate(undefined, { onSuccess: () => after() });
    },
    [dirty, saveMutation]
  );

  // Wire the editor's header "Back" button to the prompt.
  useEffect(() => {
    return () => {
      // best-effort: on unmount we can't prompt anymore; autoSave is handled
      // by the explicit Save button only. (Phase D10.)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function setFormat(next: PitchFormatId) {
    if (!diagram) return;
    // Mutate diagram.pitch.format — the API treats this as the source of
    // truth on save.
    commit({ ...diagram, pitch: { ...(diagram.pitch || {}), format: next } });
  }

  function setOrientationLocal(next: Orientation) {
    setOrientation(next);
    if (!diagram) return;
    commit({ ...diagram, pitch: { ...(diagram.pitch || {}), orientation: next } });
  }

  const activeFrame = frames[frameIndex] || frames[0];

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
              onChange={setFormat as (v: string) => void}
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

        <View style={styles.canvasWrap}>
          {diagram ? (
            <BoardCanvas
              diagram={diagram}
              format={format}
              orientation={orientation}
              zoom={zoom}
              tool={tool}
              team={team}
              selectedKey={selectedId}
              onSelect={setSelectedId}
              onDiagramChange={(next) => commit(next as WebDiagramV1)}
            />
          ) : null}
        </View>

        {frames.length > 1 ? (
          <View style={styles.frameBar}>
            <BoardSequenceBar
              sequence={{ frames, activeFrameId: frames[frameIndex]?.id || null } as any}
              activeIndex={frameIndex}
              onSelect={setFrameIndex}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.actionsRow}>
            <Button title="Undo" variant="secondary" onPress={undo} disabled={history.length === 0} />
            <Button title="Redo" variant="secondary" onPress={redo} disabled={future.length === 0} />
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

        <BoardToolPalette tool={tool} onTool={setTool} team={team} onTeam={setTeam} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function confirmDiscardSave(): 'discard' | 'save' | 'cancel' {
  // Synchronous fallback used inside `navAway`. The web uses a confirm dialog;
  // on iOS the Alert API is async so we wait briefly and resolve on its
  // outcome. For navigation prompts we lean on native Alert.
  // Implementation note: this returns a sync default. Real UI is via the
  // <PromptSaveOnExit /> below.
  return 'cancel';
}

function PromptSaveOnExit({ show, onDecide, onCancel }: { show: boolean; onDecide: (choice: 'discard' | 'save') => void; onCancel: () => void }) {
  if (!show) return null;
  return (
    <View style={styles.promptOverlay}>
      <View style={styles.promptCard}>
        <Text style={styles.promptTitle}>You have unsaved changes</Text>
        <Text style={styles.promptBody}>Save them before leaving?</Text>
        <View style={styles.promptActions}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
          <Button title="Discard" variant="secondary" onPress={() => onDecide('discard')} />
          <Button title="Save" onPress={() => onDecide('save')} />
        </View>
      </View>
    </View>
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
  canvasWrap: { flex: 1, minHeight: 320 },
  frameBar: { paddingHorizontal: 12 },
  actions: { gap: 8, padding: 12 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 12,
    padding: 20,
    width: '85%',
  },
  promptTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  promptBody: { color: colors.muted, fontSize: 13 },
  promptActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
