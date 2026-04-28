import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api/client';

export default function TeamPickerScreen({ navigation }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.teams().then(setTeams).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#c0392b" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Teams</Text>
      <FlatList
        data={teams}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderLeftColor: item.primaryColor || '#c0392b' }]}
            onPress={() => navigation.navigate('Team', { teamId: item.id, teamName: item.name, primaryColor: item.primaryColor })}
          >
            <Text style={styles.teamName}>{item.name}</Text>
            {item.division && <Text style={styles.division}>{item.division}</Text>}
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
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', padding: 20, paddingBottom: 12 },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  teamName: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  division: { fontSize: 14, color: '#666', marginTop: 2 },
});
