import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { api, BASE_URL } from '../api/client';
import { useAuth } from '../hooks/useAuth';

function isAdmin(user) {
  return user && (user.role === 'superadmin' || user.role === 'admin');
}

export default function TeamPickerScreen({ navigation }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.teams().then(data => {
      const seen = new Set();
      setTeams(data.filter(t => seen.has(t.id) ? false : seen.add(t.id)));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#c0392b" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>My Teams</Text>
        {isAdmin(user) && (
          <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('Admin')}>
            <Text style={styles.adminBtnText}>Admin</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={teams}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderLeftColor: item.primaryColor || '#c0392b' }]}
            onPress={() => navigation.navigate('Team', { teamId: item.id, teamName: item.name, primaryColor: item.primaryColor })}
          >
            <Image
              source={{ uri: `${BASE_URL}/${item.id}/logo/main` }}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.cardText}>
              <Text style={styles.teamName}>{item.name}</Text>
              {item.division && <Text style={styles.division}>{item.division}</Text>}
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 2 },
  adminBtn: { backgroundColor: '#1a1a1a', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  adminBtnText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 4, padding: 16, marginBottom: 8, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 48, height: 48 },
  cardText: { flex: 1 },
  teamName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 1 },
  division: { fontSize: 12, color: '#888', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
});
