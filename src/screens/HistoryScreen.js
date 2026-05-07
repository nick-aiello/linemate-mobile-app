import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView, Alert } from 'react-native';
import { api } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SLOT_LABELS = {
  lw1: 'LW', c1: 'C', rw1: 'RW', ld1: 'LD', rd1: 'RD',
  lw2: 'LW', c2: 'C', rw2: 'RW', ld2: 'LD', rd2: 'RD',
  lw3: 'LW', c3: 'C', rw3: 'RW', ld3: 'LD', rd3: 'RD',
  lw4: 'LW', c4: 'C', rw4: 'RW',
  g1: 'G', g2: 'G',
};

const FWD_SLOTS = ['lw', 'c', 'rw'];
const DEF_SLOTS = ['ld', 'rd'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const d = new Date(dateStr + 'T12:00:00');
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  return dateStr;
}

function formatMonthHeader(dateStr) {
  if (!dateStr || dateStr.length < 7) return null;
  const parts = dateStr.split('-');
  return MONTHS[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}

function ResultBadge({ result }) {
  if (!result) return null;
  const bg = result === 'W' ? '#e8f5e9' : result === 'L' ? '#fce4ec' : result === 'OTL' ? '#fff3e0' : '#f5f5f5';
  const col = result === 'W' ? '#2e7d32' : result === 'L' ? '#c62828' : result === 'OTL' ? '#e65100' : '#666';
  return <View style={[styles.resultBadge, { backgroundColor: bg }]}><Text style={[styles.resultText, { color: col }]}>{result}</Text></View>;
}

function LineRow({ slots, lineup }) {
  return (
    <View style={styles.row}>
      {slots.map(slot => (
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

function LineupDetail({ lineup, primaryColor, onClose, onApply, onDelete }) {
  const fwdLines = [1,2,3,4].filter(n => lineup['lw'+n] || lineup['c'+n] || lineup['rw'+n]);
  const defLines = [1,2,3].filter(n => lineup['ld'+n] || lineup['rd'+n]);
  const goalies = [1,2].filter(n => lineup['g'+n]);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet">
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>{lineup.opponent ? (lineup.homeaway === 'away' ? '@ ' : 'vs ') + lineup.opponent : 'Lineup'}</Text>
            {lineup.gamedate && <Text style={styles.detailSub}>{formatDate(lineup.gamedate)}{lineup.gametime ? '  ·  ' + lineup.gametime : ''}</Text>}
            {lineup.rink && <Text style={styles.detailSub}>{lineup.rink}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: primaryColor }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.detailActions, { borderBottomColor: '#e0ddd8' }]}>
          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: primaryColor }]} onPress={onApply}>
            <Text style={styles.applyBtnText}>Apply to Current Lineup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.detailContent}>
          {fwdLines.map(n => (
            <View key={'fwd'+n} style={styles.lineGroup}>
              <Text style={[styles.lineLabel, { color: primaryColor }]}>Line {n}</Text>
              <LineRow slots={FWD_SLOTS.map(p => p+n)} lineup={lineup} />
            </View>
          ))}
          {defLines.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: primaryColor }]}>Defense</Text>
              {defLines.map(n => (
                <View key={'def'+n} style={styles.lineGroup}>
                  <Text style={[styles.lineLabel, { color: primaryColor }]}>Pair {n}</Text>
                  <LineRow slots={DEF_SLOTS.map(p => p+n)} lineup={lineup} />
                </View>
              ))}
            </>
          )}
          {goalies.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: primaryColor }]}>Goalie</Text>
              {goalies.map(n => (
                <LineRow key={'g'+n} slots={['g'+n]} lineup={lineup} />
              ))}
            </>
          )}
          {lineup.notes ? (
            <View style={styles.notesWrap}>
              <Text style={styles.notesLabel}>Game Notes</Text>
              <Text style={styles.notesBody}>{lineup.notes}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function HistoryScreen({ route, navigation }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get('/teams/' + teamId + '/history');
      setEntries(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  async function handleSelect(entry) {
    setDetailLoading(true);
    try {
      const detail = await api.get('/teams/' + teamId + '/history/' + entry.timestamp);
      setSelected({ ...detail, _timestamp: entry.timestamp });
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleApply() {
    if (!selected) return;
    Alert.alert(
      'Apply Lineup',
      'Apply this lineup to the current lineup? This will overwrite your current lineup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            try {
              await api.applyHistory(teamId, selected._timestamp);
              setSelected(null);
              Alert.alert('Applied', 'Lineup applied to current lineup.');
            } catch(e) {
              Alert.alert('Error', 'Failed to apply lineup.');
            }
          },
        },
      ]
    );
  }

  async function handleDelete() {
    if (!selected) return;
    Alert.alert(
      'Delete Lineup',
      'Delete this lineup history entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteHistory(teamId, selected._timestamp);
              setSelected(null);
              await load();
            } catch(e) {
              Alert.alert('Error', 'Failed to delete lineup.');
            }
          },
        },
      ]
    );
  }

  // Build list items with month headers
  const items = [];
  let lastMonth = null;
  for (const entry of entries) {
    const monthKey = entry.gamedate ? entry.gamedate.slice(0, 7) : null;
    if (monthKey && monthKey !== lastMonth) {
      lastMonth = monthKey;
      items.push({ type: 'month', key: 'month-' + monthKey, label: formatMonthHeader(entry.gamedate) });
    }
    items.push({ type: 'entry', key: entry.timestamp, entry });
  }

  if (loading) return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="HISTORY" primaryColor={primaryColor} onBack={() => navigation.goBack()} />
      <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="HISTORY" primaryColor={primaryColor} onBack={() => navigation.goBack()} />
      {detailLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={item => item.key}
        style={styles.container}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
        ListEmptyComponent={<Text style={styles.empty}>No lineup history yet.{'\n'}Set a lineup on the Lineup tab to save it here.</Text>}
        renderItem={({ item }) => {
          if (item.type === 'month') {
            return <Text style={styles.monthHeader}>{item.label}</Text>;
          }
          const { entry } = item;
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleSelect(entry)}>
              <View style={[styles.cardAccent, { backgroundColor: primaryColor }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardOpponent}>
                    {entry.opponent ? (entry.homeaway === 'away' ? '@ ' : 'vs ') + entry.opponent : 'Lineup'}
                  </Text>
                  {entry.result ? <ResultBadge result={entry.result} /> : null}
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardDate}>
                    {entry.gamedate ? formatDate(entry.gamedate) : ''}
                  </Text>
                  {entry.score ? <Text style={styles.cardScore}>{entry.score}</Text> : null}
                </View>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </TouchableOpacity>
          );
        }}
      />
      {selected && (
        <LineupDetail
          lineup={selected}
          primaryColor={primaryColor}
          onClose={() => setSelected(null)}
          onApply={handleApply}
          onDelete={handleDelete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { color: '#999', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  list: { padding: 16 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10 },

  monthHeader: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: '#aaa', paddingTop: 16, paddingBottom: 8, marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 4, marginBottom: 6, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  cardAccent: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardOpponent: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  cardDate: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardScore: { fontSize: 11, color: '#888' },
  cardArrow: { fontSize: 20, color: '#ccc', paddingRight: 12 },
  resultBadge: { borderRadius: 3, paddingHorizontal: 7, paddingVertical: 2 },
  resultText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  detailContainer: { flex: 1, backgroundColor: '#f5f2ec' },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0ddd8' },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 1 },
  detailSub: { fontSize: 12, color: '#888', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  closeBtn: { paddingLeft: 12, paddingTop: 2 },
  closeBtnText: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  detailActions: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1 },
  applyBtn: { flex: 1, borderRadius: 4, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  deleteBtn: { borderRadius: 4, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e0ddd8' },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#c0392b', textTransform: 'uppercase', letterSpacing: 1 },

  detailContent: { padding: 12, paddingBottom: 40 },
  lineGroup: { marginBottom: 8 },
  lineLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3, color: '#999' },
  sectionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 10, marginBottom: 3, color: '#999' },
  row: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden' },
  slot: { flex: 1, padding: 10, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#f0ede8' },
  slotLabel: { fontSize: 9, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  playerName: { fontSize: 11, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

  notesWrap: { backgroundColor: '#fff', borderRadius: 4, padding: 12, marginTop: 10 },
  notesLabel: { fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  notesBody: { fontSize: 13, color: '#1a1a1a', lineHeight: 18 },
});
