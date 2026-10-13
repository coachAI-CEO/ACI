import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { Input } from './Input';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

/**
 * Standard password field with a built-in show/hide eye toggle.
 * Wraps the shared `Input` so we get consistent spacing, errors, and styling.
 */
export function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize = 'none',
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      autoCapitalize={autoCapitalize}
      error={error}
      label={label}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!visible}
      value={value}
      endAdornment={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={10}
          onPress={() => setVisible((v) => !v)}
          style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : null]}
        >
          <Ionicons
            color={colors.muted}
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
          />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  btnPressed: {
    opacity: 0.5,
  },
});
