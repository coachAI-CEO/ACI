import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { SidelineScreen } from '../../components/sideline/SidelineScreen';
import { colors } from '../../constants/colors';
import { useGenerateStore } from '../../stores/generate.store';
import { useOfflineStore } from '../../stores/offline.store';

export default function SidelineModeScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const latestSession = useGenerateStore((s) => s.latestSession) as any;
  const cachedSessions = useOfflineStore((s) => s.cachedSessions);

  const session = useMemo(() => {
    if (sessionId) {
      const fromCache = cachedSessions.find((item) => item.id === sessionId);
      if (fromCache) return fromCache;
    }
    return latestSession;
  }, [sessionId, cachedSessions, latestSession]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.text}>No session available for sideline mode.</Text>
      </SafeAreaView>
    );
  }

  return <SidelineScreen session={session} />;
}

const styles = StyleSheet.create({
  safe: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    color: colors.text,
  },
});
