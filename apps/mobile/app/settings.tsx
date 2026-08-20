import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Input } from '../components/ui/Input';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { describeApiError } from '../services/api';
import { openBillingPortal } from '../services/billing.service';

export default function SettingsScreen() {
  const { user, updateProfile, logout, isLoading, error, clearError } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const onSave = async () => {
    clearError();
    await updateProfile({ name });
  };

  const onManageBilling = async () => {
    setBillingError(null);
    setBillingLoading(true);
    try {
      await openBillingPortal('https://tacticaledge.app/settings');
    } catch (err) {
      const message = describeApiError(err);
      setBillingError(message);
      Alert.alert('Billing', message);
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Profile and account</Text>
        </View>

        <Input label="Name" value={name} onChangeText={setName} placeholder="Coach name" />

        <View style={styles.readOnlyRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '--'}</Text>
        </View>
        <View style={styles.readOnlyRow}>
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>
            {user?.subscriptionPlan || '--'} · {user?.subscriptionStatus || 'unknown'}
          </Text>
        </View>
        <View style={styles.readOnlyRow}>
          <Text style={styles.label}>Club</Text>
          <Text style={styles.value}>{user?.clubName || 'No club membership'}</Text>
        </View>
        {user?.enforcedGameModelId ? (
          <View style={styles.readOnlyRow}>
            <Text style={styles.label}>Club game model</Text>
            <Text style={styles.value}>{user.enforcedGameModelId}</Text>
          </View>
        ) : null}
        {user?.coachLevel ? (
          <View style={styles.readOnlyRow}>
            <Text style={styles.label}>Coach level</Text>
            <Text style={styles.value}>{user.coachLevel}</Text>
          </View>
        ) : null}

        {error ? <ErrorMessage message={error} /> : null}
        {billingError ? <ErrorMessage message={billingError} /> : null}

        <Button title="Save profile" onPress={onSave} loading={isLoading} />
        <Button title="Coach Center" onPress={() => router.push('/coach-center')} variant="secondary" />
        <Button title="Boards" onPress={() => router.push('/boards')} variant="secondary" />
        <Button title="Manage billing on web" onPress={() => void onManageBilling()} loading={billingLoading} variant="secondary" />
        <Button
          title="Open web app"
          onPress={() => void Linking.openURL('https://tacticaledge.app/app')}
          variant="secondary"
        />
        <Button title="Notification settings" onPress={() => router.push('/notifications')} variant="secondary" />
        <Button title="Sign out" onPress={logout} variant="danger" />
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
    gap: 16,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
  },
  readOnlyRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
});
