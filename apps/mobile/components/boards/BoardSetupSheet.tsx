import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BOARD_SETUP_CHANNELS,
  BOARD_SETUP_PHASES,
  BOARD_SETUP_ZONES,
  DEFAULT_FORMATIONS,
  FORMATIONS_BY_FORMAT,
  hasFullSetup,
  type BoardSetupChannel,
  type BoardSetupChannelOrNone,
  type BoardSetupPhase,
  type BoardSetupPhaseOrNone,
  type BoardSetupZone,
  type BoardSetupZoneOrNone,
  type FormationId,
  type PitchFormatId,
} from '@aci/shared';
import { colors } from '../../constants/colors';
import { SegmentedControl } from '../ui/SegmentedControl';

type Props = {
  visible: boolean;
  format: PitchFormatId;
  showAtt: boolean;
  showDef: boolean;
  showZones: boolean;
  showThirds: boolean;
  applyingPhase?: boolean;
  onClose: () => void;
  onResetFormat: (format: PitchFormatId) => void;
  onApplyAttFormation: (id: FormationId) => void;
  onApplyDefFormation: (id: FormationId) => void;
  onToggleAtt: (next: boolean) => void;
  onToggleDef: (next: boolean) => void;
  onToggleZones: (next: boolean) => void;
  onToggleThirds: (next: boolean) => void;
  onApplyPhase: (input: {
    phase: BoardSetupPhase;
    zone: BoardSetupZone;
    channel: BoardSetupChannel;
    attFormation: FormationId;
    defFormation: FormationId;
  }) => void;
};

/**
 * Dense single-screen Setup — no scrolling.
 * DEF formations above ATT to match pitch orientation.
 */
export function BoardSetupSheet({
  visible,
  format,
  showAtt,
  showDef,
  showZones,
  showThirds,
  applyingPhase,
  onClose,
  onResetFormat,
  onApplyAttFormation,
  onApplyDefFormation,
  onToggleAtt,
  onToggleDef,
  onToggleZones,
  onToggleThirds,
  onApplyPhase,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draftFormat, setDraftFormat] = useState<PitchFormatId>(format);
  const defaults = DEFAULT_FORMATIONS[draftFormat];
  const options = FORMATIONS_BY_FORMAT[draftFormat];
  const [attFormation, setAttFormation] = useState<FormationId>(defaults.home);
  const [defFormation, setDefFormation] = useState<FormationId>(defaults.away);
  const [phase, setPhase] = useState<BoardSetupPhaseOrNone>('');
  const [zone, setZone] = useState<BoardSetupZoneOrNone>('');
  const [channel, setChannel] = useState<BoardSetupChannelOrNone>('');

  useEffect(() => {
    if (!visible) return;
    setDraftFormat(format);
    const d = DEFAULT_FORMATIONS[format];
    setAttFormation(d.home);
    setDefFormation(d.away);
    setPhase('');
    setZone('');
    setChannel('');
  }, [visible, format]);

  const formatDirty = draftFormat !== format;
  const ready = hasFullSetup(phase, zone, channel);
  const attOptions = useMemo(() => options, [options]);
  const defOptions = useMemo(() => options, [options]);

  function confirmReset() {
    Alert.alert(
      `Reset to ${labelFor(draftFormat)}?`,
      'Replaces players, ball, and goals. Arrows and labels on this frame are cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            onResetFormat(draftFormat);
            onClose();
          },
        },
      ]
    );
  }

  function applyPhase() {
    if (!hasFullSetup(phase, zone, channel)) return;
    onApplyPhase({
      phase,
      zone: zone as BoardSetupZone,
      channel: channel as BoardSetupChannel,
      attFormation,
      defFormation,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(12, insets.bottom) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.head}>
            <Text style={styles.title}>Setup</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close setup" onPress={onClose}>
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            {/* Format + reset */}
            <View style={styles.row}>
              <SegmentedControl
                accessibilityLabel="Pitch format"
                compact
                value={draftFormat}
                onChange={(v) => {
                  const next = v as PitchFormatId;
                  setDraftFormat(next);
                  const d = DEFAULT_FORMATIONS[next];
                  setAttFormation(d.home);
                  setDefFormation(d.away);
                }}
                options={[
                  { value: '7V7', label: '7v7' },
                  { value: '9V9', label: '9v9' },
                  { value: '11V11', label: '11v11' },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset board to format"
                onPress={confirmReset}
                style={({ pressed }) => [
                  styles.resetBtn,
                  formatDirty ? styles.resetBtnAccent : null,
                  pressed ? { opacity: 0.75 } : null,
                ]}
              >
                <Text style={styles.resetLabel}>Reset</Text>
              </Pressable>
            </View>

            {/* Teams + overlays */}
            <View style={styles.row}>
              <MiniToggle label="ATT" active={showAtt} onPress={() => onToggleAtt(!showAtt)} tone="att" />
              <MiniToggle label="DEF" active={showDef} onPress={() => onToggleDef(!showDef)} tone="def" />
              <View style={styles.spacer} />
              <MiniToggle
                label="Lanes"
                active={showZones}
                onPress={() => onToggleZones(!showZones)}
                tone="neutral"
              />
              <MiniToggle
                label="Thirds"
                active={showThirds}
                onPress={() => onToggleThirds(!showThirds)}
                tone="neutral"
              />
            </View>

            {/* Formations — DEF then ATT */}
            <View style={styles.formRow}>
              <Text style={styles.formTag}>DEF</Text>
              <View style={styles.chips}>
                {defOptions.map((o) => (
                  <Chip
                    key={`def-${o.id}`}
                    label={o.label}
                    selected={defFormation === o.id}
                    tone="def"
                    onPress={() => {
                      setDefFormation(o.id);
                      onApplyDefFormation(o.id);
                    }}
                  />
                ))}
              </View>
            </View>
            <View style={styles.formRow}>
              <Text style={styles.formTag}>ATT</Text>
              <View style={styles.chips}>
                {attOptions.map((o) => (
                  <Chip
                    key={`att-${o.id}`}
                    label={o.label}
                    selected={attFormation === o.id}
                    tone="att"
                    onPress={() => {
                      setAttFormation(o.id);
                      onApplyAttFormation(o.id);
                    }}
                  />
                ))}
              </View>
            </View>

            {/* Phase · Third · Channel */}
            <Text style={styles.section}>Phase</Text>
            <SegmentedControl
              accessibilityLabel="Setup phase"
              compact
              value={phase || '__none__'}
              onChange={(v) => setPhase(v === '__none__' ? '' : (v as BoardSetupPhase))}
              options={[
                { value: '__none__', label: '—' },
                ...BOARD_SETUP_PHASES.map((o) => ({ value: o.id, label: shortPhase(o.id) })),
              ]}
            />
            <SegmentedControl
              accessibilityLabel="Setup third"
              compact
              value={zone || '__none__'}
              onChange={(v) => setZone(v === '__none__' ? '' : (v as BoardSetupZone))}
              options={[
                { value: '__none__', label: '—' },
                ...BOARD_SETUP_ZONES.map((o) => ({ value: o.id, label: shortZone(o.id) })),
              ]}
            />
            <SegmentedControl
              accessibilityLabel="Setup channel"
              compact
              value={channel || '__none__'}
              onChange={(v) => setChannel(v === '__none__' ? '' : (v as BoardSetupChannel))}
              options={[
                { value: '__none__', label: '—' },
                ...BOARD_SETUP_CHANNELS.map((o) => ({ value: o.id, label: o.label })),
              ]}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply phase placement"
              accessibilityState={{ disabled: !ready || !!applyingPhase }}
              disabled={!ready || !!applyingPhase}
              onPress={applyPhase}
              style={({ pressed }) => [
                styles.applyBtn,
                !ready || applyingPhase ? styles.applyBtnDisabled : null,
                pressed && ready ? { opacity: 0.85 } : null,
              ]}
            >
              {applyingPhase ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.applyLabel}>
                  {ready ? 'Apply phase' : 'Pick phase · third · channel'}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function labelFor(format: PitchFormatId) {
  return format === '7V7' ? '7v7' : format === '9V9' ? '9v9' : '11v11';
}

function shortPhase(id: BoardSetupPhase) {
  if (id === 'ATTACKING') return 'Att';
  if (id === 'DEFENDING') return 'Def';
  return 'Trans';
}

function shortZone(id: BoardSetupZone) {
  if (id === 'DEFENSIVE_THIRD') return 'Def ⅓';
  if (id === 'MIDDLE_THIRD') return 'Mid';
  return 'Att ⅓';
}

function Chip({
  label,
  selected,
  tone,
  onPress,
}: {
  label: string;
  selected: boolean;
  tone: 'att' | 'def';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        selected && tone === 'att' ? styles.chipAtt : null,
        selected && tone === 'def' ? styles.chipDef : null,
      ]}
    >
      <Text style={[styles.chipLabel, selected ? styles.chipLabelOn : null]}>{label}</Text>
    </Pressable>
  );
}

function MiniToggle({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone: 'att' | 'def' | 'neutral';
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${label} ${active ? 'on' : 'off'}`}
      onPress={onPress}
      style={[
        styles.mini,
        active && tone === 'att' ? styles.miniAtt : null,
        active && tone === 'def' ? styles.miniDef : null,
        active && tone === 'neutral' ? styles.miniNeu : null,
        !active ? styles.miniOff : null,
      ]}
    >
      <Text style={[styles.miniLabel, active ? styles.miniLabelOn : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  head: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  close: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  body: { gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  spacer: { flex: 1 },
  section: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  resetBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  resetBtnAccent: { borderColor: colors.primary },
  resetLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  formRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  formTag: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    width: 28,
  },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipAtt: { backgroundColor: '#166534', borderColor: '#166534' },
  chipDef: { backgroundColor: '#991b1b', borderColor: '#991b1b' },
  chipLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipLabelOn: { color: '#fff' },
  mini: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  miniAtt: { backgroundColor: '#166534', borderColor: '#166534' },
  miniDef: { backgroundColor: '#991b1b', borderColor: '#991b1b' },
  miniNeu: { backgroundColor: colors.primary, borderColor: colors.primary },
  miniOff: { backgroundColor: colors.surface, borderColor: colors.border },
  miniLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  miniLabelOn: { color: '#fff' },
  applyBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 40,
    paddingVertical: 10,
  },
  applyBtnDisabled: { opacity: 0.4 },
  applyLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
