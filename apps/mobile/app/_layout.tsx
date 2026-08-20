import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NetworkBanner } from '../components/offline/NetworkBanner';
import { useOfflineVaultSync } from '../hooks/useOfflineVaultSync';
import { useReminderSync } from '../hooks/useReminderSync';
import { useAuthStore } from '../stores/auth.store';

void SplashScreen.preventAutoHideAsync();

function AppEffects() {
  useOfflineVaultSync();
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
      <QueryClientProvider client={queryClient}>
        <AppEffects />
        <NetworkBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="favorites" options={{ headerShown: true, title: 'Favorites' }} />
          <Stack.Screen name="notifications/index" options={{ headerShown: true, title: 'Notifications' }} />
          <Stack.Screen name="session/result" options={{ headerShown: true, title: 'Session Result' }} />
          <Stack.Screen name="session/drill/[drillId]" options={{ headerShown: true, title: 'Drill Detail' }} />
          <Stack.Screen name="session/drill/result" options={{ headerShown: true, title: 'Drill Result' }} />
          <Stack.Screen name="series/result" options={{ headerShown: true, title: 'Series Result' }} />
          <Stack.Screen name="video/result" options={{ headerShown: true, title: 'Video Result' }} />
          <Stack.Screen name="vault/session/[sessionId]" options={{ headerShown: true, title: 'Vault Session' }} />
          <Stack.Screen name="player-plans/index" options={{ headerShown: true, title: 'Player Plans' }} />
          <Stack.Screen name="player-plans/[planId]" options={{ headerShown: true, title: 'Player Plan' }} />
          <Stack.Screen name="coach-center/index" options={{ headerShown: true, title: 'Coach Center' }} />
          <Stack.Screen name="coach-center/[teamId]/index" options={{ headerShown: true, title: 'Team' }} />
          <Stack.Screen name="coach-center/[teamId]/week" options={{ headerShown: true, title: 'Team Week' }} />
          <Stack.Screen name="coach-center/[teamId]/game-days/index" options={{ headerShown: true, title: 'Game Days' }} />
          <Stack.Screen
            name="coach-center/[teamId]/game-days/[gameDayId]"
            options={{ headerShown: true, title: 'Game Day' }}
          />
          <Stack.Screen name="boards/index" options={{ headerShown: true, title: 'Boards' }} />
          <Stack.Screen name="boards/[id]" options={{ headerShown: true, title: 'Board' }} />
          <Stack.Screen name="sideline/[sessionId]" />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
