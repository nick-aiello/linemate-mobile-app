import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api/client';

function GameCard({ game, primaryColor }) {
  const isPast = game.isPast;
  return (
    <View style={[styles.card, isPast && styles.cardPast]}>
      <View style={styles.dateCol}>
        <Text style={styles.date}>{formatDate(game.date)}</Text>
        <Text style={styles.time}>{game.time || ''}</Text>
      </View>
      <View style={styles.infoCol}>
        <Text style={styles.opponent} numberOfLines={1}>
          {game.isHome ? 'vs ' : '@ '}{game.opponent}
        </Text>
        {game.rink && <Text style={styles.rink} numberOfLines={1}>{game.rink}</Text>}
      </View>
      {game.result && (
        <View style={[styles.result, game.result === 'W' ? styles.resultW : game.result === 'L' ? styles.resultL : styles.resultT]}>
          <Text style={styles.resultText}>{game.result}</Text>
          {game.score && <Text style={styles.score}>{game.score}</Text>}
        </View>
      )}
    </View>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ScheduleScreen({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.schedule(teamId);
      setSchedule(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;
  if (!schedule.length) return <View style={styles.center}><Text style={styles.empty}>No schedule available.</Text></View>;

  return (
    <FlatList
      data={schedule}
      keyExtractor={(g, i) => g.date + g.opponent + i}
      renderItem={({ item }) => <GameCard game={item} primaryColor={primaryColor} />}
      contentContainerStyle={styles.list}
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#999', fontSize: 16 },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardPast: { opacity: 0.6 },
  dateCol: { width: 52, marginRight: 12 },
  date: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  time: { fontSize: 12, color: '#666', marginTop: 1 },
  infoCol: { flex: 1 },
  opponent: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  rink: { fontSize: 12, color: '#666', marginTop: 2 },
  result: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  resultW: { backgroundColor: '#e8f5e9' },
  resultL: { backgroundColor: '#fce4ec' },
  resultT: { backgroundColor: '#f5f5f5' },
  resultText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  score: { fontSize: 11, color: '#666', marginTop: 1 },
});
