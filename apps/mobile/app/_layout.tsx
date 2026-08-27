import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NetworkBanner } from '../components/offline/NetworkBanner';
import { colors } from '../constants/colors';
import { useOfflineVaultSync } from '../hooks/useOfflineVaultSync';
import { useOfflineBoardsSync } from '../hooks/useOfflineBoardsSync';
import { useReminderSync } from '../hooks/useReminderSync';
import { useAuthStore } from '../stores/auth.store';

const stackHeader = {
  headerShown: true as const,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
  headerShadowVisible: false,
  // Show a visible text label next to the chevron so the back affordance is
  // obvious on small phone screens where the bare "<" can be hard to spot.
  headerBackTitle: 'Back',
  headerBackTitleVisible: true,
};

void SplashScreen.preventAutoHideAsync();

function AppEffects() {
  useOfflineVaultSync();
  useOfflineBoardsSync();
  useReminderSync();
  return null;
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  const queryClient = useMemo(() => new QueryClient(), []);

  useEffect(() => {
    bootstrap().catch(() => undefined);
  }, [bootstrap]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isBootstrapping, segments, router]);

  useEffect(() => {
    if (!isBootstrapping) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [isBootstrapping]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppEffects />
        <NetworkBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="favorites" options={{ ...stackHeader, title: 'Favorites' }} />
          <Stack.Screen name="notifications/index" options={{ ...stackHeader, title: 'Notifications' }} />
          <Stack.Screen name="session/result" options={{ ...stackHeader, title: 'Session Result' }} />
          <Stack.Screen name="session/drill/[drillId]" options={{ ...stackHeader, title: 'Drill Detail' }} />
          <Stack.Screen name="session/drill/result" options={{ ...stackHeader, title: 'Drill Result' }} />
          <Stack.Screen name="series/result" options={{ ...stackHeader, title: 'Series Result' }} />
          <Stack.Screen name="video/result" options={{ ...stackHeader, title: 'Video Result' }} />
          <Stack.Screen name="vault/session/[sessionId]" options={{ ...stackHeader, title: 'Vault Session' }} />
          <Stack.Screen name="vault/series/[seriesId]" options={{ ...stackHeader, title: 'Series' }} />
          <Stack.Screen name="player-plans/index" options={{ ...stackHeader, title: 'Player Plans' }} />
          <Stack.Screen name="player-plans/[planId]" options={{ ...stackHeader, title: 'Player Plan' }} />
          <Stack.Screen name="coach-center/index" options={{ ...stackHeader, title: 'Coach Center' }} />
          <Stack.Screen name="coach-center/[teamId]/index" options={{ ...stackHeader, title: 'Team' }} />
          <Stack.Screen name="coach-center/[teamId]/curriculum" options={{ ...stackHeader, title: 'Curriculum' }} />
          <Stack.Screen name="coach-center/[teamId]/week" options={{ ...stackHeader, title: 'Team Week' }} />
          <Stack.Screen name="coach-center/[teamId]/next-sessions" options={{ ...stackHeader, title: 'Next Sessions' }} />
          <Stack.Screen name="coach-center/[teamId]/game-days/index" options={{ ...stackHeader, title: 'Game Days' }} />
          <Stack.Screen name="coach-center/[teamId]/chat" options={{ ...stackHeader, title: 'Season Chat' }} />
          <Stack.Screen
            name="coach-center/[teamId]/game-days/[gameDayId]"
            options={{ ...stackHeader, title: 'Game Day' }}
          />
          <Stack.Screen name="boards/index" options={{ ...stackHeader, title: 'Boards' }} />
          <Stack.Screen
            name="boards/[id]"
            options={{ ...stackHeader, title: 'Board', orientation: 'all' }}
          />
          <Stack.Screen
            name="boards/[id]/edit"
            options={{
              ...stackHeader,
              title: 'Edit board',
              // Screen sets its own undo/redo · Save · ⋯ chrome.
              headerBackVisible: false,
              // Portrait → vertical pitch; landscape → horizontal pitch.
              orientation: 'all',
            }}
          />
          <Stack.Screen name="sideline/[sessionId]" />
          <Stack.Screen name="settings" options={{ ...stackHeader, title: 'Settings', headerBackTitle: 'Home' }} />
        </Stack>
      </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
