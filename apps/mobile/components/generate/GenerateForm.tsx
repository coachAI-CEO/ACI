import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { colors } from '../../constants/colors';
import { useGenerateStore, type GenerateType } from '../../stores/generate.store';
import { useGenerate } from '../../hooks/useGenerate';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Input } from '../ui/Input';

const AGE_GROUPS = ['U10', 'U12', 'U14', 'U16', 'U18'];
const GAME_MODELS = ['POSSESSION', 'PRESSING', 'TRANSITION', 'COACHAI'] as const;
const PHASES = ['ATTACKING', 'DEFENDING', 'TRANSITION_TO_ATTACK', 'TRANSITION_TO_DEFEND'] as const;

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmentedRow}>
        {options.map((item) => {
          const selected = item === value;
          return (
            <Text
              key={item}
              onPress={() => onChange(item)}
              style={[styles.segmentItem, selected ? styles.segmentItemActive : null]}
            >
              {item.replaceAll('_', ' ')}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function TabSelector({ activeType, onChange }: { activeType: GenerateType; onChange: (type: GenerateType) => void }) {
  const tabs: GenerateType[] = ['drill', 'session', 'series'];

  return (
    <View style={styles.tabRow}>
      {tabs.map((tab) => (
        <Text
          key={tab}
          onPress={() => onChange(tab)}
          style={[styles.tab, activeType === tab ? styles.tabActive : null]}
        >
          {tab.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

export function GenerateForm() {
  const activeType = useGenerateStore((s) => s.activeType);
  const form = useGenerateStore((s) => s.form);
  const setActiveType = useGenerateStore((s) => s.setActiveType);
  const patchForm = useGenerateStore((s) => s.patchForm);
  const { generate, cancel, canGenerate, isGenerating, error, progress, progressMessage, timedOut } = useGenerate();

  return (
    <View style={styles.container}>
      <TabSelector activeType={activeType} onChange={setActiveType} />

      <Segmented
        label="Age Group"
        value={form.ageGroup}
        options={AGE_GROUPS}
        onChange={(ageGroup) => patchForm({ ageGroup })}
      />

      <Segmented
        label="Game Model"
        value={form.gameModelId}
        options={GAME_MODELS}
        onChange={(gameModelId) => patchForm({ gameModelId })}
      />

      <Segmented
        label="Phase"
        value={form.phase}
        options={PHASES}
        onChange={(phase) => patchForm({ phase })}
      />

      <View style={styles.twoCol}>
        <Input
          label="Players Min"
          value={String(form.numbersMin)}
          onChangeText={(v) => patchForm({ numbersMin: Number(v) || 0 })}
          keyboardType="default"
        />
        <Input
          label="Players Max"
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
        <View style={styles.progressWrap}>
          <Text style={styles.progressLabel}>{progressMessage}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
          <Button title="Cancel" onPress={cancel} variant="secondary" />
          {timedOut ? <Button title="Retry Now" onPress={() => void generate()} variant="secondary" /> : null}
        </View>
      ) : null}

      {error?.message ? <ErrorMessage message={error.message} /> : null}

      <Button
        title={activeType === 'session' ? 'Generate Session' : activeType === 'drill' ? 'Generate Drill' : 'Generate Series'}
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
  block: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    color: colors.muted,
    flex: 1,
    paddingVertical: 10,
    textAlign: 'center',
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontWeight: '700',
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmentItemActive: {
    borderColor: colors.primary,
    color: colors.primary,
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
