import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { resendVerification } from '../../services/auth.service';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { refreshCurrentUser } = useAuth();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const onResend = async () => {
    setError(null);
    setMessage(null);
    setIsResending(true);
    try {
      await resendVerification();
      setMessage('Verification email sent.');
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((current) => {
          if (current <= 1) {
            clearInterval(interval);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch (err) {
      setError((err as { message?: string }).message || 'Could not resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const onContinue = async () => {
    setError(null);
    setMessage(null);
    setIsChecking(true);
    try {
      await refreshCurrentUser();
      setMessage('Email verified.');
    } catch (err) {
      setError((err as { message?: string }).message || 'Email not verified yet.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.body}>We sent a verification link to {email || 'your inbox'}.</Text>

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <ErrorMessage message={error} /> : null}

        <Button
          title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Email'}
          onPress={onResend}
          disabled={cooldown > 0}
          loading={isResending}
          variant="secondary"
        />

        <Button title="I've verified, continue" onPress={onContinue} loading={isChecking} />
      </View>
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
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  success: {
    color: colors.primary,
    fontWeight: '600',
  },
});
