import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Input } from '../components/ui/Input';
import { UsageBar } from '../components/dashboard/UsageBar';
import { WebOnlyNotice } from '../components/ui/WebOnlyNotice';
import { colors } from '../constants/colors';
import { webPath } from '../constants/web';
import { useAuth } from '../hooks/useAuth';
import { describeApiError } from '../services/api';
import { changePassword, getUsage } from '../services/auth.service';
import { openBillingPortal, openUpgradePricing } from '../services/billing.service';
import { formatPlanLabel, humanizeLabel } from '../utils/format';

function adminBadgeFor(role: string | null | undefined): { label: string; tone: 'amber' | 'muted' } | null {
  if (!role) return null;
  const upper = String(role).toUpperCase();
  if (upper === 'SUPER_ADMIN') return { label: 'Super admin', tone: 'amber' };
  if (upper === 'ADMIN') return { label: 'Admin', tone: 'amber' };
  if (upper === 'MODERATOR') return { label: 'Moderator', tone: 'muted' };
  if (upper === 'SUPPORT') return { label: 'Support', tone: 'muted' };
  return null;
}

type RowProps = {
  label: string;
  value?: string | null;
  hint?: string;
  onPress?: () => void;
  trailing?: string;
  danger?: boolean;
};

function Row({ label, value, hint, onPress, trailing, danger }: RowProps) {
  const interactive = Boolean(onPress);
  const content = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger ? styles.rowLabelDanger : null]}>{label}</Text>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {trailing ? <Text style={[styles.rowTrailing, danger ? styles.rowLabelDanger : null]}>{trailing}</Text> : null}
      {interactive ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );
  if (!interactive) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.rowPressed : null]}
    >
      {content}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, updateProfile, logout, isAuthenticated, isLoading, error, clearError } = useAuth();
  const usageQuery = useQuery({
    queryKey: ['usage'],
    queryFn: getUsage,
    enabled: isAuthenticated,
  });
  const sessionsUsed = usageQuery.data?.sessions.used || 0;
  const sessionsLimit = usageQuery.data?.sessions.limit || 0;
  const drillsUsed = usageQuery.data?.drills.used || 0;
  const drillsLimit = usageQuery.data?.drills.limit || 0;
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

  const adminBadge = adminBadgeFor(user?.adminRole);
  const planLabel = formatPlanLabel(user?.subscriptionPlan, user?.subscriptionStatus);
  const isLimitedPlan = planLabel.toLowerCase().includes('trial') || planLabel.toLowerCase().includes('free');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={usageQuery.isRefetching}
            onRefresh={() => usageQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Signed in as</Text>
          <Text style={styles.heroName} numberOfLines={2}>
            {user?.name || user?.email || 'Coach'}
          </Text>
          <Text style={styles.heroEmail} numberOfLines={1}>
            {user?.email || '—'}
          </Text>
          <View style={styles.badgeRow}>
            <Badge label={planLabel} />
            {user?.clubName ? <Badge label={user.clubName} /> : null}
            {adminBadge ? <Badge label={adminBadge.label} tone={adminBadge.tone} /> : null}
          </View>
        </View>

        {/* Usage */}
        <Section title="Usage this month">
          {usageQuery.data ? (
            <View style={styles.gap}>
              <UsageBar label="Sessions" used={sessionsUsed} limit={sessionsLimit} />
              <UsageBar label="Drills" used={drillsUsed} limit={drillsLimit} />
            </View>
          ) : usageQuery.isLoading ? (
            <View style={styles.skeletonGroup}>
              <View style={[styles.skeleton, { width: '90%' }]} />
              <View style={[styles.skeleton, { width: '70%' }]} />
            </View>
          ) : (
            <Row label="Usage will load once you're back online" />
          )}
          <View style={styles.divider} />
          <Row
            label="Manage billing"
            hint={isLimitedPlan ? 'Upgrade to unlock full feature set' : 'Update card, cancel, or download invoices'}
            onPress={() => void onManageBilling()}
          />
          <View style={styles.divider} />
          <Row label="Upgrade / pricing" onPress={() => void openUpgradePricing()} />
        </Section>

        {/* Profile */}
        <Section title="Profile">
          <View style={styles.formPad}>
            <Input label="Name" value={name} onChangeText={setName} placeholder="Coach name" />
            <Row label="Email" value={user?.email || '—'} />
            {user?.coachLevel ? (
              <Row label="Coach level" value={humanizeLabel(user.coachLevel)} />
            ) : null}
            {user?.enforcedGameModelId ? (
              <Row label="Club game model" value={humanizeLabel(user.enforcedGameModelId)} />
            ) : null}
          </View>
          <View style={styles.divider} />
          {error ? <ErrorMessage message={error} /> : null}
          <View style={styles.actionsRow}>
            <Button title="Save profile" onPress={onSave} loading={isLoading} variant="secondary" />
          </View>
        </Section>

        {/* Security */}
        <Section title="Security">
          <View style={styles.formPad}>
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
          </View>
          <View style={styles.divider} />
          <View style={styles.actionsRow}>
            <Button
              title="Update password"
              onPress={() => void onChangePassword()}
              loading={passwordBusy}
              variant="secondary"
            />
          </View>
        </Section>

        {/* Tools */}
        <Section title="Tools">
          <Row label="Coach Center" trailing="Sessions, teams, video" onPress={() => router.push('/coach-center')} />
          <View style={styles.divider} />
          <Row label="Tactical boards" onPress={() => router.push('/boards')} />
          <View style={styles.divider} />
          <Row label="Notification settings" onPress={() => router.push('/notifications')} />
          <View style={styles.divider} />
          <Row label="Open the web app" hint="Use Safari for Doc Hub & admin" onPress={() => void Linking.openURL(webPath('/app'))} />
        </Section>

        {/* Web-only notice */}
        <WebOnlyNotice
          title="Doc Hub & admin"
          body="Not available in the mobile app. Use the website for Doc Hub and platform admin."
          webHref="/doc-hub"
          ctaLabel="Open Doc Hub on web"
        />

        {billingError ? <ErrorMessage message={billingError} /> : null}

        {/* Danger */}
        <Section title="Account">
          <Row label="Sign out" danger onPress={() => void logout()} />
        </Section>
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
    gap: 24,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hero: {
    backgroundColor: '#172033',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  heroEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  heroEmail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: '#1c2740',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowLabelDanger: {
    color: colors.danger,
  },
  rowValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  rowHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  rowTrailing: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 140,
  },
  chevron: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  formPad: {
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionsRow: {
    padding: 12,
  },
  gap: {
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skeletonGroup: {
    gap: 8,
    padding: 14,
  },
  skeleton: {
    backgroundColor: '#1f2a3f',
    borderRadius: 6,
    height: 18,
  },
  status: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
