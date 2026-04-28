import { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

function PrefRow({ label, value, onChange }) {
  return (
    <View style={styles.prefRow}>
      <Text style={styles.prefLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#c0392b' }} />
    </View>
  );
}

export default function SettingsScreen({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const { user, logout } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getNotificationPrefs(teamId).then(setPrefs).catch(() => {});
  }, [teamId]);

  async function updatePref(key, value) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    await api.setNotificationPrefs(teamId, updated).catch(() => {});
    setSaving(false);
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.name}>{user?.displayName || user?.email || 'Unknown'}</Text>
          {user?.email && <Text style={styles.email}>{user.email}</Text>}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Notifications {saving && <ActivityIndicator size="small" color="#999" />}</Text>
        <View style={styles.card}>
          {prefs ? (
            <>
              <PrefRow label="Lineup set" value={prefs.lineupSet} onChange={(v) => updatePref('lineupSet', v)} />
              <View style={styles.divider} />
              <PrefRow label="Game reminders" value={prefs.gameReminder} onChange={(v) => updatePref('gameReminder', v)} />
              <View style={styles.divider} />
              <PrefRow label="Chat messages" value={prefs.chatMessages} onChange={(v) => updatePref('chatMessages', v)} />
            </>
          ) : (
            <ActivityIndicator color={primaryColor} />
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  name: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  prefLabel: { fontSize: 15, color: '#1a1a1a' },
  divider: { height: 1, backgroundColor: '#f0ede8', marginVertical: 4 },
  signOutButton: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e0ddd8' },
  signOutText: { color: '#c0392b', fontSize: 16, fontWeight: '600' },
});
