import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, FlatList, TextInput, Alert, ActionSheetIOS, Platform, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL, api } from '../api/client';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildShareText(lineup, teamName, config) {
  const fwdCount = config?.fwdLines || 3;
  const defCount = config?.defLines || 2;
  const lines = [];
  const opp = lineup.opponent ? `vs ${lineup.opponent}` : '';
  if (teamName || opp) lines.push([teamName, opp].filter(Boolean).join(' '));
  if (lineup.date) {
    const d = new Date(lineup.date + 'T12:00:00');
    lines.push(`${MONTHS[d.getMonth()]} ${d.getDate()}${lineup.time ? ' · ' + lineup.time : ''}`);
  }
  lines.push('');
  const positions = { lw: 'LW', c: 'C', rw: 'RW', ld: 'LD', rd: 'RD', g: 'G' };
  for (let i = 1; i <= fwdCount; i++) {
    const row = ['lw','c','rw'].map(p => (lineup[p]?.[i] || '—').padEnd(16)).join('  ');
    lines.push(`Line ${i}:  ${row}`);
  }
  lines.push('');
  for (let i = 1; i <= defCount; i++) {
    const row = ['ld','rd'].map(p => (lineup[p]?.[i] || '—').padEnd(16)).join('  ');
    lines.push(`Pair ${i}:  ${row}`);
  }
  if (lineup.g?.[1]) { lines.push(''); lines.push(`Goalie:  ${lineup.g[1]}`); }
  return lines.join('\n');
}

const SECTION_LABELS = {
  lw: 'Left Wing', c: 'Center', rw: 'Right Wing',
  ld: 'Left Defense', rd: 'Right Defense', g: 'Goaltender',
};

const AV_COLORS = { yes: '#2e7d32', no: '#c0392b', maybe: '#e67e22' };

function AttendanceBar({ availability }) {
  if (!availability || !availability.length) return null;
  const yes = availability.filter(a => a.status === 'yes').length;
  const maybe = availability.filter(a => a.status === 'maybe').length;
  const no = availability.filter(a => a.status === 'no').length;
  const unknown = availability.filter(a => a.status === 'unknown').length;
  return (
    <View style={styles.attBar}>
      <Text style={[styles.attItem, { color: '#2e7d32' }]}>✓ {yes} In</Text>
      <Text style={styles.attSep}>·</Text>
      <Text style={[styles.attItem, { color: '#e67e22' }]}>? {maybe} Maybe</Text>
      <Text style={styles.attSep}>·</Text>
      <Text style={[styles.attItem, { color: '#c0392b' }]}>✗ {no} Out</Text>
      <Text style={styles.attSep}>·</Text>
      <Text style={[styles.attItem, { color: '#aaa' }]}>— {unknown} No resp</Text>
    </View>
  );
}

function splitName(name) {
  if (!name) return { first: '', last: '' };
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? { first: '', last: parts[0] }
    : { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val.includes('T') ? val : val + 'T12:00:00');
  if (isNaN(d)) return val;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function formatTime(val) {
  if (!val) return '—';
  const match = val.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1]);
    const m = match[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  return val;
}

function PlayerName({ name }) {
  if (!name) {
    return <Text style={[styles.playerNameLast, { color: '#ccc', fontSize: 11 }]}>TAP</Text>;
  }
  const { first, last } = splitName(name);
  return (
    <View>
      {first ? <Text style={styles.playerNameFirst} numberOfLines={1}>{first}</Text> : null}
      <Text style={styles.playerNameLast} numberOfLines={1}>{last}</Text>
    </View>
  );
}

function Column({ position, lines, lineup, onSlotPress, color, availabilityMap }) {
  return (
    <View style={styles.column}>
      <View style={[styles.sectionHeader, { backgroundColor: color }]}>
        <Text style={styles.sectionHeaderText}>{SECTION_LABELS[position]}</Text>
      </View>
      {lines.map(n => {
        const slot = position + n;
        const name = lineup[slot] || '';
        const num = lineup[slot + '_num'] || '';
        const avStatus = name && availabilityMap ? availabilityMap[name] : null;
        const avColor = avStatus && AV_COLORS[avStatus];
        return (
          <TouchableOpacity
            key={slot}
            style={styles.playerRow}
            onPress={() => onSlotPress(slot)}
            activeOpacity={0.6}
          >
            {avColor && <View style={[styles.avDot, { backgroundColor: avColor }]} />}
            <Text style={styles.playerNumber}>{num}</Text>
            <PlayerName name={name} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function LineupScreen({ route, navigation }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const [lineup, setLineup] = useState({});
  const [roster, setRoster] = useState([]);
  const [config, setConfig] = useState({ opponents: [], rinks: [], jerseys: [], fwdLines: 3, defLines: 2 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const saveTimer = useRef(null);
  const lineupRef = useRef({});

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [lineupData, rosterData, configData] = await Promise.all([
        api.lineup(teamId),
        api.roster(teamId),
        api.get('/teams/' + teamId + '/config').catch(() => ({ opponents: [], rinks: [], jerseys: [], threeDefLines: false })),
      ]);
      setConfig(configData);
      const rosterMap = {};
      rosterData.forEach(p => {
        const player = Array.isArray(p) ? { num: p[0], name: p[1] } : p;
        if (player.name) rosterMap[player.name] = player.num || '';
      });
      const augmented = { ...lineupData };
      Object.keys(lineupData).forEach(k => {
        if (typeof lineupData[k] === 'string' && rosterMap[lineupData[k]] !== undefined) {
          augmented[k + '_num'] = rosterMap[lineupData[k]];
        }
      });
      lineupRef.current = augmented;
      setLineup(augmented);
      setRoster(rosterData.map(p => Array.isArray(p) ? { num: p[0], name: p[1] } : p).filter(p => p.name));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  async function handleShare() {
    const teamName = route.params.teamName || teamId;
    const shareText = buildShareText(lineup, teamName, config);
    const url = `${BASE_URL}/${teamId}/`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Share Text', 'Share Link', 'Open in Browser', 'Cancel'], cancelButtonIndex: 3 },
        async (idx) => {
          if (idx === 0) await Share.share({ message: shareText });
          else if (idx === 1) await Share.share({ message: url });
          else if (idx === 2) Linking.openURL(url);
        }
      );
    } else {
      await Share.share({ message: shareText + '\n\n' + url });
    }
  }

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 14, marginRight: 4, alignItems: 'center' }}>
          {saving && <ActivityIndicator color="#fff" size="small" />}
          {config.chillerTeamId ? (
            <TouchableOpacity onPress={handleFillNextGame}>
              <Text style={{ color: '#fff', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Fill</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [saving, config, lineup]);

  function updateLineup(updates) {
    const next = { ...lineupRef.current, ...updates };
    lineupRef.current = next;
    setLineup(next);
    scheduleAutoSave(next);
  }

  function scheduleAutoSave(newLineup) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        const toSave = Object.fromEntries(Object.entries(newLineup).filter(([k]) => !k.endsWith('_num')));
        await api.post('/teams/' + teamId + '/lineup', toSave);
      } catch(e) {
        Alert.alert('Error', 'Failed to save lineup');
      } finally {
        setSaving(false);
      }
    }, 800);
  }

  async function handleToggleStatus() {
    setToggling(true);
    try {
      const result = await api.toggleLineup(teamId);
      setLineup(prev => ({ ...prev, isSet: result.isSet }));
      lineupRef.current = { ...lineupRef.current, isSet: result.isSet };
    } finally {
      setToggling(false);
    }
  }

  async function handleFillNextGame() {
    try {
      const game = await api.nextGame(teamId);
      if (!game) { Alert.alert('No Game Found', 'No upcoming game found in ChillerStats.'); return; }
      updateLineup({
        ...(game.date && { gamedate: game.date }),
        ...(game.time && { gametime: game.time }),
        ...(game.rink && { rink: game.rink }),
        ...(game.opponent && { opponent: game.opponent }),
        ...(game.isHome != null && { homeaway: game.isHome ? 'home' : 'away' }),
      });
    } catch(e) {
      Alert.alert('Error', 'Could not fetch next game.');
    }
  }

  function handleSlotPress(slot) { setPickerSlot(slot); setPickerSearch(''); }

  function handlePickPlayer(player) {
    updateLineup({ [pickerSlot]: player.name, [pickerSlot + '_num']: player.num || '' });
    setPickerSlot(null);
  }

  function handleClearSlot() {
    updateLineup({ [pickerSlot]: '', [pickerSlot + '_num']: '' });
    setPickerSlot(null);
  }

  function showPicker(title, options, onSelect) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: [...options, 'Cancel'], cancelButtonIndex: options.length },
        i => { if (i < options.length) onSelect(options[i]); }
      );
    }
  }

  const fwdLines = Array.from({ length: config.fwdLines || 3 }, (_, i) => i + 1);
  const defLines = Array.from({ length: config.defLines || 2 }, (_, i) => i + 1);
  const logoUri = BASE_URL + '/' + teamId + '/logo/main';
  const availabilityMap = {};
  (config.availability || []).forEach(a => { availabilityMap[a.name] = a.status; });

  const filteredRoster = pickerSearch
    ? roster.filter(p => p.name.toLowerCase().includes(pickerSearch.toLowerCase()))
    : roster;

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: Logo + Team Name */}
        <View style={styles.headerTop}>
          <Image source={{ uri: logoUri }} style={styles.mainLogo} resizeMode="contain" />
          <Text style={styles.teamTitle} numberOfLines={2}>{route.params.teamName || teamId}</Text>
        </View>

        {/* Game Info Card */}
        <View style={styles.gameInfoCard}>
          {[
            { label: 'VS', value: lineup.opponent || '—', field: 'opponent', options: config.opponents, width: '50%', valueStyle: styles.infoCellValueLarge },
            { label: 'Date', value: formatDate(lineup.gamedate), field: 'gamedate', options: null, width: '25%', valueStyle: styles.infoCellValueSmall },
            { label: 'Time', value: formatTime(lineup.gametime), field: 'gametime', options: null, width: '25%', valueStyle: styles.infoCellValueSmall },
            { label: 'Rink', value: lineup.rink || '—', field: 'rink', options: config.rinks, width: '50%', valueStyle: styles.infoCellValue },
            { label: 'Jersey', value: (config.jerseys.find(j => j.id === (lineup.jersey || 'home')) || config.jerseys[0] || {}).label || '—', field: 'jersey', options: config.jerseys.map(j => j.id), width: '25%', valueStyle: styles.infoCellValueSmall },
            { label: 'H/A', value: lineup.homeaway ? lineup.homeaway.toUpperCase() : '—', field: 'homeaway', options: ['home', 'away'], width: '25%', valueStyle: styles.infoCellValueSmall },
          ].map(cell => (
            <TouchableOpacity
              key={cell.label}
              style={[styles.infoCell, { width: cell.width }]}
              onPress={() => {
                if (cell.options && cell.options.length > 0) {
                  showPicker(cell.label, cell.options, v => updateLineup({ [cell.field]: v }));
                } else {
                  Alert.prompt
                    ? Alert.prompt(cell.label, null, v => updateLineup({ [cell.field]: v }), 'plain-text', lineup[cell.field] || '')
                    : null;
                }
              }}
            >
              <Text style={styles.infoCellLabel}>{cell.label}</Text>
              <Text style={cell.valueStyle} numberOfLines={1}>{cell.value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <AttendanceBar availability={config.availability} />

        {/* Forwards Grid: LW | C | RW */}
        <View style={styles.grid}>
          {['lw', 'c', 'rw'].map(pos => (
            <Column key={pos} position={pos} lines={fwdLines} lineup={lineup} onSlotPress={handleSlotPress} color={primaryColor} availabilityMap={availabilityMap} />
          ))}
        </View>

        {/* Defense + Goalie Grid: LD | RD | G */}
        <View style={[styles.grid, { marginTop: 10 }]}>
          {['ld', 'rd'].map(pos => (
            <Column key={pos} position={pos} lines={defLines} lineup={lineup} onSlotPress={handleSlotPress} color={primaryColor} availabilityMap={availabilityMap} />
          ))}
          <Column position="g" lines={[1]} lineup={lineup} onSlotPress={handleSlotPress} color={primaryColor} availabilityMap={availabilityMap} />
        </View>

        {/* Game Notes */}
        <View style={styles.notesWrap}>
          <Text style={styles.notesLabel}>Game Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="e.g. PP1: Smith, Jones, Williams..."
            placeholderTextColor="#bbb"
            value={lineup.notes || ''}
            onChangeText={v => updateLineup({ notes: v })}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Status toggle */}
        <TouchableOpacity
          style={[styles.statusBtn, { backgroundColor: lineup.isSet ? '#2e7d32' : primaryColor }]}
          onPress={handleToggleStatus}
          disabled={toggling}
        >
          {toggling ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.statusBtnText}>{lineup.isSet ? '✓  LINEUP SET — MARK PENDING' : 'MARK AS SET'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Player Picker Modal */}
      <Modal visible={!!pickerSlot} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.pickerContainer}>
          <View style={[styles.pickerHeader, { backgroundColor: primaryColor }]}>
            <Text style={styles.pickerTitle}>{pickerSlot ? SECTION_LABELS[pickerSlot.replace(/\d/g, '')] : ''}</Text>
            <TouchableOpacity onPress={() => setPickerSlot(null)}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={styles.pickerSearch} placeholder="Search players..." placeholderTextColor="#999" value={pickerSearch} onChangeText={setPickerSearch} autoFocus />
          <FlatList
            data={filteredRoster}
            keyExtractor={(p, i) => p.name + i}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerRow} onPress={() => handlePickPlayer(item)}>
                <Text style={[styles.pickerNum, { color: primaryColor }]}>{item.num}</Text>
                <Text style={styles.pickerName}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListHeaderComponent={
              <TouchableOpacity style={styles.pickerClearRow} onPress={handleClearSlot}>
                <Text style={styles.pickerClearText}>— CLEAR SLOT</Text>
              </TouchableOpacity>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { padding: 12, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, backgroundColor: '#fff', borderRadius: 4, padding: 12 },
  mainLogo: { width: 72, height: 72, flexShrink: 0 },
  teamTitle: { flex: 1, fontSize: 22, fontWeight: '900', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 2 },

  // Game info card (6-cell grid)
  gameInfoCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
  infoCell: { padding: 10, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#f0ede8' },
  infoCellLabel: { fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3 },
  infoCellValue: { fontSize: 13, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  infoCellValueLarge: { fontSize: 13, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  infoCellValueSmall: { fontSize: 13, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },

  // Grid
  grid: { flexDirection: 'row', gap: 6 },
  column: { flex: 1, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden' },
  sectionHeader: { paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center' },
  sectionHeaderText: { color: '#fff', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700', textAlign: 'center' },
  playerRow: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f0ede8', minHeight: 58, justifyContent: 'center' },
  avDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4 },
  playerNumber: { fontSize: 22, fontFamily: 'Futura-CondensedExtraBold', color: '#1a1a1a', lineHeight: 26 },
  playerNameFirst: { fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 12 },
  playerNameLast: { fontSize: 12, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', lineHeight: 15 },

  // Notes
  notesWrap: { backgroundColor: '#fff', borderRadius: 4, padding: 12, marginTop: 10 },
  notesLabel: { fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  notesInput: { fontSize: 13, color: '#1a1a1a', lineHeight: 18, minHeight: 60, textAlignVertical: 'top' },

  // Attendance bar
  attBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10, gap: 6 },
  attItem: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  attSep: { fontSize: 11, color: '#ddd' },

  // Status button
  statusBtn: { padding: 14, alignItems: 'center', marginTop: 12, borderRadius: 4 },
  statusBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },

  // Picker
  pickerContainer: { flex: 1, backgroundColor: '#f5f2ec' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  pickerTitle: { color: '#fff', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  pickerCancel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  pickerSearch: { margin: 12, backgroundColor: '#fff', borderRadius: 4, padding: 12, fontSize: 14, color: '#1a1a1a', borderWidth: 1, borderColor: '#ddd', textTransform: 'uppercase', letterSpacing: 1 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0ede8' },
  pickerNum: { fontSize: 22, fontFamily: 'Futura-CondensedExtraBold', width: 44 },
  pickerName: { fontSize: 13, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  pickerClearRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0ede8' },
  pickerClearText: { fontSize: 12, color: '#999', letterSpacing: 1, textTransform: 'uppercase' },
});
