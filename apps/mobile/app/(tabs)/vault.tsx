import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CacheStaleIndicator } from '../../components/offline/CacheStaleIndicator';
import { OfflineEmptyState } from '../../components/offline/OfflineEmptyState';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SessionCard, SeriesCard, DrillCard } from '../../components/vault/VaultCards';
import { VaultFilterBar } from '../../components/vault/VaultFilterBar';
import { colors } from '../../constants/colors';
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
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineVault } from '../../hooks/useOfflineVault';
import { useVaultStore } from '../../stores/vault.store';

function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Tabs({ activeTab, onChange }: { activeTab: 'sessions' | 'series' | 'drills'; onChange: (tab: 'sessions' | 'series' | 'drills') => void }) {
  return (
    <View style={styles.tabs}>
      {(['sessions', 'series', 'drills'] as const).map((tab) => (
        <Text key={tab} onPress={() => onChange(tab)} style={[styles.tab, activeTab === tab ? styles.tabActive : null]}>
          {tab.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

export default function VaultTab() {
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

  const debouncedSearch = useDebouncedValue(filters.search, 400);
  const hasSearch = debouncedSearch.trim().length > 0;

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, filters.ageGroup, filters.gameModelId, filters.phase, filters.zone]);

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
  });

  const seriesQuery = useQuery({
    queryKey: ['vault', 'series'],
    queryFn: getVaultSeries,
    enabled: activeTab === 'series' && isOnline,
  });

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
    writeVaultSessionsCache(sessionList).catch(() => undefined);
  }, [sessionList, isOnline]);

  useEffect(() => {
    if (isOnline) {
      return;
    }
    readVaultSessionsCache()
      .then((payload) => {
        if (!payload) return;
        setSessionList(payload.sessions || []);
      })
      .catch(() => undefined);
  }, [isOnline]);

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

  useEffect(() => {
    const syncFavorites = async () => {
      const sessionIds = sessionList.map((item) => item.id).filter(Boolean) as string[];
      const seriesIds = (seriesQuery.data || []).map((entry) => entry.seriesId).filter(Boolean);
      const drillIds = drills.map((item) => item.refCode || item.id).filter(Boolean);

      const payload = await checkFavorites({ sessionIds, seriesIds, drillIds });
      setFavoriteSessions(payload.sessions || {});
      setFavoriteDrills(payload.drills || {});
      setFavoriteSeries(payload.series || {});
    };

    syncFavorites().catch(() => undefined);
  }, [sessionList, seriesQuery.data, drills]);

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
    await Promise.all([sessionsQuery.refetch(), seriesQuery.refetch()]);
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

  const isLoading = sessionsQuery.isLoading || (activeTab === 'series' && seriesQuery.isLoading);

  if (isLoading) {
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
        refreshControl={<RefreshControl refreshing={sessionsQuery.isRefetching || seriesQuery.isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Vault</Text>
          <Text style={styles.link} onPress={() => router.push('/favorites')}>
            Favorites
          </Text>
        </View>

        {!isOnline ? <CacheStaleIndicator updatedAt={cacheUpdatedAt} /> : null}

        <Tabs activeTab={activeTab} onChange={setActiveTab} />

        <VaultFilterBar
          search={filters.search}
          onSearchChange={(search) => patchFilters({ search })}
          ageGroup={filters.ageGroup}
          onAgeGroupChange={(ageGroup) => patchFilters({ ageGroup })}
          gameModelId={filters.gameModelId}
          onGameModelIdChange={(gameModelId) => patchFilters({ gameModelId })}
        />

        <View style={styles.actionRow}>
          <Button title="Ref Lookup" onPress={() => void onLookup()} variant="secondary" />
          <Button title="Clear Filters" onPress={clearFilters} variant="secondary" />
        </View>

        {lookupResult ? <Text style={styles.lookupText}>{lookupResult}</Text> : null}

        {activeTab === 'sessions' ? (
          <View style={styles.listWrap}>
            {sessionList.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isFavorited={Boolean(favoriteSessions[session.id])}
                onToggleFavorite={() => void toggleSession(session.id)}
              />
            ))}
            {!sessionList.length && !isOnline ? <OfflineEmptyState /> : null}
            {!sessionList.length && isOnline ? <Text style={styles.empty}>No sessions found.</Text> : null}
            {!hasSearch && sessionsQuery.data && sessionList.length < (sessionsQuery.data.total || 0) ? (
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
              />
            ))}
            {!visibleSeries.length ? <Text style={styles.empty}>No series found.</Text> : null}
          </View>
        ) : null}

        {activeTab === 'drills' ? (
          <View style={styles.listWrap}>
            {drills.map((drill) => (
              <DrillCard
                key={drill.refCode}
                drill={drill}
                isFavorited={Boolean(favoriteDrills[drill.refCode])}
                onToggleFavorite={() => void toggleDrill(drill.refCode)}
              />
            ))}
            {!drills.length ? <Text style={styles.empty}>No drills found in cached sessions.</Text> : null}
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
  tabs: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    color: colors.muted,
    flex: 1,
    paddingVertical: 10,
    textAlign: 'center',
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lookupText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  listWrap: {
    gap: 10,
  },
  empty: {
    color: colors.muted,
  },
});
