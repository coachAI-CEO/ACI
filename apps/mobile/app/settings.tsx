import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Input } from '../components/ui/Input';
import { WebOnlyNotice } from '../components/ui/WebOnlyNotice';
import { colors } from '../constants/colors';
import { webPath } from '../constants/web';
import { useAuth } from '../hooks/useAuth';
import { describeApiError } from '../services/api';
import { changePassword } from '../services/auth.service';
import { openBillingPortal, openUpgradePricing } from '../services/billing.service';
import { formatPlanLabel, humanizeLabel } from '../utils/format';

function limitLine(used?: number | null, max?: number | null, label?: string): string {
  if (max == null || max < 0) return `${label || 'Usage'}: Unlimited`;
  return `${label || 'Usage'}: ${used ?? 0} / ${max}`;
}

export default function SettingsScreen() {
  const { user, updateProfile, logout, isLoading, error, clearError } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  const onSave = async () => {
    clearError();
    await updateProfile({ name });
  };

  const onManageBilling = async () => {
    setBillingError(null);
    setBillingLoading(true);
    try {
      await openBillingPortal(webPath('/settings'));
    } catch (err) {
      const message = describeApiError(err);
      setBillingError(message);
      Alert.alert('Billing', message);
    } finally {
      setBillingLoading(false);
    }
  };

  const onChangePassword = async () => {
    setPasswordError(null);
    setPasswordStatus(null);
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('Password updated.');
    } catch (err) {
      setPasswordError(describeApiError(err, 'Could not change password.'));
    } finally {
      setPasswordBusy(false);
    }
  };

  const limits = user?.limits;
  const sessionsLimit = limits?.sessions?.limit;
  const drillsLimit = limits?.drills?.limit;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Profile, plan limits, and password</Text>
        </View>

        <Input label="Name" value={name} onChangeText={setName} placeholder="Coach name" />

        <View style={styles.readOnlyRow} accessibilityLabel={`Email ${user?.email || 'unavailable'}`}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '—'}</Text>
        </View>
        <View
          style={styles.readOnlyRow}
          accessibilityLabel={`Plan ${formatPlanLabel(user?.subscriptionPlan, user?.subscriptionStatus)}`}
        >
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>{formatPlanLabel(user?.subscriptionPlan, user?.subscriptionStatus)}</Text>
          <Text style={styles.hint}>
            {[
              limitLine(limits?.sessions?.used, sessionsLimit, 'Sessions'),
              limitLine(limits?.drills?.used, drillsLimit, 'Drills'),
            ].join(' · ')}
          </Text>
        </View>
        <View style={styles.readOnlyRow} accessibilityLabel={`Club ${user?.clubName || 'No club membership'}`}>
          <Text style={styles.label}>Club</Text>
          <Text style={styles.value}>{user?.clubName || 'No club membership'}</Text>
        </View>
        {user?.enforcedGameModelId ? (
          <View style={styles.readOnlyRow} accessibilityLabel={`Club game model ${humanizeLabel(user.enforcedGameModelId)}`}>
            <Text style={styles.label}>Club game model</Text>
            <Text style={styles.value}>{humanizeLabel(user.enforcedGameModelId)}</Text>
          </View>
        ) : null}
        {user?.coachLevel ? (
          <View style={styles.readOnlyRow} accessibilityLabel={`Coach level ${humanizeLabel(user.coachLevel)}`}>
            <Text style={styles.label}>Coach level</Text>
            <Text style={styles.value}>{humanizeLabel(user.coachLevel)}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change password</Text>
          <Input
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            secureTextEntry
          />
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            secureTextEntry
          />
          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            secureTextEntry
          />
          {passwordError ? <ErrorMessage message={passwordError} /> : null}
          {passwordStatus ? <Text style={styles.status}>{passwordStatus}</Text> : null}
          <Button title="Update password" onPress={() => void onChangePassword()} loading={passwordBusy} variant="secondary" />
        </View>

        {error ? <ErrorMessage message={error} /> : null}
        {billingError ? <ErrorMessage message={billingError} /> : null}

        <Button title="Save profile" onPress={onSave} loading={isLoading} />
        <Button title="Upgrade / pricing on web" onPress={() => void openUpgradePricing()} variant="secondary" />
        <Button title="Manage billing on web" onPress={() => void onManageBilling()} loading={billingLoading} variant="secondary" />
        <Button title="Coach Center" onPress={() => router.push('/coach-center')} variant="secondary" />
        <Button title="Boards" onPress={() => router.push('/boards')} variant="secondary" />
        <WebOnlyNotice
          title="Doc Hub & admin"
          body="Not available in the mobile app. Use the website for Doc Hub and platform admin."
          webHref="/doc-hub"
          ctaLabel="Open Doc Hub on web"
        />
        <Button title="Open web app" onPress={() => void Linking.openURL(webPath('/app'))} variant="secondary" />
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
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
