import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  ageGroup: string;
  onAgeGroupChange: (value: string) => void;
  gameModelId: string;
  onGameModelIdChange: (value: string) => void;
};

const AGE_OPTIONS = ['', 'U10', 'U12', 'U14', 'U16', 'U18'];
const MODEL_OPTIONS = ['', 'POSSESSION', 'PRESSING', 'TRANSITION', 'COACHAI'];

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
    <View style={styles.chipBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipsRow}>
        {options.map((option) => {
          const selected = option === value;
          const text = option || 'All';
          return (
            <Text
              key={`${label}-${text}`}
              onPress={() => onChange(option)}
              style={[styles.chip, selected ? styles.chipActive : null]}
            >
              {text}
            </Text>
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
    minHeight: 42,
    paddingHorizontal: 12,
  },
  chipBlock: {
    gap: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
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
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipActive: {
    borderColor: colors.primary,
    color: colors.primary,
    fontWeight: '700',
  },
});
