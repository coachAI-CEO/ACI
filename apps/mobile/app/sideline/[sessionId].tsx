import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { SidelineScreen } from '../../components/sideline/SidelineScreen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { describeApiError } from '../../services/api';
import {
  readCachedSessionById,
  writeSessionDetailCache,
} from '../../services/offline-cache.service';
import { getVaultSession } from '../../services/vault.service';
import { useGenerateStore } from '../../stores/generate.store';
import { useOfflineStore } from '../../stores/offline.store';
import { extractSessionDrills, sessionHasUsableDrills } from '../../utils/session-payload';

function goBackSafe() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)/vault');
}

export default function SidelineModeScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const latestSession = useGenerateStore((s) => s.latestSession) as any;
  const cachedSessions = useOfflineStore((s) => s.cachedSessions);
  const [confirmed, setConfirmed] = useState(false);
  const [cachedDetail, setCachedDetail] = useState<any | null>(null);

  const normalizedId = sessionId && sessionId !== 'latest' ? String(sessionId) : null;

  useEffect(() => {
    if (!normalizedId) return;
    readCachedSessionById(normalizedId, user?.id)
      .then((session) => setCachedDetail(session))
      .catch(() => undefined);
  }, [normalizedId, user?.id]);

  const remoteQuery = useQuery({
    queryKey: ['sideline', 'session', normalizedId],
    enabled: Boolean(normalizedId) && isOnline,
    queryFn: async () => {
      const session = await getVaultSession(String(normalizedId));
      await writeSessionDetailCache(session, user?.id);
      return session;
    },
    retry: 1,
  });

  const session = useMemo(() => {
    if (remoteQuery.data && sessionHasUsableDrills(remoteQuery.data)) {
      return remoteQuery.data;
    }
    if (cachedDetail && sessionHasUsableDrills(cachedDetail)) {
      return cachedDetail;
    }
    if (normalizedId) {
      const fromList = cachedSessions.find((item) => item.id === normalizedId);
      if (fromList && sessionHasUsableDrills(fromList)) return fromList;
    }
    if (latestSession && (!normalizedId || latestSession?.id === normalizedId || sessionId === 'latest')) {
      return latestSession;
    }
    return remoteQuery.data || cachedDetail || null;
  }, [remoteQuery.data, cachedDetail, cachedSessions, latestSession, normalizedId, sessionId]);

  const drills = useMemo(() => extractSessionDrills(session), [session]);

  useEffect(() => {
    if (confirmed || !session || !drills.length) return;

    Alert.alert(
      'Start Sideline Mode?',
      '• Screen stays on\n• Large text for easy reading\n• Swipe left/right to switch drills',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => goBackSafe() },
        { text: 'Start', onPress: () => setConfirmed(true) },
      ],
      { cancelable: false }
    );
  }, [confirmed, session, drills.length]);

  if (remoteQuery.isLoading && !session) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.text}>Loading session for practice…</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.text}>
          {remoteQuery.error
            ? describeApiError(remoteQuery.error, 'No session available for sideline mode.')
            : isOnline
              ? 'No session available for sideline mode.'
              : 'Session is not cached offline. Open it once while online, then retry.'}
        </Text>
        <Button title="Go back" onPress={goBackSafe} variant="secondary" />
      </SafeAreaView>
    );
  }

  if (!drills.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.text}>This session has no drills to run in sideline mode.</Text>
        <Button title="Go back" onPress={goBackSafe} variant="secondary" />
      </SafeAreaView>
    );
  }

  if (!confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.text}>Preparing sideline mode…</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fill}>
      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline · using cached session</Text>
        </View>
      ) : null}
      <SidelineScreen session={session} drills={drills} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 20,
  },
  fill: {
    backgroundColor: '#000',
    flex: 1,
  },
  text: {
    color: colors.text,
    textAlign: 'center',
  },
  offlineBanner: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offlineText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
