import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/colors';
import { humanizeLabel } from '../../utils/format';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  ageGroup: string;
  onAgeGroupChange: (value: string) => void;
  gameModelId: string;
  onGameModelIdChange: (value: string) => void;
};

const AGE_OPTIONS = ['', 'U10', 'U12', 'U14', 'U16', 'U18'];
const MODEL_OPTIONS = ['', 'POSSESSION', 'PRESSING', 'TRANSITION', 'COACHAI', 'ROCKLIN_FC'];

function ChipRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.chipBlock} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipsRow}>
        {options.map((option) => {
          const selected = option === value;
          const text = option ? (option.startsWith('U') ? option : humanizeLabel(option)) : 'All';
          return (
            <Pressable
              key={`${label}-${text}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${text}`}
              hitSlop={6}
              onPress={() => onChange(option)}
              style={({ pressed }) => [styles.chip, selected ? styles.chipActive : null, pressed ? styles.chipPressed : null]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function VaultFilterBar({
  search,
  onSearchChange,
  ageGroup,
  onAgeGroupChange,
  gameModelId,
  onGameModelIdChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        accessibilityLabel="Search vault"
        placeholder="Search keyword or ref code"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={onSearchChange}
        style={styles.input}
      />

      <ChipRow label="Age" value={ageGroup} options={AGE_OPTIONS} onChange={onAgeGroupChange} />
      <ChipRow label="Model" value={gameModelId} options={MODEL_OPTIONS} onChange={onGameModelIdChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  chipBlock: {
    gap: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
