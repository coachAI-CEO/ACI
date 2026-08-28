import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { formatGameModelLabel } from '../../utils/format';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  ageGroup: string;
  onAgeGroupChange: (value: string) => void;
  gameModelId: string;
  onGameModelIdChange: (value: string) => void;
  showGameModelFilter?: boolean;
  onRefLookup?: () => void;
  onClearFilters?: () => void;
};

const AGE_OPTIONS = ['', 'U10', 'U11', 'U12', 'U14', 'U16', 'U18'];
const MODEL_OPTIONS = ['', 'POSSESSION', 'PRESSING', 'TRANSITION', 'COACHAI', 'ROCKLIN_FC'];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.chipActive : null, pressed ? styles.chipPressed : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function VaultFilterBar({
  search,
  onSearchChange,
  ageGroup,
  onAgeGroupChange,
  gameModelId,
  onGameModelIdChange,
  showGameModelFilter = true,
  onRefLookup,
  onClearFilters,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (ageGroup) count += 1;
    if (showGameModelFilter && gameModelId) count += 1;
    return count;
  }, [search, ageGroup, gameModelId, showGameModelFilter]);

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search vault"
            placeholder="Search keyword or ref"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={onSearchChange}
            style={styles.input}
            returnKeyType="search"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
          onPress={() => setFiltersOpen(true)}
          style={({ pressed }) => [styles.filtersBtn, pressed ? styles.pressed : null]}
        >
          <Text style={styles.filtersBtnText}>Filters</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageRow}>
        {AGE_OPTIONS.map((option) => (
          <Chip
            key={`age-${option || 'all'}`}
            label={option || 'All ages'}
            selected={option === ageGroup}
            onPress={() => onAgeGroupChange(option)}
          />
        ))}
      </ScrollView>

      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setFiltersOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Filters</Text>

            <Text style={styles.sheetLabel}>Age</Text>
            <View style={styles.sheetChips}>
              {AGE_OPTIONS.map((option) => (
                <Chip
                  key={`sheet-age-${option || 'all'}`}
                  label={option || 'All'}
                  selected={option === ageGroup}
                  onPress={() => onAgeGroupChange(option)}
                />
              ))}
            </View>

            {showGameModelFilter ? (
              <>
                <Text style={styles.sheetLabel}>Model</Text>
                <View style={styles.sheetChips}>
                  {MODEL_OPTIONS.map((option) => (
                    <Chip
                      key={`sheet-model-${option || 'all'}`}
                      label={option ? formatGameModelLabel(option) : 'All'}
                      selected={option === gameModelId}
                      onPress={() => onGameModelIdChange(option)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.sheetActions}>
              {onRefLookup ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setFiltersOpen(false);
                    onRefLookup();
                  }}
                  style={styles.sheetSecondary}
                >
                  <Text style={styles.sheetSecondaryText}>Ref lookup</Text>
                </Pressable>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClearFilters?.();
                }}
                style={styles.sheetSecondary}
              >
                <Text style={styles.sheetSecondaryText}>Clear</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFiltersOpen(false)}
                style={styles.sheetPrimary}
              >
                <Text style={styles.sheetPrimaryText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#121a2a',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: colors.muted,
    fontSize: 16,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    minHeight: 44,
  },
  filtersBtn: {
    alignItems: 'center',
    backgroundColor: '#151e2f',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  filtersBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 99,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#052e16',
    fontSize: 11,
    fontWeight: '800',
  },
  ageRow: {
    gap: 6,
    paddingRight: 8,
  },
  chip: {
    backgroundColor: '#151e2f',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primary,
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
    color: '#052e16',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0e1624',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 10,
    padding: 16,
    paddingBottom: 28,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  sheetLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  sheetSecondary: {
    alignItems: 'center',
    backgroundColor: '#151e2f',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  sheetSecondaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sheetPrimary: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  sheetPrimaryText: {
    color: '#052e16',
    fontSize: 13,
    fontWeight: '800',
  },
});
