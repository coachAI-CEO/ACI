import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  COACH_LEVELS,
  DRILL_TYPES,
  DRILL_TYPE_LABELS,
  FORMATION_BY_AGE,
  GAME_MODEL_OPTIONS,
  PHASES,
  PHASE_LABELS,
  SPACE_CONSTRAINTS,
  SPACE_CONSTRAINT_LABELS,
  ZONES,
  ZONE_LABELS,
  getDefaultFormation,
  getFormationTypeLabel,
  getValidFormations,
  getScopedGameModelOptions,
  isPlayerLevelAllowedForCoach,
  type CoachLevel,
  type DrillType,
  type GameModelId,
  type Phase,
  type SpaceConstraint,
  type Zone,
} from '@aci/shared';
import { useAuth } from '../../hooks/useAuth';
import { useGenerate } from '../../hooks/useGenerate';
import { useGenerateStore, type GenerateType } from '../../stores/generate.store';
import { getTopicsForPhaseAndZone } from '../../data/session-topics';
import { colors } from '../../constants/colors';
import { formatCoachLevelLabel, formatGameModelLabel, humanizeLabel } from '../../utils/format';
import { Button } from '../ui/Button';
import { DropdownCell, DropdownRow } from '../ui/DropdownCell';
import { ErrorMessage } from '../ui/ErrorMessage';
import { PickerSheet } from '../ui/PickerSheet';

const AGE_GROUPS = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18'] as const;
const PLAYER_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;

/** Player-count picker — mirrors web form's PlayerCountInputs (separate min/max
 * numeric inputs, with max clamped to be >= min). We expose the same range as
 * discrete dropdown values so coaches pick a number rather than type. */
const PLAYER_COUNT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '4', label: '4' },
  { value: '6', label: '6' },
  { value: '8', label: '8' },
  { value: '10', label: '10' },
  { value: '12', label: '12' },
  { value: '14', label: '14' },
  { value: '16', label: '16' },
  { value: '18', label: '18' },
  { value: '20', label: '20' },
  { value: '22', label: '22' },
  { value: '24', label: '24' },
];

const SESSION_DURATION_OPTIONS: Array<{ value: string; label: string; sublabel: string }> = [
  { value: '60', label: '60 min', sublabel: 'Standard session' },
  { value: '90', label: '90 min', sublabel: 'Match prep' },
];

const DRILL_DURATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
  { value: '25', label: '25 min' },
  { value: '30', label: '30 min' },
  { value: '35', label: '35 min' },
  { value: '40', label: '40 min' },
];

const GOALS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
];

type SheetKey =
  | 'age'
  | 'coach'
  | 'playersMin'
  | 'playersMax'
  | 'model'
  | 'phase'
  | 'zone'
  | 'topic'
  | 'formationAttacking'
  | 'formationDefending'
  | 'space'
  | 'goals'
  | 'duration'
  | 'drillDuration'
  | 'drillType';

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

function ExpandableSection({
  label,
  open,
  onToggle,
  children,
  hint,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <View style={styles.expandable}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Toggle ${label}`}
        hitSlop={6}
        onPress={onToggle}
        style={({ pressed }) => [styles.expandableHeader, pressed ? styles.expandableHeaderPressed : null]}
      >
        <Text style={styles.expandableLabel}>{label}</Text>
        <Text style={[styles.expandableChev, open ? styles.expandableChevOpen : null]}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.expandableBody}>
          {children}
          {hint ? <Text style={styles.expandableHint}>{hint}</Text> : null}
        </View>
      ) : null}
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
  const modelOptions = useMemo(
    () => getScopedGameModelOptions(enforcedGameModelId).map((option) => option.value),
    [enforcedGameModelId]
  );
  const gameModelLocked = Boolean(enforcedGameModelId);

  useEffect(() => {
    if (enforcedGameModelId && form.gameModelId !== enforcedGameModelId) {
      patchForm({ gameModelId: enforcedGameModelId });
    }
  }, [enforcedGameModelId, form.gameModelId, patchForm]);

  // Auto-snap formations to a valid option for the current age group.
  useEffect(() => {
    const valid = getValidFormations(form.ageGroup);
    const patch: Partial<typeof form> = {};
    if (!valid.includes(form.formationAttacking)) {
      patch.formationAttacking = getDefaultFormation(form.ageGroup);
    }
    if (!valid.includes(form.formationDefending)) {
      patch.formationDefending = getDefaultFormation(form.ageGroup);
    }
    if (Object.keys(patch).length) patchForm(patch);
  }, [form.ageGroup, form.formationAttacking, form.formationDefending, patchForm]);

  const [openSheet, setOpenSheet] = useState<SheetKey | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const ageOptions = useMemo(() => AGE_GROUPS.map((v) => ({ value: v, label: v })), []);
  const coachOptions = useMemo(
    () =>
      COACH_LEVELS.map((v) => ({
        value: v,
        label: formatCoachLevelLabel(v),
      })),
    []
  );
  const phaseOptions = useMemo(() => PHASES.map((v) => ({ value: v, label: PHASE_LABELS[v] || v })), []);
  const zoneOptions = useMemo(() => ZONES.map((v) => ({ value: v, label: ZONE_LABELS[v] || v })), []);
  const spaceOptions = useMemo(
    () => SPACE_CONSTRAINTS.map((v) => ({ value: v, label: SPACE_CONSTRAINT_LABELS[v] || v })),
    []
  );
  const drillTypeOptions = useMemo(
    () => DRILL_TYPES.map((v) => ({ value: v, label: DRILL_TYPE_LABELS[v] || v })),
    []
  );
  const resolvedModelOptions = useMemo(
    () =>
      (modelOptions.length ? modelOptions : GAME_MODEL_OPTIONS.map((o) => o.value)).map((v) => ({
        value: v,
        label: formatGameModelLabel(v as GameModelId),
      })),
    [modelOptions]
  );
  const formationOptions = useMemo(
    () => getValidFormations(form.ageGroup).map((v) => ({ value: v, label: v })),
    [form.ageGroup]
  );
  const topicOptions = useMemo(
    () => getTopicsForPhaseAndZone(form.phase, form.zone, form.coachLevel).map((v) => ({ value: v, label: v })),
    [form.phase, form.zone, form.coachLevel]
  );

  // If the current topic isn't valid for the current phase/zone, clear it.
  useEffect(() => {
    if (form.topic && !topicOptions.some((o) => o.value === form.topic)) {
      patchForm({ topic: null });
    }
  }, [form.topic, topicOptions, patchForm]);

  // Coach ↔ player-level pairing rule.
  const playerLevelAllowed = isPlayerLevelAllowedForCoach(form.coachLevel, form.playerLevel);
  useEffect(() => {
    if (!playerLevelAllowed) {
      patchForm({ playerLevel: 'INTERMEDIATE' });
    }
  }, [playerLevelAllowed, patchForm]);

  return (
    <View style={styles.container}>
      <TabSelector activeType={activeType} onChange={setActiveType} />

      {user?.clubName ? (
        <Text accessibilityRole="text" style={styles.clubBanner}>
          Club: {user.clubName}
        </Text>
      ) : null}

      {/* Row 1: Age + Coach */}
      <DropdownRow>
        <DropdownCell
          label="Age"
          value={form.ageGroup}
          placeholder="Pick"
          pairLeft
          onPress={() => setOpenSheet('age')}
        />
        <DropdownCell
          label="Coach"
          value={coachOptions.find((o) => o.value === form.coachLevel)?.label}
          placeholder="Pick"
          onPress={() => setOpenSheet('coach')}
        />
      </DropdownRow>

      {/* Row 2: Players min + max */}
      <DropdownRow>
        <DropdownCell
          label="Players min"
          value={String(form.numbersMin)}
          placeholder="Pick"
          pairLeft
          onPress={() => setOpenSheet('playersMin')}
        />
        <DropdownCell
          label="Players max"
          value={String(form.numbersMax)}
          placeholder="Pick"
          onPress={() => setOpenSheet('playersMax')}
        />
      </DropdownRow>

      {/* Row 3: Model + Phase */}
      <DropdownRow>
        <DropdownCell
          label="Model"
          value={resolvedModelOptions.find((o) => o.value === form.gameModelId)?.label}
          placeholder={gameModelLocked ? 'Locked' : 'Pick'}
          locked={gameModelLocked}
          pairLeft
          onPress={() => setOpenSheet('model')}
        />
        <DropdownCell
          label="Phase"
          value={phaseOptions.find((o) => o.value === form.phase)?.label}
          placeholder="Pick"
          onPress={() => setOpenSheet('phase')}
        />
      </DropdownRow>

      {/* Row 4: Zone + Topic — zone filters the topic list */}
      <DropdownRow>
        <DropdownCell
          label="Where"
          value={zoneOptions.find((o) => o.value === form.zone)?.label}
          placeholder="Pick"
          pairLeft
          onPress={() => setOpenSheet('zone')}
        />
        <DropdownCell
          label="Topic"
          value={form.topic || (topicOptions[0] ? `${topicOptions[0].label} (auto)` : 'Pick')}
          placeholder="Pick"
          onPress={() => setOpenSheet('topic')}
        />
      </DropdownRow>

      {/* Duration — session or drill depending on tab */}
      {activeType === 'drill' ? (
        <DropdownRow>
          <DropdownCell
            label="Drill duration"
            value={`${form.drillDurationMin} min`}
            placeholder="Pick"
            fullWidth
            onPress={() => setOpenSheet('drillDuration')}
          />
        </DropdownRow>
      ) : (
        <DropdownRow>
          <DropdownCell
            label="Session duration"
            value={`${form.durationMin} min`}
            placeholder="Pick"
            fullWidth
            onPress={() => setOpenSheet('duration')}
          />
        </DropdownRow>
      )}

      {/* Player level + (drill-only) drill type + GK optional */}
      {activeType === 'drill' ? (
        <DropdownRow>
          <DropdownCell
            label="Drill type"
            value={drillTypeOptions.find((o) => o.value === form.drillType)?.label || 'Auto'}
            placeholder="Auto"
            pairLeft
            onPress={() => setOpenSheet('drillType')}
          />
          <DropdownCell
            label="Player level"
            value={humanizeLabel(form.playerLevel)}
            placeholder="Pick"
            onPress={() => {
              if (!playerLevelAllowed) return;
              const idx = PLAYER_LEVELS.indexOf(form.playerLevel);
              const next = PLAYER_LEVELS[(idx + 1) % PLAYER_LEVELS.length];
              patchForm({ playerLevel: next });
            }}
            locked={!playerLevelAllowed}
          />
        </DropdownRow>
      ) : (
        <DropdownRow>
          <DropdownCell
            label="Player level"
            value={humanizeLabel(form.playerLevel)}
            placeholder="Pick"
            fullWidth
            onPress={() => {
              if (!playerLevelAllowed) return;
              const idx = PLAYER_LEVELS.indexOf(form.playerLevel);
              const next = PLAYER_LEVELS[(idx + 1) % PLAYER_LEVELS.length];
              patchForm({ playerLevel: next });
            }}
            locked={!playerLevelAllowed}
          />
        </DropdownRow>
      )}

      {!playerLevelAllowed ? (
        <Text style={styles.ruleHint}>
          Beginner players can't be paired with USSF C / B+ coaches. Using Intermediate.
        </Text>
      ) : null}

      {/* Drill-only: GK optional toggle */}
      {activeType === 'drill' ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: form.gkOptional }}
          accessibilityLabel="GK optional"
          hitSlop={6}
          onPress={() => patchForm({ gkOptional: !form.gkOptional })}
          style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
        >
          <Text style={styles.toggleLabel}>GK optional</Text>
          <View style={[styles.toggleTrack, form.gkOptional ? styles.toggleTrackOn : null]}>
            <View style={[styles.toggleThumb, form.gkOptional ? styles.toggleThumbOn : null]} />
          </View>
        </Pressable>
      ) : null}

      {/* Advanced / fine-tuning: formations, space, goals */}
      <ExpandableSection
        label="Fine-tuning"
        open={showAdvanced}
        onToggle={() => setShowAdvanced((s) => !s)}
      >
        <DropdownRow>
          <DropdownCell
            label="Attack form"
            value={form.formationAttacking}
            placeholder="Auto"
            pairLeft
            onPress={() => setOpenSheet('formationAttacking')}
          />
          <DropdownCell
            label="Defend form"
            value={form.formationDefending}
            placeholder="Auto"
            onPress={() => setOpenSheet('formationDefending')}
          />
        </DropdownRow>
        <Text style={styles.formationHint}>{getFormationTypeLabel(form.ageGroup)}</Text>
        <DropdownRow>
          <DropdownCell
            label="Space"
            value={spaceOptions.find((o) => o.value === form.spaceConstraint)?.label}
            placeholder="Pick"
            pairLeft
            onPress={() => setOpenSheet('space')}
          />
          <DropdownCell
            label="Goals"
            value={String(form.goalsAvailable)}
            placeholder="Pick"
            onPress={() => setOpenSheet('goals')}
          />
        </DropdownRow>
      </ExpandableSection>

      {/* Series-only: number of sessions */}
      {activeType === 'series' ? (
        <View style={styles.stepperCard}>
          <View style={styles.stepperMeta}>
            <Text style={styles.stepperLabel}>Sessions</Text>
            <Text style={styles.stepperValue}>{form.numberOfSessions} in this series</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease sessions"
              hitSlop={6}
              onPress={() => patchForm({ numberOfSessions: Math.max(2, form.numberOfSessions - 1) })}
              style={({ pressed }) => [styles.stepperBtn, pressed ? styles.stepperBtnPressed : null]}
            >
              <Text style={styles.stepperBtnLabel}>−</Text>
            </Pressable>
            <Text style={styles.stepperVal}>{form.numberOfSessions}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase sessions"
              hitSlop={6}
              onPress={() => patchForm({ numberOfSessions: Math.min(10, form.numberOfSessions + 1) })}
              style={({ pressed }) => [styles.stepperBtn, pressed ? styles.stepperBtnPressed : null]}
            >
              <Text style={styles.stepperBtnLabel}>+</Text>
            </Pressable>
          </View>
        </View>
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

      {/* Picker sheets — only one open at a time */}
      <PickerSheet
        visible={openSheet === 'age'}
        title="Age group"
        options={ageOptions}
        selectedValue={form.ageGroup}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ ageGroup: v });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'coach'}
        title="Coach level"
        options={coachOptions}
        selectedValue={form.coachLevel}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ coachLevel: v as CoachLevel });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'playersMin'}
        title="Players — minimum"
        options={PLAYER_COUNT_OPTIONS}
        selectedValue={String(form.numbersMin)}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          const n = Number(v);
          if (Number.isFinite(n)) {
            patchForm({
              numbersMin: n,
              numbersMax: Math.max(n, form.numbersMax),
            });
          }
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'playersMax'}
        title="Players — maximum"
        options={PLAYER_COUNT_OPTIONS}
        selectedValue={String(form.numbersMax)}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          const n = Number(v);
          if (Number.isFinite(n)) {
            patchForm({
              numbersMax: Math.max(n, form.numbersMin),
            });
          }
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'model'}
        title={gameModelLocked ? 'Game model (locked)' : 'Game model'}
        options={resolvedModelOptions}
        selectedValue={form.gameModelId}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          if (gameModelLocked) return;
          patchForm({ gameModelId: v as GameModelId });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'phase'}
        title="Game phase"
        options={phaseOptions}
        selectedValue={form.phase}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ phase: v as Phase });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'zone'}
        title="Where (zone)"
        options={zoneOptions}
        selectedValue={form.zone}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ zone: v as Zone });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'topic'}
        title={`Topic · ${ZONE_LABELS[form.zone]} · ${PHASE_LABELS[form.phase] || form.phase}`}
        options={topicOptions}
        selectedValue={form.topic}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ topic: v });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'formationAttacking'}
        title="Attacking formation"
        subTitle={getFormationTypeLabel(form.ageGroup)}
        options={formationOptions}
        selectedValue={form.formationAttacking}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ formationAttacking: v });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'formationDefending'}
        title="Defending formation"
        subTitle={getFormationTypeLabel(form.ageGroup)}
        options={formationOptions}
        selectedValue={form.formationDefending}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ formationDefending: v });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'space'}
        title="Space constraint"
        options={spaceOptions}
        selectedValue={form.spaceConstraint}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ spaceConstraint: v as SpaceConstraint });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'goals'}
        title="Goals available"
        options={GOALS_OPTIONS}
        selectedValue={String(form.goalsAvailable)}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          const n = Number(v);
          if (Number.isFinite(n)) patchForm({ goalsAvailable: n });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'duration'}
        title="Session duration"
        options={SESSION_DURATION_OPTIONS}
        selectedValue={String(form.durationMin)}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          const n = Number(v);
          if (n === 60 || n === 90) {
            patchForm({ durationMin: n as 60 | 90 });
          }
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'drillDuration'}
        title="Drill duration"
        options={DRILL_DURATION_OPTIONS}
        selectedValue={String(form.drillDurationMin)}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          const n = Number(v);
          if (Number.isFinite(n)) patchForm({ drillDurationMin: n });
          setOpenSheet(null);
        }}
      />
      <PickerSheet
        visible={openSheet === 'drillType'}
        title="Drill type"
        options={drillTypeOptions}
        selectedValue={form.drillType}
        onCancel={() => setOpenSheet(null)}
        onPick={(v) => {
          patchForm({ drillType: v as DrillType });
          setOpenSheet(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  clubBanner: {
    backgroundColor: colors.surfaceAlt,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabRow: {
    backgroundColor: colors.background,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    margin: 12,
    marginBottom: 8,
    padding: 3,
  },
  tab: {
    borderRadius: 999,
    flex: 1,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: '#14381f',
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: colors.primary,
  },
  ruleHint: {
    color: '#d8a64a',
    fontSize: 11,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  formationHint: {
    color: colors.muted,
    fontSize: 10,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 2,
  },
  expandable: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  expandableHeaderPressed: {
    opacity: 0.7,
  },
  expandableLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  expandableChev: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  expandableChevOpen: {
    color: colors.primary,
  },
  expandableBody: {
    paddingBottom: 2,
  },
  expandableHint: {
    color: colors.muted,
    fontSize: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  toggle: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  togglePressed: {
    opacity: 0.7,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTrack: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    padding: 2,
    width: 38,
  },
  toggleTrackOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleThumb: {
    backgroundColor: colors.text,
    borderRadius: 999,
    height: 16,
    width: 16,
  },
  toggleThumbOn: {
    marginLeft: 16,
  },
  stepperCard: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepperMeta: {
    flex: 1,
    gap: 2,
  },
  stepperLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  stepperValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    height: 36,
    width: 116,
  },
  stepperBtn: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: 36,
  },
  stepperBtnPressed: {
    opacity: 0.6,
  },
  stepperBtnLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stepperVal: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressWrap: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
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