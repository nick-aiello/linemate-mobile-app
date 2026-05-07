import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { api, BASE_URL } from '../api/client';

const SECTIONS = [
  { name: 'TeamSchedule', label: 'Schedule', sub: 'Upcoming and past games',   icon: 'calendar-outline' },
  { name: 'TeamRoster',   label: 'Roster',   sub: 'Manage players and subs',    icon: 'people-outline' },
  { name: 'TeamStats',    label: 'Stats',    sub: 'Player and team statistics',  icon: 'stats-chart-outline' },
  { name: 'TeamHistory',  label: 'History',  sub: 'Past lineups with results',   icon: 'time-outline' },
];

const AV_OPTIONS = [
  { key: 'yes',   label: 'IN',    activeBg: '#2e7d32', idleBg: '#e8f5e9', activeColor: '#fff', idleColor: '#2e7d32' },
  { key: 'maybe', label: 'MAYBE', activeBg: '#e67e22', idleBg: '#fff3e0', activeColor: '#fff', idleColor: '#e67e22' },
  { key: 'no',    label: 'OUT',   activeBg: '#c0392b', idleBg: '#fdecea', activeColor: '#fff', idleColor: '#c0392b' },
];

const AV_GROUPS = [
  { key: 'yes',   label: 'IN',          color: '#2e7d32' },
  { key: 'maybe', label: 'MAYBE',       color: '#e67e22' },
  { key: 'no',    label: 'OUT',         color: '#c0392b' },
  { key: null,    label: 'NO RESPONSE', color: '#bbb' },
];

function formatGameDate(dateStr, time) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return time ? datePart + '  ·  ' + time : datePart;
}

function computeRecord(schedule) {
  const past = (schedule || []).filter(g => g.isPast);
  if (!past.length) return null;
  const w   = past.filter(g => g.result === 'W').length;
  const l   = past.filter(g => g.result === 'L').length;
  const otl = past.filter(g => g.result === 'OTL').length;
  const t   = past.filter(g => g.result === 'T').length;
  return [w, l, otl || null, t ? t + 'T' : null].filter(x => x !== null).join('–');
}

export default function TeamHubScreen({ route, navigation }) {
  const { teamId, teamName, primaryColor = '#c0392b' } = route.params;
  const { user } = useAuth();

  const [nextGame, setNextGame]       = useState(null);
  const [availability, setAvailability] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [roster, setRoster]           = useState([]);
  const [subs, setSubs]               = useState([]);
  const [record, setRecord]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [settingAv, setSettingAv]     = useState(false);

  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceText, setAnnounceText] = useState('');
  const [postingAnnounce, setPostingAnnounce] = useState(false);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText]     = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const playerName = (
    user?.linkedPlayers?.[teamId] ||
    user?.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  )?.toUpperCase() || null;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [gameData, configData, announcementsData, rosterData, subsData, scheduleData] = await Promise.all([
        api.nextGame(teamId).catch(() => null),
        api.get('/teams/' + teamId + '/config').catch(() => ({})),
        api.getAnnouncements(teamId).catch(() => []),
        api.roster(teamId).catch(() => []),
        api.subs(teamId).catch(() => []),
        api.schedule(teamId).catch(() => []),
      ]);
      setNextGame(gameData?.date ? gameData : null);
      setAvailability(configData.availability || []);
      setAnnouncements(Array.isArray(announcementsData) ? announcementsData : []);
      const players = (Array.isArray(rosterData) ? rosterData : [])
        .map(p => Array.isArray(p) ? { num: p[0], name: p[1] } : p)
        .filter(p => p?.name);
      setRoster(players);
      setSubs(Array.isArray(subsData) ? subsData : []);
      setRecord(computeRecord(Array.isArray(scheduleData) ? scheduleData : []));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const myStatus = playerName
    ? (availability.find(a => a.name?.toUpperCase() === playerName)?.status ?? null)
    : null;

  const respondedSet = new Set(availability.map(a => a.name?.toUpperCase()));
  const noResponseNames = roster
    .filter(p => p.name && !respondedSet.has(p.name.toUpperCase()))
    .map(p => p.name);

  const grouped = {
    yes:   availability.filter(a => a.status === 'yes').map(a => a.name),
    maybe: availability.filter(a => a.status === 'maybe').map(a => a.name),
    no:    availability.filter(a => a.status === 'no').map(a => a.name),
  };

  const totalResponded = grouped.yes.length + grouped.maybe.length + grouped.no.length;
  const hasAttendance  = totalResponded > 0 || noResponseNames.length > 0;

  async function handleSetAv(status) {
    if (!playerName || settingAv) return;
    const next = myStatus === status ? null : status;
    setSettingAv(true);
    const prev = availability;
    setAvailability(cur => {
      const filtered = cur.filter(a => a.name?.toUpperCase() !== playerName);
      return next ? [...filtered, { name: playerName, status: next }] : filtered;
    });
    try {
      await api.setAvailability(teamId, playerName, next, nextGame?.id ?? null);
    } catch {
      setAvailability(prev);
      Alert.alert('Error', 'Could not update availability.');
    } finally {
      setSettingAv(false);
    }
  }

  async function handleFillSub(subId) {
    try {
      await api.fillSub(teamId, subId);
      load();
    } catch {
      Alert.alert('Error', 'Could not fill sub request.');
    }
  }

  async function handlePostAnnouncement() {
    if (!announceText.trim()) return;
    setPostingAnnounce(true);
    try {
      await api.postAnnouncement(teamId, announceText.trim());
      setAnnounceText('');
      setShowAnnounceModal(false);
      load();
    } catch {
      Alert.alert('Error', 'Could not post announcement.');
    } finally {
      setPostingAnnounce(false);
    }
  }

  async function handleSaveNote() {
    setSavingNote(true);
    try {
      await api.post('/teams/' + teamId + '/game-notes', { date: nextGame.date, note: noteText.trim() });
      setNextGame(g => ({ ...g, notes: noteText.trim() }));
      setShowNoteModal(false);
    } catch {
      Alert.alert('Error', 'Could not save note.');
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
      >
        {/* Logo */}
        <Image
          source={{ uri: `${BASE_URL}/${teamId}/logo/main` }}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Team name + record */}
        <View style={styles.teamRow}>
          <Text style={styles.teamLabel}>{(teamName || 'Team').toUpperCase()}</Text>
          {record && (
            <View style={[styles.recordBadge, { backgroundColor: primaryColor + '18' }]}>
              <Text style={[styles.recordText, { color: primaryColor }]}>{record}</Text>
            </View>
          )}
        </View>

        {/* Next game */}
        <View style={[styles.gameCard, { borderLeftColor: primaryColor }]}>
          <View style={styles.gameCardTop}>
            <Text style={styles.gameCardEyebrow}>NEXT GAME</Text>
            {nextGame && (
              <TouchableOpacity onPress={() => { setNoteText(nextGame.notes || ''); setShowNoteModal(true); }} hitSlop={8}>
                <Ionicons name="create-outline" size={16} color="#bbb" />
              </TouchableOpacity>
            )}
          </View>
          {nextGame ? (
            <>
              <Text style={styles.gameCardOpp}>
                {nextGame.isHome === false ? '@ ' : 'vs '}{nextGame.opponent || 'TBD'}
              </Text>
              <Text style={styles.gameCardMeta}>
                {formatGameDate(nextGame.date, nextGame.time)}{nextGame.rink ? '  ·  ' + nextGame.rink : ''}
              </Text>
              {nextGame.notes ? <Text style={styles.gameCardNotes}>{nextGame.notes}</Text> : null}
            </>
          ) : (
            <Text style={styles.gameCardOpp}>No upcoming games</Text>
          )}
        </View>

        {/* Availability buttons */}
        {nextGame && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Are you in?</Text>
            <View style={styles.avRow}>
              {AV_OPTIONS.map(opt => {
                const active = myStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.avBtn, { backgroundColor: active ? opt.activeBg : opt.idleBg }, settingAv && { opacity: 0.6 }]}
                    onPress={() => handleSetAv(opt.key)}
                    disabled={settingAv}
                  >
                    <Text style={[styles.avBtnText, { color: active ? opt.activeColor : opt.idleColor }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Attendance by name */}
        {nextGame && hasAttendance && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {'Attendance · '}
              {grouped.yes.length > 0   && `${grouped.yes.length} in`}
              {grouped.yes.length > 0 && grouped.maybe.length > 0 && ' · '}
              {grouped.maybe.length > 0 && `${grouped.maybe.length} maybe`}
              {(grouped.yes.length > 0 || grouped.maybe.length > 0) && grouped.no.length > 0 && ' · '}
              {grouped.no.length > 0    && `${grouped.no.length} out`}
              {noResponseNames.length > 0 && totalResponded > 0 && ' · '}
              {noResponseNames.length > 0 && `${noResponseNames.length} no response`}
            </Text>
            <View style={styles.attendanceBox}>
              {AV_GROUPS.map(group => {
                const names = group.key ? grouped[group.key] : noResponseNames;
                if (!names.length) return null;
                return (
                  <View key={group.key ?? 'none'} style={styles.avGroupRow}>
                    <Text style={[styles.avGroupLabel, { color: group.color }]}>{group.label}</Text>
                    <Text style={styles.avGroupNames} numberOfLines={3}>{names.join(', ')}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Sub requests */}
        {subs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Sub Requests</Text>
            {subs.map(sub => (
              <View key={sub.id} style={styles.subCard}>
                <View style={styles.subInfo}>
                  <Text style={styles.subPlayer}>{sub.playerName}</Text>
                  {sub.message ? <Text style={styles.subMessage}>{sub.message}</Text> : null}
                  {sub.game ? <Text style={styles.subMeta}>{sub.game.date} vs {sub.game.opponent}</Text> : null}
                </View>
                <TouchableOpacity style={[styles.subFillBtn, { backgroundColor: primaryColor }]} onPress={() => handleFillSub(sub.id)}>
                  <Text style={styles.subFillText}>I'll sub</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Announcements */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Announcements</Text>
            <TouchableOpacity onPress={() => setShowAnnounceModal(true)} hitSlop={8}>
              <Ionicons name="add-circle-outline" size={18} color={primaryColor} />
            </TouchableOpacity>
          </View>
          {announcements.length === 0
            ? <Text style={styles.emptyLabel}>No announcements yet.</Text>
            : announcements.map((a, i) => (
                <View key={a.id ?? i} style={[styles.announcementCard, { borderLeftColor: primaryColor }]}>
                  <Text style={styles.announcementText}>{a.message}</Text>
                  {a.author ? <Text style={styles.announcementMeta}>{a.author}</Text> : null}
                </View>
              ))
          }
        </View>

        {/* Nav cards */}
        <View style={styles.section}>
          {SECTIONS.map(section => (
            <TouchableOpacity
              key={section.name}
              style={styles.card}
              onPress={() => navigation.navigate(section.name, { teamId, primaryColor, teamName })}
            >
              <View style={[styles.iconWrap, { backgroundColor: primaryColor }]}>
                <Ionicons name={section.icon} size={20} color="#fff" />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel}>{section.label.toUpperCase()}</Text>
                <Text style={styles.cardSub}>{section.sub}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Announcement modal */}
      <Modal visible={showAnnounceModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalBar}>
              <TouchableOpacity onPress={() => { setShowAnnounceModal(false); setAnnounceText(''); }}>
                <Text style={styles.modalDismiss}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>ANNOUNCEMENT</Text>
              <TouchableOpacity onPress={handlePostAnnouncement} disabled={postingAnnounce || !announceText.trim()}>
                {postingAnnounce
                  ? <ActivityIndicator size="small" color={primaryColor} />
                  : <Text style={[styles.modalAction, { color: announceText.trim() ? primaryColor : '#ccc' }]}>Post</Text>
                }
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Write an announcement for the team..."
              placeholderTextColor="#bbb"
              value={announceText}
              onChangeText={setAnnounceText}
              multiline
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Game note modal */}
      <Modal visible={showNoteModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalBar}>
              <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                <Text style={styles.modalDismiss}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>GAME NOTE</Text>
              <TouchableOpacity onPress={handleSaveNote} disabled={savingNote}>
                {savingNote
                  ? <ActivityIndicator size="small" color={primaryColor} />
                  : <Text style={[styles.modalAction, { color: primaryColor }]}>Save</Text>
                }
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Wear dark jerseys · Meet at Gate B"
              placeholderTextColor="#bbb"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 48 },

  logo: { width: '100%', height: 80, marginBottom: 12, marginTop: 4 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  teamLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 2 },
  recordBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  recordText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  gameCard: { backgroundColor: '#fff', borderRadius: 4, padding: 16, marginBottom: 16, borderLeftWidth: 4 },
  gameCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  gameCardEyebrow: { fontSize: 9, fontWeight: '700', color: '#aaa', letterSpacing: 1.5 },
  gameCardOpp: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  gameCardMeta: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  gameCardNotes: { fontSize: 13, color: '#555', marginTop: 10, lineHeight: 18, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#f0ede8', paddingTop: 10 },

  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: '#aaa', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

  avRow: { flexDirection: 'row', gap: 8 },
  avBtn: { flex: 1, borderRadius: 6, paddingVertical: 13, alignItems: 'center' },
  avBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  attendanceBox: { backgroundColor: '#fff', borderRadius: 4, padding: 12, gap: 8 },
  avGroupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avGroupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, width: 88, paddingTop: 1 },
  avGroupNames: { flex: 1, fontSize: 12, color: '#444', lineHeight: 17 },

  subCard: { backgroundColor: '#fff', borderRadius: 4, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  subInfo: { flex: 1 },
  subPlayer: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5 },
  subMessage: { fontSize: 12, color: '#666', marginTop: 2 },
  subMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  subFillBtn: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  subFillText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  announcementCard: { backgroundColor: '#fff', borderRadius: 4, padding: 14, marginBottom: 8, borderLeftWidth: 3 },
  announcementText: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  announcementMeta: { fontSize: 11, color: '#aaa', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyLabel: { fontSize: 12, color: '#bbb', fontStyle: 'italic' },

  card: { backgroundColor: '#fff', borderRadius: 4, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', letterSpacing: 1 },
  cardSub: { fontSize: 11, color: '#888', marginTop: 2 },
  arrow: { fontSize: 22, color: '#ccc' },

  modal: { flex: 1, backgroundColor: '#f5f2ec' },
  modalBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0ddd8' },
  modalDismiss: { fontSize: 15, color: '#888' },
  modalTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, color: '#1a1a1a' },
  modalAction: { fontSize: 15, fontWeight: '700' },
  modalInput: { flex: 1, padding: 16, fontSize: 16, color: '#1a1a1a', textAlignVertical: 'top' },
});
