import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COACH_LEVELS, GAME_MODEL_OPTIONS, getScopedGameModelOptions, type CoachLevel, type GameModelId } from '@aci/shared';
import { useAuth } from '../../hooks/useAuth';
import { useGenerate } from '../../hooks/useGenerate';
import { useGenerateStore, type GenerateType } from '../../stores/generate.store';
import { colors } from '../../constants/colors';
import { humanizeLabel } from '../../utils/format';
import { Button } from '../ui/Button';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Input } from '../ui/Input';

const AGE_GROUPS = ['U10', 'U12', 'U14', 'U16', 'U18'] as const;
const PHASES = ['ATTACKING', 'DEFENDING', 'TRANSITION_TO_ATTACK', 'TRANSITION_TO_DEFEND'] as const;
const PLAYER_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

function TabSelector({ activeType, onChange }: { activeType: GenerateType; onChange: (type: GenerateType) => void }) {
  const tabs: GenerateType[] = ['drill', 'session', 'series'];

  return (
    <View accessibilityRole="tablist" style={styles.tabRow}>
      {tabs.map((tab) => {
        const selected = activeType === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tab} generate type`}
            hitSlop={4}
            onPress={() => onChange(tab)}
            style={[styles.tab, selected ? styles.tabActive : null]}
          >
            <Text style={[styles.tabText, selected ? styles.tabTextActive : null]}>{humanizeLabel(tab)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function GenerateForm() {
  const { user } = useAuth();
  const activeType = useGenerateStore((s) => s.activeType);
  const form = useGenerateStore((s) => s.form);
  const setActiveType = useGenerateStore((s) => s.setActiveType);
  const patchForm = useGenerateStore((s) => s.patchForm);
  const { generate, cancel, canGenerate, isGenerating, error, progress, progressMessage, timedOut } = useGenerate();

  const enforcedGameModelId = (user?.enforcedGameModelId || null) as GameModelId | null;
  const modelOptions = getScopedGameModelOptions(enforcedGameModelId).map((option) => option.value);
  const gameModelLocked = Boolean(enforcedGameModelId);

  useEffect(() => {
    if (enforcedGameModelId && form.gameModelId !== enforcedGameModelId) {
      patchForm({ gameModelId: enforcedGameModelId });
    }
  }, [enforcedGameModelId, form.gameModelId, patchForm]);

  return (
    <View style={styles.container}>
      <TabSelector activeType={activeType} onChange={setActiveType} />

      {user?.clubName ? (
        <Text accessibilityRole="text" style={styles.clubBanner}>
          Club: {user.clubName}
        </Text>
      ) : null}

      <ChoiceChips
        label="Age group"
        value={form.ageGroup}
        options={AGE_GROUPS}
        onChange={(ageGroup) => patchForm({ ageGroup })}
        formatOption={(value) => value}
      />

      <ChoiceChips
        label="Coach level"
        value={form.coachLevel}
        options={COACH_LEVELS}
        onChange={(coachLevel) => patchForm({ coachLevel: coachLevel as CoachLevel })}
      />

      <ChoiceChips
        label="Player level"
        value={form.playerLevel}
        options={PLAYER_LEVELS}
        onChange={(playerLevel) => patchForm({ playerLevel })}
      />

      <ChoiceChips
        label="Game model"
        value={form.gameModelId}
        options={modelOptions.length ? modelOptions : GAME_MODEL_OPTIONS.map((option) => option.value)}
        onChange={(gameModelId) => patchForm({ gameModelId: gameModelId as GameModelId })}
        locked={gameModelLocked}
        hint={gameModelLocked ? `Locked to your club game model (${humanizeLabel(String(enforcedGameModelId))})` : undefined}
      />

      <ChoiceChips label="Phase" value={form.phase} options={PHASES} onChange={(phase) => patchForm({ phase })} />

      <View style={styles.twoCol}>
        <Input
          label="Players min"
          value={String(form.numbersMin)}
          onChangeText={(v) => patchForm({ numbersMin: Number(v) || 0 })}
          keyboardType="default"
        />
        <Input
          label="Players max"
          value={String(form.numbersMax)}
          onChangeText={(v) => patchForm({ numbersMax: Number(v) || 0 })}
          keyboardType="default"
        />
      </View>

      {activeType === 'series' ? (
        <Input
          label="Number of sessions"
          value={String(form.numberOfSessions)}
          onChangeText={(v) => patchForm({ numberOfSessions: Math.max(2, Number(v) || 2) })}
        />
      ) : null}

      {isGenerating ? (
        <View style={styles.progressWrap} accessibilityLabel={`Generating ${progress}%`}>
          <Text style={styles.progressLabel}>{progressMessage}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
          <Button title="Cancel" onPress={cancel} variant="secondary" />
          {timedOut ? <Button title="Retry now" onPress={() => void generate()} variant="secondary" /> : null}
        </View>
      ) : null}

      {error?.message ? <ErrorMessage message={error.message} /> : null}

      <Button
        title={activeType === 'session' ? 'Generate session' : activeType === 'drill' ? 'Generate drill' : 'Generate series'}
        onPress={() => void generate()}
        disabled={!canGenerate || isGenerating}
        loading={isGenerating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  clubBanner: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
  },
  tabText: {
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  progressWrap: {
    gap: 8,
  },
  progressLabel: {
    color: colors.text,
    fontSize: 13,
  },
  progressTrack: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: 8,
  },
  progressPct: {
    color: colors.muted,
    fontSize: 12,
  },
});
