import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Input } from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterScreen() {
  const { register, isLoading, error, clearError } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    clearError();
    setLocalError(null);

    if (name.trim().length < 2) {
      setLocalError('Name must be at least 2 characters.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setLocalError('Enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    await register(name, email, password);
    router.push({ pathname: '/(auth)/verify-email', params: { email } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Start building smarter sessions</Text>
          </View>

          <Input label="Full name" value={name} onChangeText={setName} placeholder="Coach Name" />
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="coach@club.com"
          />
          <Input
            autoCapitalize="none"
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Min 8 characters"
            secureTextEntry
          />
          <Input
            autoCapitalize="none"
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            secureTextEntry
          />

          {localError ? <ErrorMessage message={localError} /> : null}
          {error ? <ErrorMessage message={error} /> : null}

          <Button title="Create Account" onPress={onSubmit} loading={isLoading} />

          <Link href="/(auth)/login" style={styles.link}>
            Back to sign in
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    gap: 14,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
