import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardCanvas } from '../../../components/boards/BoardCanvas';
import { BoardToolPalette, toolHint, type Tool } from '../../../components/boards/BoardToolPalette';
import { BoardLandscapeHud } from '../../../components/boards/BoardLandscapeHud';
import { BoardLandscapeSequence } from '../../../components/boards/BoardLandscapeSequence';
import { BoardAiSheet } from '../../../components/boards/BoardAiSheet';
import { BoardActionsSheet, type BoardActionId } from '../../../components/boards/BoardActionsSheet';
import { ArrowPopover } from '../../../components/boards/ArrowPopover';
import { ArrowTypePicker } from '../../../components/boards/ArrowTypePicker';
import { KitTypePicker, type KitDrawKind } from '../../../components/boards/KitTypePicker';
import { LabelPopover } from '../../../components/boards/LabelPopover';
import { PlayerPopover } from '../../../components/boards/PlayerPopover';
import { ShapeTypePicker, type ShapeDrawKind } from '../../../components/boards/ShapeTypePicker';
import { BoardSetupSheet } from '../../../components/boards/BoardSetupSheet';
import { FormatFormationSheet } from '../../../components/boards/FormatFormationSheet';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextPromptModal } from '../../../components/ui/TextPromptModal';
import { colors } from '../../../constants/colors';
import { webPath } from '../../../constants/web';
import { describeApiError } from '../../../services/api';
import { deleteBoard, getBoard, patchBoard, placeBoardPhase } from '../../../services/boards.service';
import { evictCachedBoard, writeBoardDetailCache } from '../../../services/offline-cache.service';
import { useAuthStore } from '../../../stores/auth.store';
import { formatFromBoard } from '../../../utils/board-format';
import { useDevicePitchOrientation } from '../../../hooks/useDevicePitchOrientation';
import {
  BOARD_SEQUENCE_DEFAULT_DURATION_MS,
  BOARD_SEQUENCE_MAX_FRAMES,
  applyFormationToTeam,
  buildDefaultMatchDiagram,
  duplicateActiveFrame,
  ensureSequence,
  interpolateLayers,
  deleteActiveFrame,
  selectFrame,
  separateOverlappingPlayers,
  syncActiveFrame,
  updateActiveFrameMeta,
  zoomFromPitchVariant,
  subjectForPhase,
  separateOverlappingLabels,
  type BoardSetupChannel,
  type BoardSetupPhase,
  type BoardSetupZone,
  type FormationId,
} from '@aci/shared';
import type { PitchFormatId, PitchZoom, WebDiagramV1 } from '@aci/shared';
import { extractBoardFrames } from '../../../services/boards.service';
import { TOKEN_RADIUS_PCT, arrowKindLabel, type LineDrawKind } from '../../../components/boards/boardTheme';

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
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [team, setTeam] = useState<'ATT' | 'DEF' | 'NEUTRAL'>('ATT');
  const [arrowKind, setArrowKind] = useState<LineDrawKind>('pass');
  const [shapeKind, setShapeKind] = useState<ShapeDrawKind>('spotlight');
  const [kitKind, setKitKind] = useState<KitDrawKind>('cone');
  const [renameFrameOpen, setRenameFrameOpen] = useState(false);
  const [renameFrameValue, setRenameFrameValue] = useState('');
  const [renameBoardOpen, setRenameBoardOpen] = useState(false);
  const [renameBoardValue, setRenameBoardValue] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [formatSheetOpen, setFormatSheetOpen] = useState(false);
  const [formatSheetTarget, setFormatSheetTarget] = useState<PitchFormatId>('11V11');
  const [showAtt, setShowAtt] = useState(true);
  const [showDef, setShowDef] = useState(true);
  /** Landscape properties drawer — closed by default so pitch owns the width. */
  const [hudOpen, setHudOpen] = useState(false);

  const selectedArrowIndex = useMemo(() => {
    if (!selectedKey?.startsWith('arrow:')) return null;
    const n = Number(selectedKey.slice(6));
    return Number.isFinite(n) ? n : null;
  }, [selectedKey]);

  const zoom = zoomFromPitchVariant(diagram?.pitch?.variant);
  // Pitch orientation follows the phone — portrait VERTICAL, landscape HORIZONTAL.
  const orientation = useDevicePitchOrientation();
  /** Side-rail chrome when landscape — keeps canvas tall enough for HORIZONTAL pitch. */
  const landscape = orientation === 'HORIZONTAL';
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!landscape) setHudOpen(false);
  }, [landscape]);

  const applyZoom = useCallback((next: PitchZoom) => {
    setDiagram((prev) => {
      if (!prev) return prev;
      if (zoomFromPitchVariant(prev.pitch?.variant) === next) return prev;
      setHistory((h) => {
        const nextH = [...h, prev];
        return nextH.length > HISTORY_LIMIT ? nextH.slice(nextH.length - HISTORY_LIMIT) : nextH;
      });
      setFuture([]);
      return {
        ...prev,
        pitch: {
          ...prev.pitch,
          variant: next,
        },
      };
    });
  }, []);

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
      const spaced = {
        ...withSeq,
        players: separateOverlappingPlayers(withSeq.players || [], TOKEN_RADIUS_PCT * 2 + 0.5, {
          preserveY: false,
          uniformGap: true,
        }),
        labels: separateOverlappingLabels(withSeq.labels, orientation),
      };
      setDiagram(spaced);
      setBaseline(spaced);
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

  const selectedPlayerIndex = useMemo(() => {
    if (editingPlayer != null) return editingPlayer;
    if (selectedKey?.startsWith('player:')) {
      const n = Number(selectedKey.slice(7));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }, [editingPlayer, selectedKey]);

  const selectedPlayer =
    selectedPlayerIndex != null ? diagram?.players?.[selectedPlayerIndex] ?? null : null;

  const handleTool = useCallback(
    (next: Tool) => {
      setTool(next);
      if (next !== 'move') {
        setEditingPlayer(null);
        if (selectedKey?.startsWith('arrow:')) setSelectedKey(null);
      }
      if (next !== 'label') setEditingLabel(null);
    },
    [selectedKey]
  );

  const clearArrows = useCallback(() => {
    if (!diagram) return;
    commit({ ...diagram, arrows: [] });
  }, [diagram, commit]);

  const updateSelectedPlayer = useCallback(
    (p: NonNullable<WebDiagramV1['players']>[number]) => {
      if (!diagram || selectedPlayerIndex == null) return;
      commit({
        ...diagram,
        players: (diagram.players || []).map((cur, i) => (i === selectedPlayerIndex ? p : cur)),
      });
    },
    [diagram, selectedPlayerIndex, commit]
  );

  const deleteSelectedPlayer = useCallback(() => {
    if (!diagram || selectedPlayerIndex == null) return;
    commit({
      ...diagram,
      players: (diagram.players || []).filter((_, i) => i !== selectedPlayerIndex),
    });
    setEditingPlayer(null);
    setSelectedKey(null);
  }, [diagram, selectedPlayerIndex, commit]);

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
      const synced = syncActiveFrame({
        ...diagram,
        pitch: {
          ...diagram.pitch,
          orientation,
        },
      });
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

  const renameBoardMutation = useMutation({
    mutationFn: (title: string) => patchBoard(String(id), { title }),
    onSuccess: (board) => {
      queryClient.setQueryData(['boards', id], board);
      void writeBoardDetailCache(board, user?.id);
      void queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
      setRenameBoardOpen(false);
    },
    onError: (err) => {
      Alert.alert('Rename failed', describeApiError(err, 'Could not update the title.'));
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
    setActionsOpen(true);
  }

  function onBoardAction(id: BoardActionId) {
    const currentShare = query.data?.shareMode || 'PRIVATE';
    const otherShareValue: 'PRIVATE' | 'CLUB' = currentShare === 'CLUB' ? 'PRIVATE' : 'CLUB';
    switch (id) {
      case 'formations':
        setFormatSheetTarget(
          formatFromBoard({
            ageGroup: query.data?.ageGroup,
            diagram: diagram ?? query.data?.diagram,
          })
        );
        setFormatSheetOpen(true);
        return;
      case 'setup':
        setSetupOpen(true);
        return;
      case 'ai':
        setAiOpen(true);
        return;
      case 'rename':
        setRenameBoardValue(query.data?.title || '');
        setRenameBoardOpen(true);
        return;
      case 'share':
        shareMutation.mutate(otherShareValue, {
          onError: (err) =>
            Alert.alert('Share failed', describeApiError(err, 'Could not update share mode.')),
        });
        return;
      case 'web':
        void Linking.openURL(webPath(`/board/${id}`));
        return;
      case 'delete':
        confirmDelete();
        return;
    }
  }

  function withUniformUnstack(d: WebDiagramV1): WebDiagramV1 {
    return {
      ...d,
      players: separateOverlappingPlayers(d.players || [], TOKEN_RADIUS_PCT * 2 + 0.5, {
        preserveY: false,
        uniformGap: true,
      }),
    };
  }

  function resetBoardFormat(
    nextFormat: PitchFormatId,
    formations?: { att: FormationId; def: FormationId }
  ) {
    const seed = buildDefaultMatchDiagram(nextFormat);
    let shaped = seed;
    if (formations) {
      shaped = applyFormationToTeam(shaped, 'ATT', formations.att, 'home');
      shaped = applyFormationToTeam(shaped, 'DEF', formations.def, 'away');
    }
    const next = ensureSequence(
      withUniformUnstack({
        ...shaped,
        pitch: {
          ...shaped.pitch,
          format: nextFormat,
          variant: 'FULL',
          orientation,
        },
      })
    );
    commit(next);
    setFrameIndex(0);
    setSelectedKey(null);
    setEditingPlayer(null);
    setEditingLabel(null);
    setShowAtt(true);
    setShowDef(true);
  }

  function applyTeamFormation(team: 'ATT' | 'DEF', formation: FormationId) {
    if (!diagram) return;
    const side = team === 'ATT' ? 'home' : 'away';
    const applied = applyFormationToTeam(diagram, team, formation, side);
    commit(
      withUniformUnstack({
        ...applied,
        pitch: {
          ...applied.pitch,
          orientation,
        },
      })
    );
  }

  function applyFormatFromSheet(input: {
    format: PitchFormatId;
    attFormation: FormationId;
    defFormation: FormationId;
    resetBoard: boolean;
  }) {
    if (input.resetBoard) {
      resetBoardFormat(input.format, {
        att: input.attFormation,
        def: input.defFormation,
      });
    } else {
      if (!diagram) return;
      let next = applyFormationToTeam(diagram, 'ATT', input.attFormation, 'home');
      next = applyFormationToTeam(next, 'DEF', input.defFormation, 'away');
      commit(
        withUniformUnstack({
          ...next,
          pitch: {
            ...next.pitch,
            format: input.format,
            orientation,
          },
        })
      );
    }
    setFormatSheetOpen(false);
  }

  function togglePitchFlag(key: 'showZones' | 'showThirds', next: boolean) {
    if (!diagram) return;
    commit({
      ...diagram,
      pitch: {
        ...diagram.pitch,
        [key]: next,
      },
    });
  }

  const placePhaseMutation = useMutation({
    mutationFn: async (input: {
      phase: BoardSetupPhase;
      zone: BoardSetupZone;
      channel: BoardSetupChannel;
      attFormation: FormationId;
      defFormation: FormationId;
    }) => {
      if (!diagram) throw new Error('No diagram');
      const subject = subjectForPhase(input.phase);
      const showOpposition =
        subject === 'DEF' ? showAtt : subject === 'ATT' ? showDef : showAtt && showDef;
      const placed = await placeBoardPhase(String(id), {
        diagram: {
          ...diagram,
          pitch: {
            ...diagram.pitch,
            orientation,
          },
        },
        phase: input.phase,
        zone: input.zone,
        channel: input.channel,
        attFormation: input.attFormation,
        defFormation: input.defFormation,
        showOpposition,
      });
      return {
        ...placed,
        pitch: {
          ...diagram.pitch,
          ...placed.pitch,
          format: diagram.pitch.format,
          variant: diagram.pitch.variant,
          orientation,
          showZones: diagram.pitch.showZones,
          showThirds: diagram.pitch.showThirds,
        },
        goals: diagram.goals?.length ? diagram.goals : placed.goals,
        labels: separateOverlappingLabels(placed.labels, orientation),
      } as WebDiagramV1;
    },
    onSuccess: (placed) => {
      commit(
        withUniformUnstack({
          ...placed,
          pitch: {
            ...placed.pitch,
            orientation,
          },
        })
      );
      setSetupOpen(false);
    },
    onError: (err) => {
      Alert.alert('Phase placement failed', describeApiError(err, 'Could not place the setup.'));
    },
  });

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
    setEditingPlayer(null);
    setEditingLabel(null);
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
  const format: PitchFormatId = formatFromBoard({
    ageGroup: board.ageGroup,
    diagram: diagram ?? board.diagram,
  });
  const activeFrame = frames[frameIndex] || frames[0];
  const activeTitle = activeFrame?.title || `Frame ${frameIndex + 1}`;
  const canAddFrame = frames.length < BOARD_SEQUENCE_MAX_FRAMES;

  function setFormatLocal(next: PitchFormatId) {
    if (!diagram) return;
    setFormatSheetTarget(next);
    setFormatSheetOpen(true);
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={landscape ? ['top'] : ['top', 'right', 'bottom', 'left']}
    >
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
                style={({ pressed }) => [
                  styles.navSaveBtn,
                  dirty ? styles.navSaveBtnDirty : styles.navSaveBtnIdle,
                  pressed && dirty ? { opacity: 0.75 } : null,
                ]}
              >
                <Text style={[styles.navSaveLabel, dirty ? styles.navSaveLabelDirty : styles.navSaveLabelIdle]}>
                  {saveMutation.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More"
                hitSlop={8}
                onPress={openOverflow}
                style={({ pressed }) => [styles.navMoreBtn, pressed ? { opacity: 0.5 } : null]}
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
        behavior={landscape ? undefined : Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {landscape ? (
          /* Pitch-first landscape: edge-to-edge board, chrome overlaid / slim */
          <View style={styles.landShell}>
            <View
              style={[
                styles.landMid,
                { paddingLeft: Math.max(insets.left, 0), paddingRight: Math.max(insets.right, 0) },
              ]}
            >
              <BoardToolPalette
                tool={tool}
                layout="column"
                onTool={handleTool}
                onClearArrows={clearArrows}
              />

              <View style={styles.landCanvas}>
                {diagram ? (
                  <BoardCanvas
                    diagram={diagram}
                    format={format}
                    orientation={orientation}
                    zoom={zoom}
                    tool={tool}
                    team={team}
                    arrowKind={arrowKind}
                    shapeKind={shapeKind}
                    kitKind={kitKind}
                    showAtt={showAtt}
                    showDef={showDef}
                    selectedKey={selectedKey}
                    onSelect={(key) => {
                      setSelectedKey(key);
                      if (key?.startsWith('player:')) {
                        const n = Number(key.slice(7));
                        if (Number.isFinite(n)) {
                          setEditingPlayer(n);
                          setHudOpen(true);
                        }
                      } else {
                        setEditingPlayer(null);
                      }
                      if (!key?.startsWith('label:')) setEditingLabel(null);
                    }}
                    onPlayerEdit={(idx) => {
                      setEditingLabel(null);
                      setEditingPlayer(idx);
                      setSelectedKey(`player:${idx}`);
                      setHudOpen(true);
                    }}
                    onLabelEdit={(idx) => {
                      setEditingPlayer(null);
                      setEditingLabel(idx);
                    }}
                    onDiagramChange={(next) => commit(next)}
                  />
                ) : null}

                {/* Format / zoom overlaid — no dedicated meta row eating height */}
                <View style={styles.landMetaOverlay} pointerEvents="box-none">
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
                      onChange={applyZoom}
                      options={[
                        { value: 'FULL', label: 'Full' },
                        { value: 'HALF', label: 'Half' },
                        { value: 'THIRD', label: 'Third' },
                      ]}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Toggle zones"
                    accessibilityState={{ selected: !!diagram?.pitch?.showZones }}
                    onPress={() => togglePitchFlag('showZones', !diagram?.pitch?.showZones)}
                    style={[
                      styles.zonesBtn,
                      diagram?.pitch?.showZones ? styles.zonesBtnOn : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.zonesBtnLabel,
                        diagram?.pitch?.showZones ? styles.zonesBtnLabelOn : null,
                      ]}
                    >
                      Zones
                    </Text>
                  </Pressable>
                </View>

                <View style={[styles.toolBadge, styles.toolBadgeLand]} pointerEvents="none">
                  <Text style={styles.toolBadgeText}>
                    {tool === 'arrow'
                      ? `Arrow · ${arrowKindLabel(arrowKind)}`
                      : toolHint(tool).toUpperCase()}
                  </Text>
                </View>

                {!hudOpen ? (
                  <View style={[styles.teamPill, styles.teamPillLandscape]}>
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
                ) : null}

                {/* Compact type chips when HUD closed — keeps drawer shut */}
                {!hudOpen && tool === 'arrow' ? (
                  <View style={styles.landTypeStrip}>
                    <ArrowTypePicker value={arrowKind} onChange={setArrowKind} />
                  </View>
                ) : null}
                {!hudOpen && tool === 'shape' ? (
                  <View style={styles.landTypeStrip}>
                    <ShapeTypePicker value={shapeKind} onChange={setShapeKind} />
                  </View>
                ) : null}
                {!hudOpen && tool === 'kit' ? (
                  <View style={styles.landTypeStrip}>
                    <KitTypePicker value={kitKind} onChange={setKitKind} />
                  </View>
                ) : null}

                <BoardLandscapeHud
                  open={hudOpen}
                  onOpenChange={setHudOpen}
                  team={team}
                  onTeam={setTeam}
                  tool={tool}
                  arrowKind={arrowKind}
                  onArrowKind={setArrowKind}
                  shapeKind={shapeKind}
                  onShapeKind={setShapeKind}
                  kitKind={kitKind}
                  onKitKind={setKitKind}
                  player={selectedPlayer}
                  onChangePlayer={updateSelectedPlayer}
                  onDeletePlayer={deleteSelectedPlayer}
                />
              </View>
            </View>

            <View style={{ paddingBottom: Math.max(insets.bottom, 4) }}>
              <BoardLandscapeSequence
                frames={frames}
                activeIndex={frameIndex}
                playing={playing}
                canAdd={canAddFrame}
                onSelect={jumpToFrame}
                onRename={(_i, title) => {
                  setRenameFrameValue(title);
                  setRenameFrameOpen(true);
                }}
                onAdd={addFrame}
                onDuplicate={duplicateFrame}
                onDelete={deleteFrame}
                onTogglePlay={togglePlay}
              />
            </View>

            {saveMutation.error ? (
              <View style={styles.saveError}>
                <ErrorMessage message={describeApiError(saveMutation.error, 'Save failed.')} />
              </View>
            ) : null}

            {selectedArrowIndex != null && diagram?.arrows?.[selectedArrowIndex] && tool === 'move' ? (
              <ArrowPopover
                arrow={diagram.arrows[selectedArrowIndex]}
                onChange={(a) => {
                  commit({
                    ...diagram,
                    arrows: (diagram.arrows || []).map((cur, i) => (i === selectedArrowIndex ? a : cur)),
                  });
                }}
                onDelete={() => {
                  commit({
                    ...diagram,
                    arrows: (diagram.arrows || []).filter((_, i) => i !== selectedArrowIndex),
                  });
                  setSelectedKey(null);
                }}
                onClose={() => setSelectedKey(null)}
              />
            ) : null}

            {editingLabel != null && diagram?.labels?.[editingLabel] ? (
              <LabelPopover
                label={diagram.labels[editingLabel]}
                onChange={(l) => {
                  commit({
                    ...diagram,
                    labels: (diagram.labels || []).map((cur, i) => (i === editingLabel ? l : cur)),
                  });
                }}
                onDelete={() => {
                  commit({
                    ...diagram,
                    labels: (diagram.labels || []).filter((_, i) => i !== editingLabel),
                  });
                  setEditingLabel(null);
                  setSelectedKey(null);
                }}
                onClose={() => setEditingLabel(null)}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.editorBody}>
            <View style={styles.editorMain}>
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
                    onChange={applyZoom}
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
                    arrowKind={arrowKind}
                    shapeKind={shapeKind}
                    kitKind={kitKind}
                    showAtt={showAtt}
                    showDef={showDef}
                    selectedKey={selectedKey}
                    onSelect={(key) => {
                      setSelectedKey(key);
                      if (!key?.startsWith('player:')) setEditingPlayer(null);
                      if (!key?.startsWith('label:')) setEditingLabel(null);
                    }}
                    onPlayerEdit={(idx) => {
                      setEditingLabel(null);
                      setEditingPlayer(idx);
                    }}
                    onLabelEdit={(idx) => {
                      setEditingPlayer(null);
                      setEditingLabel(idx);
                    }}
                    onDiagramChange={(next) => commit(next)}
                  />
                ) : null}

                <View style={styles.toolBadge} pointerEvents="none">
                  <Text style={styles.toolBadgeText}>
                    {tool === 'arrow'
                      ? `Arrow · ${arrowKindLabel(arrowKind)} · drag to draw`
                      : toolHint(tool)}
                  </Text>
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

              {editingPlayer != null && diagram?.players?.[editingPlayer] ? (
                <View style={styles.popoverOverlay} pointerEvents="box-none">
                  <PlayerPopover
                    player={diagram.players[editingPlayer]}
                    onChange={(p) => {
                      if (!diagram) return;
                      commit({
                        ...diagram,
                        players: (diagram.players || []).map((cur, i) =>
                          i === editingPlayer ? p : cur
                        ),
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
                          setRenameFrameValue(name);
                          setRenameFrameOpen(true);
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

              {tool === 'arrow' ? (
                <ArrowTypePicker value={arrowKind} onChange={setArrowKind} />
              ) : null}

              {tool === 'shape' ? (
                <ShapeTypePicker value={shapeKind} onChange={setShapeKind} />
              ) : null}

              {tool === 'kit' ? (
                <KitTypePicker value={kitKind} onChange={setKitKind} />
              ) : null}

              {selectedArrowIndex != null && diagram?.arrows?.[selectedArrowIndex] && tool === 'move' ? (
                <ArrowPopover
                  arrow={diagram.arrows[selectedArrowIndex]}
                  onChange={(a) => {
                    commit({
                      ...diagram,
                      arrows: (diagram.arrows || []).map((cur, i) =>
                        i === selectedArrowIndex ? a : cur
                      ),
                    });
                  }}
                  onDelete={() => {
                    commit({
                      ...diagram,
                      arrows: (diagram.arrows || []).filter((_, i) => i !== selectedArrowIndex),
                    });
                    setSelectedKey(null);
                  }}
                  onClose={() => setSelectedKey(null)}
                />
              ) : null}

              {editingLabel != null && diagram?.labels?.[editingLabel] ? (
                <LabelPopover
                  label={diagram.labels[editingLabel]}
                  onChange={(l) => {
                    commit({
                      ...diagram,
                      labels: (diagram.labels || []).map((cur, i) => (i === editingLabel ? l : cur)),
                    });
                  }}
                  onDelete={() => {
                    commit({
                      ...diagram,
                      labels: (diagram.labels || []).filter((_, i) => i !== editingLabel),
                    });
                    setEditingLabel(null);
                    setSelectedKey(null);
                  }}
                  onClose={() => setEditingLabel(null)}
                />
              ) : null}

              <BoardToolPalette tool={tool} layout="row" onTool={handleTool} />
            </View>
          </View>
        )}

        <BoardAiSheet
          visible={aiOpen}
          boardId={String(id)}
          diagram={diagram}
          onClose={() => setAiOpen(false)}
          onApplyDiagram={(next) => {
            const staged: WebDiagramV1 = {
              ...next,
              pitch: {
                ...(next.pitch ?? diagram?.pitch),
                orientation,
              },
              labels: separateOverlappingLabels(next.labels, orientation),
            };
            commit(staged);
            setAiOpen(false);
          }}
        />

        <TextPromptModal
          visible={renameFrameOpen}
          title="Rename frame"
          initialValue={renameFrameValue}
          onCancel={() => setRenameFrameOpen(false)}
          onSubmit={(text) => {
            renameFrame(text);
            setRenameFrameOpen(false);
          }}
        />

        <TextPromptModal
          visible={renameBoardOpen}
          title="Rename board"
          initialValue={renameBoardValue}
          onCancel={() => setRenameBoardOpen(false)}
          onSubmit={(text) => {
            const next = text.trim();
            if (!next) {
              Alert.alert('Title required', 'Give the board a short name.');
              return;
            }
            renameBoardMutation.mutate(next);
          }}
        />

        <BoardActionsSheet
          visible={actionsOpen}
          shareLabel={
            (query.data?.shareMode || 'PRIVATE') === 'CLUB' ? 'Share with Private' : 'Share with Club'
          }
          onClose={() => setActionsOpen(false)}
          onAction={onBoardAction}
        />

        <FormatFormationSheet
          visible={formatSheetOpen}
          targetFormat={formatSheetTarget}
          currentFormat={format}
          onClose={() => setFormatSheetOpen(false)}
          onApply={applyFormatFromSheet}
        />

        <BoardSetupSheet
          visible={setupOpen}
          format={format}
          showAtt={showAtt}
          showDef={showDef}
          showZones={!!diagram?.pitch?.showZones}
          showThirds={!!diagram?.pitch?.showThirds}
          applyingPhase={placePhaseMutation.isPending}
          onClose={() => setSetupOpen(false)}
          onResetFormat={resetBoardFormat}
          onApplyAttFormation={(id) => applyTeamFormation('ATT', id)}
          onApplyDefFormation={(id) => applyTeamFormation('DEF', id)}
          onToggleAtt={setShowAtt}
          onToggleDef={setShowDef}
          onToggleZones={(next) => togglePitchFlag('showZones', next)}
          onToggleThirds={(next) => togglePitchFlag('showThirds', next)}
          onApplyPhase={(input) => placePhaseMutation.mutate(input)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  editorBody: { flex: 1, flexDirection: 'column', minHeight: 0 },
  editorBodyLandscape: { flexDirection: 'row' },
  editorMain: { flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0 },
  landShell: { flex: 1, flexDirection: 'column', minHeight: 0 },
  landMid: { flex: 1, flexDirection: 'row', minHeight: 0, minWidth: 0 },
  landCanvas: {
    backgroundColor: '#062816',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  landMetaOverlay: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    left: 8,
    maxWidth: '72%',
    paddingVertical: 6,
    position: 'absolute',
    right: 56,
    top: 6,
    zIndex: 8,
  },
  toolBadgeLand: {
    left: 8,
    top: 46,
  },
  landTypeStrip: {
    backgroundColor: 'rgba(11,18,32,0.92)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 9,
  },
  zonesBtn: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  zonesBtnOn: {
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderColor: 'rgba(56,189,248,0.45)',
  },
  zonesBtnLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  zonesBtnLabelOn: { color: '#7dd3fc' },
  container: { gap: 12, padding: 16 },
  headerLeft: { flexDirection: 'row', gap: 2, marginLeft: 4 },
  headerRight: { alignItems: 'center', flexDirection: 'row', gap: 8, marginRight: 44 },
  navIconBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  navIconDisabled: { opacity: 0.35 },
  navIcon: { color: colors.primary, fontSize: 20, fontWeight: '600' },
  navSaveBtn: {
    borderRadius: 8,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navSaveBtnDirty: { backgroundColor: colors.primary },
  navSaveBtnIdle: { backgroundColor: 'transparent' },
  navSaveLabel: { fontSize: 14, fontWeight: '800' },
  navSaveLabelDirty: { color: '#052e16' },
  navSaveLabelIdle: { color: colors.muted, fontWeight: '600' },
  navMoreBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  navMore: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  metaRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaRowLandscape: { paddingVertical: 4 },
  metaSeg: { flex: 1, minWidth: 0 },
  metaSegCompact: { flex: 0.9, minWidth: 0 },
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
  teamPillLandscape: { right: 8, top: 8 },
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
  seqLandscape: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    paddingTop: 4,
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
  seqFramesLandscape: { flex: 1, flexShrink: 1, minWidth: 0 },
  seqFrame: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 6,
  },
  seqFrameLandscape: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seqFrameActive: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: colors.primary,
  },
  seqFrameNum: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  seqFrameName: { color: colors.muted, fontSize: 10, marginTop: 1, textAlign: 'center' },
  seqFrameTextActive: { color: colors.text },
  seqTools: { flexDirection: 'row', gap: 6, marginTop: 6 },
  seqToolsLandscape: { flexGrow: 0, marginTop: 0 },
  seqGhost: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 6,
  },
  seqGhostLandscape: {
    flexGrow: 0,
    minWidth: 40,
    paddingHorizontal: 10,
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
