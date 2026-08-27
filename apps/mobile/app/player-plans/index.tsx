import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { describeApiError } from '../../services/api';
import { listPlayerPlans } from '../../services/player-plans.service';

export default function PlayerPlansScreen() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['player-plans'],
    queryFn: () => listPlayerPlans({ limit: 50 }),
    enabled: Boolean(user?.features?.canCreatePlayerPlans),
  });

  if (!user?.features?.canCreatePlayerPlans) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Player Plans</Text>
          <Text style={styles.subtitle}>Your plan does not include player plans.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error)} />
          <Button title="Retry" onPress={() => void query.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const plans = query.data?.plans || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Player Plans</Text>
        <Text style={styles.subtitle}>{plans.length} plans</Text>

        {plans.length ? (
          plans.map((plan) => (
            <View key={plan.id} style={styles.card}>
              <Text style={styles.ref}>{plan.refCode || plan.id}</Text>
              <Text style={styles.cardTitle}>{plan.title || 'Untitled plan'}</Text>
              <Text style={styles.meta}>
                {plan.ageGroup || '--'} · {plan.playerLevel || '--'} · {plan.durationMin || '--'} min · {plan.sourceType || '--'}
              </Text>
              <Button
                title="Open"
                onPress={() => router.push({ pathname: '/player-plans/[planId]', params: { planId: plan.id } })}
                variant="secondary"
              />
            </View>
          ))
        ) : (
          <Text style={styles.subtitle}>No player plans yet. Create one from a session result.</Text>
        )}
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
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  ref: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
});
