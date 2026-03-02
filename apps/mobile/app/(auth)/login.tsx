import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Input } from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const onSubmit = async () => {
    clearError();
    setEmailError(undefined);
    setPasswordError(undefined);

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    await login(email, password);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to TacticalEdge Mobile</Text>
          </View>

          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="coach@club.com"
            value={email}
            error={emailError}
          />
          <Input
            autoCapitalize="none"
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
            value={password}
            error={passwordError}
          />

          {error ? <ErrorMessage message={error} /> : null}

          <Button title="Sign In" onPress={onSubmit} loading={isLoading} />

          <Link href="/(auth)/forgot-password" style={styles.link}>
            Forgot password?
          </Link>

          <Link href="/(auth)/register" style={styles.link}>
            Create account
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
    gap: 16,
    padding: 20,
  },
  header: {
    marginBottom: 6,
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
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
