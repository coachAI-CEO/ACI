import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_FORMATIONS,
  FORMATIONS_BY_FORMAT,
  PITCH_SPECS,
  type FormationId,
  type PitchFormatId,
} from '@aci/shared';
import { colors } from '../../constants/colors';

type Props = {
  visible: boolean;
  targetFormat: PitchFormatId;
  currentFormat: PitchFormatId;
  onClose: () => void;
  onApply: (input: {
    format: PitchFormatId;
    attFormation: FormationId;
    defFormation: FormationId;
    resetBoard: boolean;
  }) => void;
};

/**
 * Single-screen formation picker — DEF on top, ATT below; no scroll.
 */
export function FormatFormationSheet({
  visible,
  targetFormat,
  currentFormat,
  onClose,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();
  const defaults = DEFAULT_FORMATIONS[targetFormat];
  const options = FORMATIONS_BY_FORMAT[targetFormat];
  const [attFormation, setAttFormation] = useState<FormationId>(defaults.home);
  const [defFormation, setDefFormation] = useState<FormationId>(defaults.away);

  useEffect(() => {
    if (!visible) return;
    const d = DEFAULT_FORMATIONS[targetFormat];
    setAttFormation(d.home);
    setDefFormation(d.away);
  }, [visible, targetFormat]);

  const formatChanging = targetFormat !== currentFormat;
  const spec = PITCH_SPECS[targetFormat];
  const formatLabel =
    targetFormat === '7V7' ? '7v7' : targetFormat === '9V9' ? '9v9' : '11v11';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(12, insets.bottom) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>{formatLabel} formations</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {spec.ages} · {spec.lengthYards}×{spec.widthYards} yds
                {formatChanging ? ' · resets pitch' : ''}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose}>
              <Text style={styles.close}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={styles.formRow}>
              <Text style={styles.formTag}>DEF</Text>
              <View style={styles.chips}>
                {options.map((o) => (
                  <Chip
                    key={`def-${o.id}`}
                    label={o.label}
                    hint={o.hint}
                    selected={defFormation === o.id}
                    tone="def"
                    onPress={() => setDefFormation(o.id)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.formRow}>
              <Text style={styles.formTag}>ATT</Text>
              <View style={styles.chips}>
                {options.map((o) => (
                  <Chip
                    key={`att-${o.id}`}
                    label={o.label}
                    hint={o.hint}
                    selected={attFormation === o.id}
                    tone="att"
                    onPress={() => setAttFormation(o.id)}
                  />
                ))}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={formatChanging ? 'Reset and apply formations' : 'Apply formations'}
              onPress={() =>
                onApply({
                  format: targetFormat,
                  attFormation,
                  defFormation,
                  resetBoard: formatChanging,
                })
              }
              style={({ pressed }) => [styles.applyBtn, pressed ? { opacity: 0.85 } : null]}
            >
              <Text style={styles.applyLabel}>
                {formatChanging ? `Reset to ${formatLabel} · Apply` : 'Apply formations'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({
  label,
  hint,
  selected,
  tone,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  tone: 'att' | 'def';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
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
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headText: { flex: 1, gap: 2, paddingRight: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 11 },
  close: { color: colors.primary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  body: { gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  formRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  formTag: { color: colors.muted, fontSize: 11, fontWeight: '800', width: 28 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipAtt: { backgroundColor: '#166534', borderColor: '#166534' },
  chipDef: { backgroundColor: '#991b1b', borderColor: '#991b1b' },
  chipLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipLabelOn: { color: '#fff' },
  applyBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: 10,
  },
  applyLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
