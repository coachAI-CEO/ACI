import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../constants/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'outline';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  /** When true, fills the row width with extra horizontal padding. Defaults to true. */
  block?: boolean;
};

const DARK_TEXT = '#062b1d';

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  block = true,
}: Props) {
  const isDisabled = Boolean(disabled) || Boolean(loading);

  const visual = (() => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          color: colors.text,
        };
      case 'danger':
        return {
          backgroundColor: 'rgba(220, 38, 38, 0.92)',
          borderColor: 'transparent',
          color: '#fff',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primary,
          color: colors.primary,
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          color: DARK_TEXT,
        };
    }
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        block ? styles.block : null,
        {
          backgroundColor: visual.backgroundColor,
          borderColor: visual.borderColor,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={visual.color} />
      ) : (
        <Text style={[styles.label, { color: visual.color }]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  block: {
    alignSelf: 'stretch',
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
