import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CacheStaleIndicator } from '../../components/offline/CacheStaleIndicator';
import { OfflineEmptyState } from '../../components/offline/OfflineEmptyState';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SessionCard, SeriesCard, DrillCard } from '../../components/vault/VaultCards';
import { VaultFilterBar } from '../../components/vault/VaultFilterBar';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineVault } from '../../hooks/useOfflineVault';
import { describeApiError } from '../../services/api';
import {
  countEventsBySessionId,
  getVaultCalendarEvents,
} from '../../services/calendar.service';
import {
  checkFavorites,
  toggleDrillFavorite,
  toggleSeriesFavorite,
  toggleSessionFavorite,
} from '../../services/favorites.service';
import {
  deriveDrillsFromSessions,
  getVaultSeries,
  getVaultSessions,
  lookupRefCode,
  searchVaultSessions,
  type VaultDrillLite,
  type VaultSeries,
  type VaultSession,
} from '../../services/vault.service';
import { readVaultSessionsCache, writeVaultSessionsCache } from '../../services/offline-cache.service';
import { useVaultStore } from '../../stores/vault.store';
import { shouldShowGameModelInVault } from '../../utils/game-model-scope';

function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function matchesSessionFilters(
  session: VaultSession,
  filters: { ageGroup: string; gameModelId: string; phase: string; zone: string }
) {
  if (filters.ageGroup && session.ageGroup !== filters.ageGroup) return false;
  if (filters.gameModelId && session.gameModelId !== filters.gameModelId) return false;
  if (filters.phase && session.phase !== filters.phase) return false;
  if (filters.zone && session.zone !== filters.zone) return false;
  return true;
}

function Tabs({ activeTab, onChange }: { activeTab: 'sessions' | 'series' | 'drills'; onChange: (tab: 'sessions' | 'series' | 'drills') => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {(['sessions', 'series', 'drills'] as const).map((tab) => {
        const selected = activeTab === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tab} vault tab`}
            hitSlop={4}
            onPress={() => onChange(tab)}
            style={[styles.tab, selected ? styles.tabActive : null]}
          >
            <Text style={[styles.tabText, selected ? styles.tabTextActive : null]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function VaultTab() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { cacheUpdatedAt } = useOfflineVault();

  const activeTab = useVaultStore((s) => s.activeTab);
  const filters = useVaultStore((s) => s.filters);
  const setActiveTab = useVaultStore((s) => s.setActiveTab);
  const patchFilters = useVaultStore((s) => s.patchFilters);
  const clearFilters = useVaultStore((s) => s.clearFilters);

  const [offset, setOffset] = useState(0);
  const [sessionList, setSessionList] = useState<VaultSession[]>([]);
  const [favoriteSessions, setFavoriteSessions] = useState<Record<string, boolean>>({});
  const [favoriteDrills, setFavoriteDrills] = useState<Record<string, boolean>>({});
  const [favoriteSeries, setFavoriteSeries] = useState<Record<string, boolean>>({});
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  const showGameModelFilter = shouldShowGameModelInVault(user);
  const singleListModel = useMemo(() => {
    const models = [
      ...new Set(
        sessionList.map((session) => session.gameModelId).filter((value): value is string => Boolean(value))
      ),
    ];
    return models.length === 1 ? models[0] : null;
  }, [sessionList]);
  // Club-locked users never need model labels; also hide when the open list is already one model.
  const showGameModelOnCards = showGameModelFilter && !filters.gameModelId && !singleListModel;

  const debouncedSearch = useDebouncedValue(filters.search, 400);
  const hasSearch = debouncedSearch.trim().length > 0;

  useEffect(() => {
    if (!showGameModelFilter && filters.gameModelId) {
      patchFilters({ gameModelId: '' });
    }
  }, [showGameModelFilter, filters.gameModelId, patchFilters]);

  const resetFiltersAndOffset = (next: Partial<typeof filters>) => {
    setOffset(0);
    patchFilters(next);
  };

  const sessionsQuery = useQuery({
    queryKey: ['vault', 'sessions', offset, debouncedSearch, filters.ageGroup, filters.gameModelId, filters.phase, filters.zone],
    queryFn: async () => {
      if (hasSearch) {
        const sessions = await searchVaultSessions({
          query: debouncedSearch,
          params: {
            ageGroup: filters.ageGroup || undefined,
            gameModelId: filters.gameModelId || undefined,
            phase: filters.phase || undefined,
            zone: filters.zone || undefined,
          },
          limit: 20,
        });
        return { sessions, total: sessions.length };
      }

      return getVaultSessions({
        limit: 20,
        offset,
        ageGroup: filters.ageGroup || undefined,
        gameModelId: filters.gameModelId || undefined,
        phase: filters.phase || undefined,
        zone: filters.zone || undefined,
      });
    },
    enabled: isOnline,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const seriesQuery = useQuery({
    queryKey: ['vault', 'series'],
    queryFn: getVaultSeries,
    enabled: activeTab === 'series' && isOnline,
  });

  const calendarQuery = useQuery({
    queryKey: ['vault', 'calendar-counts'],
    queryFn: getVaultCalendarEvents,
    enabled: isOnline && Boolean(user?.features?.canAccessCalendar),
    staleTime: 60_000,
  });

  const sessionCalendarCounts = useMemo(
    () => countEventsBySessionId(calendarQuery.data || []),
    [calendarQuery.data]
  );

  const seriesCalendarStats = useMemo(() => {
    const totalCounts: Record<string, number> = {};
    const scheduledParts: Record<string, number> = {};
    for (const entry of seriesQuery.data || []) {
      let total = 0;
      let partsScheduled = 0;
      for (const session of entry.sessions || []) {
        const sessionCount = sessionCalendarCounts[session.id] || 0;
        total += sessionCount;
        if (sessionCount > 0) partsScheduled += 1;
      }
      if (total > 0) totalCounts[entry.seriesId] = total;
      if (partsScheduled > 0) scheduledParts[entry.seriesId] = partsScheduled;
    }
    return { totalCounts, scheduledParts };
  }, [seriesQuery.data, sessionCalendarCounts]);

  useEffect(() => {
    const incoming = sessionsQuery.data?.sessions || [];
    if (offset === 0 || hasSearch) {
      setSessionList(incoming);
      return;
    }
    setSessionList((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of incoming) {
        byId.set(item.id, item);
      }
      return Array.from(byId.values());
    });
  }, [sessionsQuery.data?.sessions, offset, hasSearch]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }
    if (!sessionList.length) {
      return;
    }
    writeVaultSessionsCache(sessionList, user?.id).catch(() => undefined);
  }, [sessionList, isOnline, user?.id]);

  useEffect(() => {
    if (isOnline) {
      return;
    }
    readVaultSessionsCache(user?.id)
      .then((payload) => {
        if (!payload) return;
        setSessionList(payload.sessions || []);
      })
      .catch(() => undefined);
  }, [isOnline, user?.id]);

  const drills = useMemo<VaultDrillLite[]>(() => {
    const items = deriveDrillsFromSessions(sessionList);
    if (!hasSearch) {
      return items;
    }
    const q = debouncedSearch.toLowerCase();
    return items.filter((item) => {
      const haystack = `${item.refCode} ${item.title} ${item.ageGroup || ''} ${item.phase || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [sessionList, hasSearch, debouncedSearch]);

  const visibleSeries = useMemo<VaultSeries[]>(() => {
    const all = seriesQuery.data || [];
    return all.filter((entry) => {
      if (filters.ageGroup && entry.ageGroup !== filters.ageGroup) {
        return false;
      }
      if (filters.gameModelId && entry.gameModelId !== filters.gameModelId) {
        return false;
      }
      if (!hasSearch) {
        return true;
      }
      const q = debouncedSearch.toLowerCase();
      const haystack = `${entry.seriesId} ${entry.sessions?.[0]?.title || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [seriesQuery.data, filters.ageGroup, filters.gameModelId, hasSearch, debouncedSearch]);

  // Show matching cards immediately while the server catch-up request is in flight.
  const displayedSessions = useMemo(() => {
    if (!sessionsQuery.isFetching || !sessionsQuery.isPlaceholderData) {
      return sessionList;
    }
    return sessionList.filter((session) => matchesSessionFilters(session, filters));
  }, [sessionList, sessionsQuery.isFetching, sessionsQuery.isPlaceholderData, filters]);

  const displayedDrills = useMemo<VaultDrillLite[]>(() => {
    if (!sessionsQuery.isFetching || !sessionsQuery.isPlaceholderData) {
      return drills;
    }
    return deriveDrillsFromSessions(displayedSessions);
  }, [drills, displayedSessions, sessionsQuery.isFetching, sessionsQuery.isPlaceholderData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const syncFavorites = async () => {
        const sessionIds = displayedSessions.map((item) => item.id).filter(Boolean) as string[];
        const seriesIds = (seriesQuery.data || []).map((entry) => entry.seriesId).filter(Boolean);
        const drillIds = displayedDrills.map((item) => item.refCode || item.id).filter(Boolean);
        if (!sessionIds.length && !seriesIds.length && !drillIds.length) return;

        const payload = await checkFavorites({ sessionIds, seriesIds, drillIds });
        setFavoriteSessions(payload.sessions || {});
        setFavoriteDrills(payload.drills || {});
        setFavoriteSeries(payload.series || {});
      };

      syncFavorites().catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [displayedSessions, seriesQuery.data, displayedDrills]);

  const onLookup = async () => {
    const value = filters.search.trim();
    if (!value) {
      setLookupResult('Enter a ref code first.');
      return;
    }
    const result = await lookupRefCode(value);
    if (!result) {
      setLookupResult(`No item found for ${value.toUpperCase()}.`);
      return;
    }
    setLookupResult(`Found ${result.type.toUpperCase()} ${value.toUpperCase()}.`);
  };

  const onRefresh = async () => {
    await Promise.all([sessionsQuery.refetch(), seriesQuery.refetch(), calendarQuery.refetch()]);
  };

  const onLoadMoreSessions = () => {
    if (!isOnline) {
      return;
    }
    if (hasSearch) {
      return;
    }
    setOffset((current) => current + 20);
  };

  const toggleSession = async (id: string) => {
    const currently = Boolean(favoriteSessions[id]);
    setFavoriteSessions((s) => ({ ...s, [id]: !currently }));
    try {
      await toggleSessionFavorite(id, currently);
    } catch {
      setFavoriteSessions((s) => ({ ...s, [id]: currently }));
    }
  };

  const toggleSeries = async (id: string) => {
    const currently = Boolean(favoriteSeries[id]);
    setFavoriteSeries((s) => ({ ...s, [id]: !currently }));
    try {
      await toggleSeriesFavorite(id, currently);
    } catch {
      setFavoriteSeries((s) => ({ ...s, [id]: currently }));
    }
  };

  const toggleDrill = async (id: string) => {
    const currently = Boolean(favoriteDrills[id]);
    setFavoriteDrills((s) => ({ ...s, [id]: !currently }));
    try {
      await toggleDrillFavorite(id, currently);
    } catch {
      setFavoriteDrills((s) => ({ ...s, [id]: currently }));
    }
  };

  const isInitialLoading =
    (isOnline && sessionsQuery.isPending && !sessionsQuery.data && !sessionList.length) ||
    (activeTab === 'series' && seriesQuery.isPending && !seriesQuery.data);

  const isFilterUpdating =
    sessionsQuery.isFetching && Boolean(sessionsQuery.isPlaceholderData) && !sessionsQuery.isRefetching;

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={sessionsQuery.isRefetching && !sessionsQuery.isPlaceholderData}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Vault</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open favorites"
            hitSlop={8}
            onPress={() => router.push('/favorites')}
            style={styles.linkPress}
          >
            <Text style={styles.link}>Favorites</Text>
          </Pressable>
        </View>

        {!isOnline ? <CacheStaleIndicator updatedAt={cacheUpdatedAt} /> : null}

        <Tabs activeTab={activeTab} onChange={setActiveTab} />

        <VaultFilterBar
          search={filters.search}
          onSearchChange={(search) => {
            resetFiltersAndOffset({ search });
            setLookupResult(null);
          }}
          ageGroup={filters.ageGroup}
          onAgeGroupChange={(ageGroup) => resetFiltersAndOffset({ ageGroup })}
          gameModelId={filters.gameModelId}
          onGameModelIdChange={(gameModelId) => resetFiltersAndOffset({ gameModelId })}
          showGameModelFilter={showGameModelFilter}
          onRefLookup={() => void onLookup()}
          onClearFilters={() => {
            setOffset(0);
            clearFilters();
            setLookupResult(null);
          }}
        />

        {isFilterUpdating ? (
          <View style={styles.updatingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.updatingText}>Updating…</Text>
          </View>
        ) : null}

        {lookupResult ? <Text style={styles.lookupText}>{lookupResult}</Text> : null}

        {activeTab === 'sessions' ? (
          <View style={[styles.listWrap, isFilterUpdating ? styles.listUpdating : null]}>
            {displayedSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isFavorited={Boolean(favoriteSessions[session.id])}
                onToggleFavorite={() => void toggleSession(session.id)}
                showGameModel={showGameModelOnCards}
                calendarCount={sessionCalendarCounts[session.id] || 0}
                onPress={() =>
                  router.push({ pathname: '/vault/session/[sessionId]', params: { sessionId: session.id } })
                }
              />
            ))}
            {sessionsQuery.error ? (
              <Text style={styles.empty}>{describeApiError(sessionsQuery.error)}</Text>
            ) : null}
            {!displayedSessions.length && !isOnline ? <OfflineEmptyState /> : null}
            {!displayedSessions.length && isOnline && !isFilterUpdating ? (
              <Text style={styles.empty}>No sessions found.</Text>
            ) : null}
            {!hasSearch &&
            sessionsQuery.data &&
            !sessionsQuery.isPlaceholderData &&
            sessionList.length < (sessionsQuery.data.total || 0) ? (
              <Button title="Load More" onPress={onLoadMoreSessions} variant="secondary" />
            ) : null}
          </View>
        ) : null}

        {activeTab === 'series' ? (
          <View style={styles.listWrap}>
            {visibleSeries.map((entry) => (
              <SeriesCard
                key={entry.seriesId}
                series={entry}
                isFavorited={Boolean(favoriteSeries[entry.seriesId])}
                onToggleFavorite={() => void toggleSeries(entry.seriesId)}
                showGameModel={showGameModelOnCards}
                calendarCount={seriesCalendarStats.totalCounts[entry.seriesId] || 0}
                scheduledParts={seriesCalendarStats.scheduledParts[entry.seriesId] || 0}
                onPress={() =>
                  router.push({
                    pathname: '/vault/series/[seriesId]',
                    params: { seriesId: entry.seriesId },
                  })
                }
              />
            ))}
            {!visibleSeries.length ? <Text style={styles.empty}>No series found.</Text> : null}
          </View>
        ) : null}

        {activeTab === 'drills' ? (
          <View style={[styles.listWrap, isFilterUpdating ? styles.listUpdating : null]}>
            {displayedDrills.map((drill) => (
              <DrillCard
                key={drill.refCode}
                drill={drill}
                isFavorited={Boolean(favoriteDrills[drill.refCode])}
                onToggleFavorite={() => void toggleDrill(drill.refCode)}
              />
            ))}
            {!displayedDrills.length ? <Text style={styles.empty}>No drills found in cached sessions.</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    gap: 12,
    padding: 14,
    paddingBottom: 28,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  linkPress: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  tabs: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
  },
  tabText: {
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  lookupText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  updatingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  updatingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  listWrap: {
    gap: 10,
  },
  listUpdating: {
    opacity: 0.72,
  },
  empty: {
    color: colors.muted,
  },
});
