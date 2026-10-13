import type { VaultSessionListItem } from '@aci/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  item: VaultSessionListItem;
  onPress: () => void;
};

export function RecentVaultItem({ item, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.ref}>{item.refCode || 'Session'}</Text>
        <Text numberOfLines={1} style={styles.title}>{item.title || 'Untitled Session'}</Text>
      </View>
      <Text style={styles.meta}>{item.ageGroup || '--'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  left: {
    flex: 1,
    paddingRight: 8,
  },
  ref: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    marginTop: 2,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
});
