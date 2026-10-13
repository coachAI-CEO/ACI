import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../ui/Button';
import { colors } from '../../constants/colors';
import { describeApiError } from '../../services/api';
import { createBoard, type BoardCreatePayload, type BoardShareMode } from '../../services/boards.service';
import { getVaultSessions, type VaultSession } from '../../services/vault.service';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
};

type Step = 'menu' | 'blank-title' | 'pick-session' | 'drill-key';

type MenuKey = 'BLANK' | 'FORK_SESSION' | 'FORK_DRILL';

export function CreateBoardSheet({ visible, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('menu');
  const [title, setTitle] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [drillKey, setDrillKey] = useState('');
  const [shareMode, setShareMode] = useState<BoardShareMode>('PRIVATE');

  const sessionsQuery = useVaultSessionsIfStep(step === 'pick-session', 40);
  const sessionList: VaultSession[] = sessionsQuery.data?.sessions || [];

  const mutation = useMutation({
    mutationFn: (payload: BoardCreatePayload) => createBoard(payload),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
      onCreated(board.id);
      reset();
    },
    onError: (err) => {
      Alert.alert('Couldn’t create board', describeApiError(err, 'Try again in a moment.'));
    },
  });

  function reset() {
    setStep('menu');
    setTitle('');
    setAgeGroup('');
    setDrillKey('');
    setShareMode('PRIVATE');
  }

  function close() {
    if (mutation.isPending) return;
    reset();
    onClose();
  }

  function pickMenu(key: MenuKey) {
    if (key === 'BLANK') {
      setStep('blank-title');
      return;
    }
    if (key === 'FORK_SESSION') {
      setStep('pick-session');
      return;
    }
    setStep('drill-key');
  }

  function submitBlank() {
    mutation.mutate({
      mode: 'BLANK',
      title: title.trim() || undefined,
      ageGroup: ageGroup.trim() || undefined,
      shareMode,
    });
  }

  function submitSession(sessionId: string) {
    mutation.mutate({ mode: 'FORK_SESSION', sessionId, shareMode });
  }

  function submitDrill() {
    const key = drillKey.trim();
    if (!key) {
      Alert.alert('Drill key required', 'Paste a drill id (or open the drill on web first).');
      return;
    }
    mutation.mutate({ mode: 'FORK_DRILL', drillId: key, shareMode });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grab} />
        {step === 'menu' ? (
          <MenuStep shareMode={shareMode} onShareMode={setShareMode} onPick={pickMenu} />
        ) : null}
        {step === 'blank-title' ? (
          <BlankTitleStep
            title={title}
            onTitle={setTitle}
            ageGroup={ageGroup}
            onAgeGroup={setAgeGroup}
            onBack={() => setStep('menu')}
            onSubmit={submitBlank}
            submitting={mutation.isPending}
          />
        ) : null}
        {step === 'pick-session' ? (
          <SessionStep
            sessions={sessionList}
            isLoading={sessionsQuery.isLoading}
            onBack={() => setStep('menu')}
            onSubmit={submitSession}
            submitting={mutation.isPending}
          />
        ) : null}
        {step === 'drill-key' ? (
          <DrillKeyStep
            drillKey={drillKey}
            onDrillKey={setDrillKey}
            onBack={() => setStep('menu')}
            onSubmit={submitDrill}
            submitting={mutation.isPending}
          />
        ) : null}

        {mutation.isPending ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button title="Cancel" variant="secondary" onPress={close} disabled={mutation.isPending} />
        </View>
      </View>
    </Modal>
  );
}

function ShareToggle({ value, onChange }: { value: BoardShareMode; onChange: (m: BoardShareMode) => void }) {
  return (
    <View style={styles.shareRow}>
      <Text style={styles.shareLabel}>Visibility</Text>
      <View style={styles.shareChips}>
        {(['PRIVATE', 'CLUB'] as BoardShareMode[]).map((mode) => {
          const selected = value === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => onChange(mode)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.shareChip, selected ? styles.shareChipSelected : null]}
            >
              <Text style={[styles.shareChipLabel, selected ? styles.shareChipLabelSelected : null]}>
                {mode === 'CLUB' ? 'Club' : 'Private'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MenuStep({
  shareMode,
  onShareMode,
  onPick,
}: {
  shareMode: BoardShareMode;
  onShareMode: (m: BoardShareMode) => void;
  onPick: (key: MenuKey) => void;
}) {
  const options: { id: MenuKey; title: string; sub: string; icon: string }[] = [
    { id: 'BLANK', title: 'Blank board', sub: 'Start with the default formation', icon: '◻︎' },
    { id: 'FORK_SESSION', title: 'From a session', sub: 'Fork a session’s players + arrows', icon: '⇄' },
    { id: 'FORK_DRILL', title: 'From a drill', sub: 'Fork a drill diagram', icon: '⌖' },
  ];
  return (
    <View style={styles.body}>
      <Text style={styles.title}>New board</Text>
      <Text style={styles.subtitle}>Pick a starting point.</Text>
      <ShareToggle value={shareMode} onChange={onShareMode} />
      <View style={styles.menuList}>
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            accessibilityLabel={opt.title}
            onPress={() => onPick(opt.id)}
            style={({ pressed }) => [styles.menuRow, pressed ? styles.menuRowPressed : null]}
          >
            <Text style={styles.menuIcon}>{opt.icon}</Text>
            <View style={styles.menuRowText}>
              <Text style={styles.menuRowTitle}>{opt.title}</Text>
              <Text style={styles.menuRowSub}>{opt.sub}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BlankTitleStep({
  title,
  onTitle,
  ageGroup,
  onAgeGroup,
  onBack,
  onSubmit,
  submitting,
}: {
  title: string;
  onTitle: (t: string) => void;
  ageGroup: string;
  onAgeGroup: (a: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>Blank board</Text>
      <Text style={styles.subtitle}>Name it and optionally set an age group (e.g. U12).</Text>
      <TextInput
        value={title}
        onChangeText={onTitle}
        placeholder="Board name"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoFocus
        returnKeyType="next"
        maxLength={80}
      />
      <TextInput
        value={ageGroup}
        onChangeText={onAgeGroup}
        placeholder="Age group (optional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        maxLength={12}
      />
      <View style={styles.stepActions}>
        <Button title="Back" variant="secondary" onPress={onBack} disabled={submitting} />
        <Button title="Create" onPress={onSubmit} disabled={submitting} />
      </View>
    </View>
  );
}

function DrillKeyStep({
  drillKey,
  onDrillKey,
  onBack,
  onSubmit,
  submitting,
}: {
  drillKey: string;
  onDrillKey: (k: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>From a drill</Text>
      <Text style={styles.subtitle}>Paste the drill id from the web or Vault URL.</Text>
      <TextInput
        value={drillKey}
        onChangeText={onDrillKey}
        placeholder="drill id"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <View style={styles.stepActions}>
        <Button title="Back" variant="secondary" onPress={onBack} disabled={submitting} />
        <Button title="Create" onPress={onSubmit} disabled={submitting} />
      </View>
    </View>
  );
}

function SessionStep({
  sessions,
  isLoading,
  onBack,
  onSubmit,
  submitting,
}: {
  sessions: VaultSession[];
  isLoading: boolean;
  onBack: () => void;
  onSubmit: (id: string) => void;
  submitting: boolean;
}) {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>Pick a session</Text>
      <Text style={styles.subtitle}>Fork the formation + arrows from a saved session.</Text>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.subtitle}>No sessions in your vault yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sessionListContent}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Fork from ${item.title || 'session'}`}
              onPress={() => onSubmit(item.id)}
              disabled={submitting}
              style={({ pressed }) => [styles.sessionRow, pressed ? styles.sessionRowPressed : null]}
            >
              <Text style={styles.sessionTitle} numberOfLines={2}>
                {item.title || 'Untitled session'}
              </Text>
              <Text style={styles.sessionMeta} numberOfLines={1}>
                {item.ageGroup || '--'} · {item.phase || 'Any phase'}
              </Text>
            </Pressable>
          )}
        />
      )}
      <View style={styles.stepActions}>
        <Button title="Back" variant="secondary" onPress={onBack} disabled={submitting} />
      </View>
    </View>
  );
}

// Local query hook so we don't fetch sessions unless we're on that step.
function useVaultSessionsIfStep(enabled: boolean, limit: number) {
  return useQuery<{ sessions: VaultSession[]; total: number }>({
    queryKey: ['boards', 'create', 'sessions'],
    queryFn: () => getVaultSessions({ limit }),
    enabled,
    staleTime: 30_000,
  });
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)', flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '85%',
    paddingBottom: 16,
  },
  grab: {
    alignSelf: 'center',
    backgroundColor: '#374151',
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    width: 36,
  },
  body: { gap: 12, paddingBottom: 8, paddingHorizontal: 16, paddingTop: 6 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: colors.muted, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stepActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', paddingTop: 8 },
  menuList: { gap: 8, paddingTop: 4 },
  menuRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  menuRowPressed: { opacity: 0.7 },
  menuIcon: { color: colors.primary, fontSize: 20, fontWeight: '800', width: 24 },
  menuRowText: { flex: 1, gap: 2 },
  menuRowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  menuRowSub: { color: colors.muted, fontSize: 12 },
  shareRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingTop: 4 },
  shareLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  shareChips: { flexDirection: 'row', gap: 6 },
  shareChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  shareChipSelected: { backgroundColor: '#14381f', borderColor: colors.primary },
  shareChipLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  shareChipLabelSelected: { color: colors.primary, fontWeight: '800' },
  sessionListContent: { gap: 6, paddingTop: 4 },
  sessionRow: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sessionRowPressed: { opacity: 0.7 },
  sessionTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sessionMeta: { color: colors.muted, fontSize: 12 },
  center: { paddingVertical: 24 },
  footer: { paddingHorizontal: 16, paddingTop: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
  },
});
