import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Option = { value: string; label: string; sublabel?: string };

type Props = {
  visible: boolean;
  title: string;
  options: Option[];
  selectedValue?: string | null;
  subTitle?: string;
  onCancel: () => void;
  onPick: (value: string) => void;
};

export function PickerSheet({ visible, title, options, selectedValue, subTitle, onCancel, onPick }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grab} />
        <Text style={styles.title}>{title}</Text>
        {subTitle ? <Text style={styles.subTitle}>{subTitle}</Text> : null}
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = item.value === selectedValue;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                onPress={() => onPick(item.value)}
                style={({ pressed }) => [
                  styles.row,
                  selected ? styles.rowSelected : null,
                  pressed && !selected ? styles.rowPressed : null,
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, selected ? styles.rowLabelSelected : null]} numberOfLines={2}>
                    {item.label}
                  </Text>
                  {item.sublabel ? <Text style={styles.rowSublabel}>{item.sublabel}</Text> : null}
                </View>
                {selected ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '75%',
    paddingBottom: 28,
  },
  grab: {
    alignSelf: 'center',
    backgroundColor: '#374151',
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    width: 36,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  subTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  row: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  rowSelected: {
    backgroundColor: '#14381f',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  rowSublabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  check: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
