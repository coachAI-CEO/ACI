import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BoardCard } from '../../components/boards/BoardCard';
import { CreateBoardSheet } from '../../components/boards/CreateBoardSheet';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { describeApiError } from '../../services/api';
import { deleteBoard, listBoards, type BoardListItem } from '../../services/boards.service';
import {
  evictCachedBoard,
  writeBoardsCache,
} from '../../services/offline-cache.service';
import { useAuthStore } from '../../stores/auth.store';
import { useOfflineStore } from '../../stores/offline.store';

type ShareFilter = 'ALL' | 'PRIVATE' | 'CLUB';

const PAGE_SIZE = 40;

export default function BoardsHomeScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const tacticalBoardV1 = Boolean(user?.features?.tacticalBoardV1);
  const cachedBoards = useOfflineStore((s) => s.cachedBoards);
  const { create } = useLocalSearchParams<{ create?: string }>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [shareFilter, setShareFilter] = useState<ShareFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (create === '1') setCreateOpen(true);
  }, [create]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  if (user && !tacticalBoardV1) {
    return <BoardsComingSoon />;
  }

  const infinite = useInfiniteQuery({
    queryKey: ['boards', 'list'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listBoards(PAGE_SIZE, pageParam as string | null),
    getNextPageParam: (last) => last.nextCursor,
    enabled: tacticalBoardV1,
  });

  // Mirror the first page to the offline cache so list+detail fall back
  // to it when the API is unreachable.
  useEffect(() => {
    if (!user?.id) return;
    const first = infinite.data?.pages?.[0];
    if (!first?.boards) return;
    void writeBoardsCache(first.boards, user.id);
  }, [user?.id, infinite.data]);

  const networkBoards: BoardListItem[] = useMemo(() => {
    const pages = infinite.data?.pages || [];
    return pages.flatMap((p) => p.boards);
  }, [infinite.data]);

  const networkFailed = !!infinite.error && !infinite.data;
  const allBoards: BoardListItem[] = networkFailed && cachedBoards.length > 0 ? cachedBoards : networkBoards;

  const filtered = useMemo(() => {
    return allBoards.filter((board) => {
      if (shareFilter !== 'ALL' && (board.shareMode || 'PRIVATE') !== shareFilter) return false;
      if (debouncedSearch) {
        const haystack = `${board.title || ''} ${board.ageGroup || ''}`.toLowerCase();
        if (!haystack.includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [allBoards, shareFilter, debouncedSearch]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBoard(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: ['boards', 'list'] });
      void evictCachedBoard(id, user?.id);
    },
    onError: (err) => {
      Alert.alert('Couldn’t delete board', describeApiError(err, 'Try again in a moment.'));
    },
  });

  function confirmDelete(board: BoardListItem) {
    if (!board.canEdit) return;
    Alert.alert(
      'Delete board?',
      `${board.title || 'Untitled board'} will be removed. This can’t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(board.id),
        },
      ]
    );
  }

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      {networkFailed && cachedBoards.length > 0 ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Offline · showing your last saved boards
          </Text>
        </View>
      ) : null}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Boards</Text>
          <Text style={styles.subtitle}>
            View + create boards. Edit on web for drawing tools.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create board"
          onPress={() => setCreateOpen(true)}
          style={({ pressed }) => [styles.createBtn, pressed ? styles.createBtnPressed : null]}
        >
          <Text style={styles.createBtnLabel}>＋ New</Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search boards"
        placeholderTextColor={colors.muted}
        style={styles.search}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />

      <View style={styles.chipsRow}>
        {(['ALL', 'PRIVATE', 'CLUB'] as ShareFilter[]).map((id) => {
          const selected = shareFilter === id;
          const label = id === 'ALL' ? 'All' : id === 'PRIVATE' ? 'Private' : 'Club';
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setShareFilter(id)}
              style={[styles.chip, selected ? styles.chipSelected : null]}
            >
              <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!infinite.hasNextPage) return null;
    return (
      <View style={styles.footer}>
        <Button
          title={infinite.isFetchingNextPage ? 'Loading…' : 'Load more'}
          variant="secondary"
          onPress={() => infinite.fetchNextPage()}
          disabled={infinite.isFetchingNextPage}
        />
      </View>
    );
  };

  const renderEmpty = () => {
    if (infinite.isLoading) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (infinite.error) {
      return (
        <View style={styles.empty}>
          <ErrorMessage message={describeApiError(infinite.error, 'Boards unavailable.')} />
        </View>
      );
    }
    const hasFilters = debouncedSearch.length > 0 || shareFilter !== 'ALL';
    if (hasFilters) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>Try clearing the search or share filter.</Text>
        </View>
      );
    }
    return <EmptyState onCreate={() => setCreateOpen(true)} />;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BoardCard board={item} onLongPress={item.canEdit ? () => confirmDelete(item) : undefined} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={infinite.isRefetching}
            onRefresh={() => infinite.refetch()}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (infinite.hasNextPage && !infinite.isFetchingNextPage) {
            infinite.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
      />

      <CreateBoardSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(boardId) => {
          setCreateOpen(false);
          router.push({ pathname: '/boards/[id]', params: { id: boardId } });
        }}
      />
    </SafeAreaView>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No boards yet</Text>
      <Text style={styles.emptyBody}>
        Create a blank board, fork a session, or fork a drill. Drawing tools still live on the
        web — once you save on the web, it shows up here.
      </Text>
      <View style={styles.emptyActions}>
        <Button title="Create your first board" onPress={onCreate} />
      </View>
    </View>
  );
}

function BoardsComingSoon() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Boards are coming soon</Text>
        <Text style={styles.emptyBody}>
          The mobile tactical-board editor isn't enabled on your plan yet. You can still view
          boards shared with your club on the web.
        </Text>
        <View style={styles.emptyActions}>
          <Button
            title="Open web"
            variant="secondary"
            onPress={() => void Linking.openURL(webPath('/boards'))}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  listContent: { gap: 12, padding: 16, paddingBottom: 48 },
  headerWrap: { gap: 12 },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  headerText: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 13 },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createBtnPressed: { opacity: 0.7 },
  createBtnLabel: { color: '#062816', fontSize: 13, fontWeight: '800' },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: '#14381f', borderColor: colors.primary },
  chipLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipLabelSelected: { color: colors.primary, fontWeight: '800' },
  separator: { height: 12 },
  footer: { paddingTop: 4 },
  offlineBanner: {
    backgroundColor: '#3b2a16',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offlineBannerText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  emptyActions: { paddingTop: 8, width: '100%' },
});
