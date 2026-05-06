import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api, setToken } from '../api/client';

export default function SignupScreen({ route }) {
  const { inviteToken } = route?.params || {};
  const { login } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(!!inviteToken);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!inviteToken) return;
    api.getInvite(inviteToken)
      .then(setInvite)
      .catch(() => setInvite(null))
      .finally(() => setLoadingInvite(false));
  }, [inviteToken]);

  async function handleSignup() {
    setError(null);
    if (!firstName.trim()) return setError('First name is required');
    if (!email.trim()) return setError('Email is required');
    if (!password) return setError('Password is required');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    try {
      const result = await api.signup(
        email.trim().toLowerCase(),
        password,
        firstName.trim(),
        lastName.trim(),
        inviteToken || undefined,
      );
      await setToken(result.sessionId);
      // useAuth will pick up the new session via its own me() call on next render
      await login(email.trim().toLowerCase(), password);
    } catch(e) {
      setError(e.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const accentColor = invite?.primaryColor || '#c0392b';

  if (loadingInvite) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#c0392b" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.outer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.box}>
          {/* Header */}
          {invite ? (
            <View style={styles.inviteHeader}>
              <View style={[styles.inviteBadge, { backgroundColor: accentColor }]} />
              <Text style={styles.inviteTeamName}>{invite.teamName}</Text>
              <Text style={styles.inviteSub}>You've been invited to join</Text>
            </View>
          ) : (
            <Text style={styles.wordmark}>LINE<Text style={styles.wordmarkRed}>MATE</Text></Text>
          )}

          <Text style={[styles.title, invite && { color: accentColor }]}>
            {invite ? 'Create your account' : 'Sign Up'}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="First name"
              placeholderTextColor="#aaa"
              value={firstName}
              onChangeText={setFirstName}
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="Last name"
              placeholderTextColor="#aaa"
              value={lastName}
              onChangeText={setLastName}
              autoCorrect={false}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (8+ characters)"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSignup}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: accentColor }]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>
                  {invite ? `Join ${invite.teamName}` : 'Create Account'}
                </Text>}
          </TouchableOpacity>

          {invite && (
            <Text style={styles.hint}>
              After signing up you'll link your roster spot so we know who you are.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#f5f2ec' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  box: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Invite hero
  inviteHeader: { alignItems: 'center', marginBottom: 16 },
  inviteBadge: { width: 48, height: 48, borderRadius: 24, marginBottom: 10 },
  inviteTeamName: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  inviteSub: { fontSize: 13, color: '#888', marginTop: 4 },

  wordmark: { fontSize: 32, fontWeight: '900', color: '#1a1a1a', letterSpacing: 2, marginBottom: 8 },
  wordmarkRed: { color: '#c0392b' },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  error: { color: '#c0392b', fontSize: 13, textAlign: 'center', marginBottom: 12, letterSpacing: 0.3 },

  nameRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  nameInput: { flex: 1, marginBottom: 10 },
  input: {
    borderWidth: 2,
    borderColor: '#e0ddd8',
    borderRadius: 6,
    padding: 11,
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 10,
  },
  button: {
    borderRadius: 6,
    padding: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 14, lineHeight: 18 },
});
