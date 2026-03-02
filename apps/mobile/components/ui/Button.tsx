import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ title, onPress, disabled, loading, variant = 'primary' }: Props) {
  const isDisabled = disabled || loading;
  const backgroundColor =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surfaceAlt;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.label}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
