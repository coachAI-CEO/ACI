import { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  /** Optional element rendered inside the right edge of the field (e.g. a show/hide eye). */
  endAdornment?: ReactNode;
};

export function Input({ label, error, endAdornment, style, ...props }: Props & { style?: any }) {
  return (
    <View style={styles.container} accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          style={[styles.input, endAdornment ? styles.inputWithAdornment : null, style]}
          {...props}
        />
        {endAdornment ? <View style={styles.adornment}>{endAdornment}</View> : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  inputWithAdornment: {
    paddingRight: 44,
  },
  adornment: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
});
