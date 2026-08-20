import { Link } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Input } from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { forgotPassword } from '../../services/auth.service';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setMessage(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setMessage('If that email exists, we sent a reset link.');
    } catch (err) {
      setError((err as { message?: string }).message || 'Could not request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.body}>Enter your account email to receive a reset link.</Text>

        <Input
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="coach@club.com"
        />

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <ErrorMessage message={error} /> : null}

        <Button title="Send Reset Link" onPress={onSubmit} loading={isLoading} />

        <Link href="/(auth)/login" style={styles.link}>
          Back to sign in
        </Link>
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
    lineHeight: 22,
  },
  success: {
    color: colors.primary,
    fontWeight: '600',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
