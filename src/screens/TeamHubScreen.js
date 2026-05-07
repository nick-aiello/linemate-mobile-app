import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

const SECTIONS = [
  { name: 'TeamSchedule', label: 'Schedule', sub: 'Upcoming and past games',    icon: 'calendar-outline' },
  { name: 'TeamRoster',   label: 'Roster',   sub: 'Manage players and subs',     icon: 'people-outline' },
  { name: 'TeamStats',    label: 'Stats',    sub: 'Player and team statistics',   icon: 'stats-chart-outline' },
  { name: 'TeamHistory',  label: 'History',  sub: 'Past lineups with results',    icon: 'time-outline' },
];

const AV_OPTIONS = [
  { key: 'yes',   label: 'IN',    activeBg: '#2e7d32', idleBg: '#e8f5e9', activeColor: '#fff', idleColor: '#2e7d32' },
  { key: 'maybe', label: 'MAYBE', activeBg: '#e67e22', idleBg: '#fff3e0', activeColor: '#fff', idleColor: '#e67e22' },
  { key: 'no',    label: 'OUT',   activeBg: '#c0392b', idleBg: '#fdecea', activeColor: '#fff', idleColor: '#c0392b' },
];

function formatGameDate(dateStr, time) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return time ? datePart + '  ·  ' + time : datePart;
}

export default function TeamHubScreen({ route, navigation }) {
  const { teamId, teamName, primaryColor = '#c0392b' } = route.params;
  const { user } = useAuth();

  const [nextGame, setNextGame] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingAv, setSettingAv] = useState(false);

  const playerName = (
    user?.linkedPlayers?.[teamId] ||
    user?.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  )?.toUpperCase() || null;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [gameData, configData, announcementsData] = await Promise.all([
        api.nextGame(teamId).catch(() => null),
        api.get('/teams/' + teamId + '/config').catch(() => ({})),
        api.getAnnouncements(teamId).catch(() => []),
      ]);
      setNextGame(gameData?.date ? gameData : null);
      setAvailability(configData.availability || []);
      setAnnouncements(Array.isArray(announcementsData) ? announcementsData : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const myStatus = playerName
    ? (availability.find(a => a.name?.toUpperCase() === playerName)?.status || null)
    : null;

  const inCount    = availability.filter(a => a.status === 'yes').length;
  const maybeCount = availability.filter(a => a.status === 'maybe').length;
  const outCount   = availability.filter(a => a.status === 'no').length;

  async function handleSetAv(status) {
    if (!playerName || settingAv) return;
    const next = myStatus === status ? null : status;
    setSettingAv(true);
    const prevAv = availability;
    setAvailability(prev => {
      const filtered = prev.filter(a => a.name?.toUpperCase() !== playerName);
      return next ? [...filtered, { name: playerName, status: next }] : filtered;
    });
    try {
      await api.setAvailability(teamId, playerName, next, nextGame?.id || null);
    } catch {
      setAvailability(prevAv);
      Alert.alert('Error', 'Could not update availability.');
    } finally {
      setSettingAv(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
    >
      <Text style={styles.teamLabel}>{(teamName || 'Team').toUpperCase()}</Text>

      {/* Next game */}
      <View style={[styles.gameCard, { borderLeftColor: primaryColor }]}>
        <Text style={styles.gameCardEyebrow}>NEXT GAME</Text>
        {nextGame ? (
          <>
            <Text style={styles.gameCardOpp}>
              {nextGame.isHome === false ? '@ ' : 'vs '}{nextGame.opponent || 'TBD'}
            </Text>
            <Text style={styles.gameCardMeta}>
              {formatGameDate(nextGame.date, nextGame.time)}
              {nextGame.rink ? '  ·  ' + nextGame.rink : ''}
            </Text>
          </>
        ) : (
          <Text style={styles.gameCardOpp}>No upcoming games</Text>
        )}
      </View>

      {/* Availability */}
      {nextGame && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Are you in?</Text>
          <View style={styles.avRow}>
            {AV_OPTIONS.map(opt => {
              const active = myStatus === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.avBtn,
                    { backgroundColor: active ? opt.activeBg : opt.idleBg },
                    settingAv && { opacity: 0.6 },
                  ]}
                  onPress={() => handleSetAv(opt.key)}
                  disabled={settingAv}
                >
                  <Text style={[styles.avBtnText, { color: active ? opt.activeColor : opt.idleColor }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {(inCount + maybeCount + outCount) > 0 && (
            <View style={styles.attendanceRow}>
              {inCount > 0    && <Text style={styles.attendIn}>{inCount} in</Text>}
              {maybeCount > 0 && <Text style={styles.attendMaybe}>{maybeCount} maybe</Text>}
              {outCount > 0   && <Text style={styles.attendOut}>{outCount} out</Text>}
            </View>
          )}
        </View>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Announcements</Text>
          {announcements.map((a, i) => (
            <View key={a.id ?? i} style={[styles.announcementCard, { borderLeftColor: primaryColor }]}>
              <Text style={styles.announcementText}>{a.message}</Text>
              {a.author ? <Text style={styles.announcementMeta}>{a.author}</Text> : null}
            </View>
          ))}
        </View>
      )}

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 48 },

  teamLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 2, marginBottom: 12, marginTop: 4 },

  gameCard: { backgroundColor: '#fff', borderRadius: 4, padding: 16, marginBottom: 16, borderLeftWidth: 4 },
  gameCardEyebrow: { fontSize: 9, fontWeight: '700', color: '#aaa', letterSpacing: 1.5, marginBottom: 6 },
  gameCardOpp: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  gameCardMeta: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },

  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: '#aaa', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },

  avRow: { flexDirection: 'row', gap: 8 },
  avBtn: { flex: 1, borderRadius: 6, paddingVertical: 13, alignItems: 'center' },
  avBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  attendanceRow: { flexDirection: 'row', gap: 14, marginTop: 10, paddingLeft: 2 },
  attendIn:    { fontSize: 12, fontWeight: '600', color: '#2e7d32' },
  attendMaybe: { fontSize: 12, fontWeight: '600', color: '#e67e22' },
  attendOut:   { fontSize: 12, fontWeight: '600', color: '#c0392b' },

  announcementCard: { backgroundColor: '#fff', borderRadius: 4, padding: 14, marginBottom: 8, borderLeftWidth: 3 },
  announcementText: { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  announcementMeta: { fontSize: 11, color: '#aaa', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { backgroundColor: '#fff', borderRadius: 4, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', letterSpacing: 1 },
  cardSub: { fontSize: 11, color: '#888', marginTop: 2 },
  arrow: { fontSize: 22, color: '#ccc' },
});
