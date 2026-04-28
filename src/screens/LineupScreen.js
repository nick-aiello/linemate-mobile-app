import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api/client';

const SLOT_LABELS = {
  lw1: 'LW', c1: 'C', rw1: 'RW', ld1: 'LD', rd1: 'RD',
  lw2: 'LW', c2: 'C', rw2: 'RW', ld2: 'LD', rd2: 'RD',
  lw3: 'LW', c3: 'C', rw3: 'RW', ld3: 'LD', rd3: 'RD',
  lw4: 'LW', c4: 'C', rw4: 'RW',
  g1: 'G', g2: 'G',
};

const FWD_SLOTS = ['lw', 'c', 'rw'];
const DEF_SLOTS = ['ld', 'rd'];

function LineRow({ slots, lineup, color }) {
  return (
    <View style={styles.row}>
      {slots.map((slot) => (
        <View key={slot} style={styles.slot}>
          <Text style={styles.slotLabel}>{SLOT_LABELS[slot]}</Text>
          <Text style={[styles.playerName, { color: lineup[slot] ? '#1a1a1a' : '#ccc' }]} numberOfLines={1}>
            {lineup[slot] || '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function LineupScreen({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const [lineup, setLineup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setting, setSetting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.lineup(teamId);
      setLineup(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  async function handleSetLineup() {
    setSetting(true);
    try {
      await api.setLineup(teamId);
      await load();
    } catch(e) {
      // handle error
    } finally {
      setSetting(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;
  if (!lineup || Object.keys(lineup).length === 0) {
    return <View style={styles.center}><Text style={styles.empty}>No lineup set yet.</Text></View>;
  }

  const fwdLines = [1, 2, 3, 4].filter((n) => lineup['lw' + n] || lineup['c' + n] || lineup['rw' + n]);
  const defLines = [1, 2, 3].filter((n) => lineup['ld' + n] || lineup['rd' + n]);
  const goalies = [1, 2].filter((n) => lineup['g' + n]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
    >
      {lineup.opponent && (
        <View style={styles.gameInfo}>
          <Text style={styles.gameInfoText}>vs {lineup.opponent}</Text>
          {lineup.gamedate && <Text style={styles.gameInfoSub}>{lineup.gamedate}{lineup.gametime ? ' · ' + lineup.gametime : ''}</Text>}
          {lineup.rink && <Text style={styles.gameInfoSub}>{lineup.rink}</Text>}
        </View>
      )}

      {fwdLines.map((n) => (
        <View key={'fwd' + n} style={styles.lineGroup}>
          <Text style={[styles.lineLabel, { color: primaryColor }]}>Line {n}</Text>
          <LineRow slots={FWD_SLOTS.map((p) => p + n)} lineup={lineup} color={primaryColor} />
        </View>
      ))}

      {defLines.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: primaryColor }]}>Defense</Text>
          {defLines.map((n) => (
            <View key={'def' + n} style={styles.lineGroup}>
              <Text style={[styles.lineLabel, { color: primaryColor }]}>Pair {n}</Text>
              <LineRow slots={DEF_SLOTS.map((p) => p + n)} lineup={lineup} color={primaryColor} />
            </View>
          ))}
        </>
      )}

      {goalies.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: primaryColor }]}>Goalie</Text>
          {goalies.map((n) => (
            <LineRow key={'g' + n} slots={['g' + n]} lineup={lineup} color={primaryColor} />
          ))}
        </>
      )}

      {!lineup.isSet && (
        <TouchableOpacity style={[styles.setButton, { backgroundColor: primaryColor }]} onPress={handleSetLineup} disabled={setting}>
          {setting ? <ActivityIndicator color="#fff" /> : <Text style={styles.setButtonText}>Set Lineup</Text>}
        </TouchableOpacity>
      )}
      {lineup.isSet && (
        <View style={styles.setBadge}>
          <Text style={styles.setBadgeText}>✓ Lineup Set</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#999', fontSize: 16 },
  gameInfo: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 16, alignItems: 'center' },
  gameInfoText: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  gameInfoSub: { fontSize: 13, color: '#666', marginTop: 2 },
  lineGroup: { marginBottom: 12 },
  lineLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },
  row: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden' },
  slot: { flex: 1, padding: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f0ede8' },
  slotLabel: { fontSize: 10, fontWeight: '700', color: '#999', textTransform: 'uppercase', marginBottom: 2 },
  playerName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  setButton: { borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  setButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  setBadge: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 24 },
  setBadgeText: { color: '#2e7d32', fontSize: 15, fontWeight: '600' },
});
