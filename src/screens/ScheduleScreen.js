import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../api/client';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ResultBadge({ result }) {
  if (!result) return null;
  const bg = result === 'W' ? '#e8f5e9' : result === 'L' ? '#fce4ec' : result === 'OTL' ? '#fff3e0' : '#f5f5f5';
  const col = result === 'W' ? '#2e7d32' : result === 'L' ? '#c62828' : result === 'OTL' ? '#e65100' : '#666';
  return <View style={[styles.resultBadge, { backgroundColor: bg }]}><Text style={[styles.resultText, { color: col }]}>{result}</Text></View>;
}

function HABadge({ isHome }) {
  if (isHome === undefined || isHome === null) return null;
  return (
    <View style={[styles.haBadge, isHome ? styles.haBadgeHome : styles.haBadgeAway]}>
      <Text style={[styles.haText, isHome ? styles.haTextHome : styles.haTextAway]}>{isHome ? 'H' : 'A'}</Text>
    </View>
  );
}

function GameRow({ game, primaryColor }) {
  const isPast = game.isPast;
  return (
    <View style={[styles.gameRow, !isPast && { borderLeftWidth: 3, borderLeftColor: primaryColor }, isPast && styles.gameRowPast]}>
      <Text style={styles.gameDate}>{formatDate(game.date)}</Text>
      <HABadge isHome={game.isHome} />
      <View style={styles.gameInfo}>
        <Text style={styles.gameOpp} numberOfLines={1}>{game.opponent}</Text>
        {!isPast && game.rink ? <Text style={styles.gameMeta}>{game.time ? game.time + ' · ' : ''}{game.rink}</Text> : null}
        {isPast && game.score ? <Text style={styles.gameScore}>{game.score}</Text> : null}
      </View>
      {isPast && <ResultBadge result={game.result} />}
    </View>
  );
}

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function StandingsTable({ standings, teamName }) {
  if (!standings || !standings.length) return null;
  const hasOtl = standings.some(s => s.otl > 0);
  const hasT = standings.some(s => s.t > 0);
  const ourName = (teamName || '').toUpperCase();
  return (
    <View style={styles.standingsWrap}>
      <SectionLabel label="Standings" />
      <View style={styles.standingsTable}>
        <View style={styles.standingsHead}>
          <Text style={[styles.standingsCell, styles.nameCol, styles.headCell]}>Team</Text>
          <Text style={[styles.standingsCell, styles.headCell]}>GP</Text>
          <Text style={[styles.standingsCell, styles.headCell]}>W</Text>
          <Text style={[styles.standingsCell, styles.headCell]}>L</Text>
          {hasOtl && <Text style={[styles.standingsCell, styles.headCell]}>OTL</Text>}
          {hasT && <Text style={[styles.standingsCell, styles.headCell]}>T</Text>}
          <Text style={[styles.standingsCell, styles.headCell]}>PTS</Text>
          <Text style={[styles.standingsCell, styles.headCell]}>+/-</Text>
        </View>
        {standings.map((s, i) => {
          const isOurs = s.name.toUpperCase() === ourName;
          const diff = (s.gf || 0) - (s.ga || 0);
          return (
            <View key={i} style={[styles.standingsRow, isOurs && styles.standingsRowOurs]}>
              <Text style={[styles.standingsCell, styles.nameCol, isOurs && { color: '#c0392b', fontWeight: '700' }]} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.standingsCell}>{s.gp}</Text>
              <Text style={styles.standingsCell}>{s.w}</Text>
              <Text style={styles.standingsCell}>{s.l}</Text>
              {hasOtl && <Text style={styles.standingsCell}>{s.otl}</Text>}
              {hasT && <Text style={styles.standingsCell}>{s.t}</Text>}
              <Text style={[styles.standingsCell, { fontWeight: '700' }]}>{s.pts}</Text>
              <Text style={styles.standingsCell}>{diff > 0 ? '+' + diff : diff}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function ScheduleScreen({ route }) {
  const { teamId, primaryColor = '#c0392b', teamName } = route.params;
  const [schedule, setSchedule] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [schedData, statsData] = await Promise.all([
        api.schedule(teamId),
        api.stats(teamId).catch(() => ({})),
      ]);
      setSchedule(schedData || []);
      setStandings((statsData && statsData.standings) || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;

  const past = schedule.filter(g => g.isPast).slice().reverse();
  const upcoming = schedule.filter(g => !g.isPast);
  const wins = past.filter(g => g.result === 'W').length;
  const losses = past.filter(g => g.result === 'L').length;
  const otl = past.filter(g => g.result === 'OTL').length;
  const ties = past.filter(g => g.result === 'T').length;
  const recordStr = wins + '-' + losses + (otl ? '-' + otl : '') + (ties ? '-' + ties + 'T' : '');

  const items = [];
  if (past.length) {
    items.push({ type: 'record', key: 'record', wins, losses, otl, ties, recordStr, pastCount: past.length });
  }
  if (standings.length) {
    items.push({ type: 'standings', key: 'standings' });
  }
  if (past.length) {
    items.push({ type: 'label', key: 'label-results', label: 'Results' });
    past.forEach((g, i) => items.push({ type: 'game', key: 'past-' + i, game: g }));
  }
  if (upcoming.length) {
    items.push({ type: 'label', key: 'label-upcoming', label: 'Upcoming' });
    upcoming.forEach((g, i) => items.push({ type: 'game', key: 'upcoming-' + i, game: g }));
  }
  if (!schedule.length) {
    items.push({ type: 'empty', key: 'empty' });
  }

  return (
    <FlatList
      data={items}
      keyExtractor={item => item.key}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
      renderItem={({ item }) => {
        if (item.type === 'record') {
          return (
            <View style={styles.recordBlock}>
              <Text style={styles.record}>{item.recordStr}</Text>
              <Text style={styles.recordSub}>W–L{item.otl ? '–OTL' : ''}{item.ties ? '–T' : ''}  ·  {item.pastCount} games played</Text>
            </View>
          );
        }
        if (item.type === 'standings') {
          return <StandingsTable standings={standings} teamName={teamName} />;
        }
        if (item.type === 'label') {
          return <SectionLabel label={item.label} />;
        }
        if (item.type === 'game') {
          return <GameRow game={item.game} primaryColor={primaryColor} />;
        }
        if (item.type === 'empty') {
          return <Text style={styles.empty}>No schedule data available.</Text>;
        }
        return null;
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  empty: { color: '#aaa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', paddingVertical: 32 },

  recordBlock: { marginBottom: 16 },
  record: { fontSize: 28, fontWeight: '700', color: '#1a1a1a', letterSpacing: 2 },
  recordSub: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', marginTop: 20, marginBottom: 8 },

  gameRow: { backgroundColor: '#fff', borderRadius: 4, padding: 11, marginBottom: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  gameRowPast: { opacity: 0.75 },
  gameDate: { fontSize: 12, color: '#888', minWidth: 48, textTransform: 'uppercase', letterSpacing: 0.5 },
  haBadge: { borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  haBadgeHome: { backgroundColor: '#e8f5e9' },
  haBadgeAway: { backgroundColor: '#f5f5f5' },
  haText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  haTextHome: { color: '#2e7d32' },
  haTextAway: { color: '#888' },
  gameInfo: { flex: 1 },
  gameOpp: { fontSize: 13, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5 },
  gameMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  gameScore: { fontSize: 11, color: '#888', marginTop: 2 },
  resultBadge: { borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3, minWidth: 36, alignItems: 'center' },
  resultText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  standingsWrap: { marginBottom: 4 },
  standingsTable: { backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden' },
  standingsHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e8e5e0', paddingVertical: 6, paddingHorizontal: 8 },
  standingsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0ede8', paddingVertical: 7, paddingHorizontal: 8 },
  standingsRowOurs: { backgroundColor: '#fafafa' },
  standingsCell: { fontSize: 12, color: '#1a1a1a', textAlign: 'center', width: 32 },
  nameCol: { flex: 1, textAlign: 'left', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4 },
  headCell: { fontSize: 10, color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
});
