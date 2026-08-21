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
  sub?: string;
  onPress?: () => void;
  showChevron?: boolean;
  compact?: boolean;
  danger?: boolean;
};

function Row({ label, value, sub, onPress, showChevron = true, compact, danger }: RowProps) {
  const interactive = Boolean(onPress);
  const content = (
    <View style={[styles.row, compact ? styles.rowCompact : null]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger ? styles.rowLabelDanger : null]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.rowTrailing} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron && interactive ? <Text style={styles.chevron}>›</Text> : null}
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

  const heroSub = [user?.email, user?.clubName, planLabel].filter(Boolean).join(' · ');

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
        {/* Hero: name + role on top row, contact line below */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroText}>
              <Text style={styles.heroEyebrow}>Signed in as</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {user?.name || user?.email || 'Coach'}
              </Text>
            </View>
            {adminBadge ? <Badge label={adminBadge.label} tone={adminBadge.tone} /> : null}
          </View>
          <Text style={styles.heroSub} numberOfLines={1}>
            {heroSub || '—'}
          </Text>
        </View>

        {/* Account */}
        <Section title="Account">
          <View style={styles.formPad}>
            <Input label="Name" value={name} onChangeText={setName} placeholder="Coach name" />
          </View>
          <View style={styles.divider} />
          <Row compact label="Email" value={user?.email || '—'} showChevron={false} />
          {user?.coachLevel ? (
            <>
              <View style={styles.divider} />
              <Row
                compact
                label="Coach level"
                value={humanizeLabel(user.coachLevel)}
                showChevron={false}
              />
            </>
          ) : null}
          {user?.enforcedGameModelId ? (
            <>
              <View style={styles.divider} />
              <Row
                compact
                label="Club game model"
                value={humanizeLabel(user.enforcedGameModelId)}
                showChevron={false}
              />
            </>
          ) : null}
          {error ? (
            <View style={styles.errorWrap}>
              <ErrorMessage message={error} />
            </View>
          ) : null}
          <View style={styles.actionsRow}>
            <Button title="Save profile" onPress={onSave} loading={isLoading} variant="secondary" />
          </View>
        </Section>

        {/* Plan + usage in one card */}
        <Section title="Plan & usage">
          <View style={styles.usageGrid}>
            <View style={styles.usageCell}>
              <UsageBar label="Sessions" used={sessionsUsed} limit={sessionsLimit} />
            </View>
            <View style={styles.usageCell}>
              <UsageBar label="Drills" used={drillsUsed} limit={drillsLimit} />
            </View>
          </View>
          <View style={styles.divider} />
          <Row
            label="Manage billing"
            sub={isLimitedPlan ? 'Upgrade to unlock the full feature set' : 'Card · cancel · invoices'}
            onPress={() => void onManageBilling()}
          />
          <View style={styles.divider} />
          <Row label="Upgrade / pricing" onPress={() => void openUpgradePricing()} />
          {billingError ? (
            <View style={styles.errorWrap}>
              <ErrorMessage message={billingError} />
            </View>
          ) : null}
        </Section>

        {/* Security: 2-col input grid */}
        <Section title="Security">
          <View style={styles.formGrid}>
            <View style={styles.formFull}>
              <Input
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                secureTextEntry
              />
            </View>
            <View style={styles.formHalf}>
              <Input
                label="New"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8"
                secureTextEntry
              />
            </View>
            <View style={styles.formHalf}>
              <Input
                label="Confirm"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat"
                secureTextEntry
              />
            </View>
          </View>
          {passwordError ? (
            <View style={styles.errorWrap}>
              <ErrorMessage message={passwordError} />
            </View>
          ) : null}
          {passwordStatus ? <Text style={styles.status}>{passwordStatus}</Text> : null}
          <View style={styles.actionsRow}>
            <Button title="Save password" onPress={() => void onChangePassword()} loading={passwordBusy} />
          </View>
        </Section>

        {/* Tools: 2x2 grid */}
        <Section title="Tools">
          <View style={styles.toolsGrid}>
            <Row compact label="Coach Center" sub="Sessions · teams" onPress={() => router.push('/coach-center')} />
            <Row compact label="Boards" sub="Plays" onPress={() => router.push('/boards')} />
            <Row compact label="Notifications" onPress={() => router.push('/notifications')} />
            <Row
              compact
              label="Web app"
              sub="Doc Hub · admin"
              onPress={() => void Linking.openURL(webPath('/app'))}
            />
          </View>
        </Section>

        {/* Inline notice */}
        <WebOnlyNotice
          compact
          title="Doc Hub & admin — web only"
          body="Use Safari for full authoring tools."
          webHref="/doc-hub"
          ctaLabel="Open"
        />

        {/* Sign out */}
        <View style={styles.signOutWrap}>
          <Button title="Sign out" onPress={() => void logout()} variant="danger" />
        </View>
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
    gap: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  hero: {
    backgroundColor: '#172033',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  heroText: { flex: 1, gap: 2, minWidth: 0 },
  heroEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  heroSub: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  section: { gap: 2 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowCompact: {
    minHeight: 32,
    paddingVertical: 6,
  },
  rowPressed: { backgroundColor: '#1c2740' },
  rowText: { flex: 1, gap: 1, minWidth: 0 },
  rowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowLabelDanger: { color: colors.danger },
  rowSub: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  rowTrailing: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 130,
    textAlign: 'right',
  },
  chevron: {
    color: '#4b5b7a',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 18,
  },
  divider: {
    backgroundColor: '#162033',
    height: StyleSheet.hairlineWidth,
    marginLeft: 12,
  },
  formPad: {
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  formFull: { width: '100%' },
  formHalf: { flexBasis: '48%', flexGrow: 1 },
  usageGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  usageCell: { flex: 1 },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionsRow: { padding: 8 },
  signOutWrap: { paddingHorizontal: 4, paddingTop: 4 },
  errorWrap: { paddingHorizontal: 10, paddingVertical: 6 },
  status: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
