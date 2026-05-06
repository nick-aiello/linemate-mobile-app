import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api/client';

function StatRow({ player, rank, primaryColor }) {
  const isHot = player.gp >= 3 && player.pts >= player.gp;
  const ppg = player.gp > 0 ? (player.pts / player.gp).toFixed(2) : '—';
  return (
    <View style={styles.row}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.nameCol}>
        {player.num ? <Text style={[styles.num, { color: primaryColor }]}>{player.num}</Text> : null}
        <Text style={styles.name} numberOfLines={1}>{player.name}{isHot ? ' 🔥' : ''}</Text>
      </View>
      <Text style={styles.stat}>{player.gp}</Text>
      <Text style={styles.stat}>{player.g}</Text>
      <Text style={styles.stat}>{player.a}</Text>
      <Text style={[styles.stat, styles.pts, { color: primaryColor }]}>{player.pts}</Text>
      <Text style={styles.stat}>{ppg}</Text>
    </View>
  );
}

export default function StatsScreen({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const [playerStats, setPlayerStats] = useState([]);
  const [syncedAt, setSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.stats(teamId);
      const sorted = (data.playerStats || []).slice().sort((a, b) => b.pts - a.pts || b.g - a.g);
      setPlayerStats(sorted);
      setSyncedAt(data.syncedAt || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;

  return (
    <FlatList
      data={playerStats}
      keyExtractor={(p, i) => p.name + i}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
      ListHeaderComponent={
        <View style={[styles.header, { backgroundColor: primaryColor }]}>
          <Text style={styles.headerRank}>#</Text>
          <Text style={styles.headerName}>Player</Text>
          <Text style={styles.headerStat}>GP</Text>
          <Text style={styles.headerStat}>G</Text>
          <Text style={styles.headerStat}>A</Text>
          <Text style={styles.headerStat}>PTS</Text>
          <Text style={styles.headerStat}>P/GP</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No stats yet.{'\n'}Sync from ChillerStats in Settings.</Text>
        </View>
      }
      renderItem={({ item, index }) => <StatRow player={item} rank={index + 1} primaryColor={primaryColor} />}
      ListFooterComponent={
        syncedAt ? <Text style={styles.synced}>Last synced {new Date(syncedAt).toLocaleDateString()}</Text> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 32 },

  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 4, marginBottom: 2 },
  headerRank: { width: 24, fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  headerName: { flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  headerStat: { width: 36, fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f0ede8' },
  rank: { width: 24, fontSize: 11, color: '#bbb', textAlign: 'left' },
  nameCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  num: { fontSize: 11, minWidth: 22 },
  name: { fontSize: 13, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 },
  stat: { width: 36, fontSize: 13, color: '#1a1a1a', textAlign: 'center' },
  pts: { fontWeight: '700' },

  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', lineHeight: 20 },
  synced: { fontSize: 10, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginTop: 16 },
});
