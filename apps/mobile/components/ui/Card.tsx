import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = PropsWithChildren<{
  /** Matchday editorial: softer surface, no hard border. */
  variant?: 'default' | 'editorial';
  /** Tighter padding for dense rows (e.g. home greeting card). */
  compact?: boolean;
}>;

export function Card({ children, variant = 'editorial', compact }: Props) {
  return (
    <View
      style={[
        styles.card,
        variant === 'default' ? styles.default : styles.editorial,
        compact ? styles.compact : null,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
  },
  compact: {
    paddingVertical: 10,
  },
  editorial: {
    backgroundColor: '#121a2a',
  },
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
});