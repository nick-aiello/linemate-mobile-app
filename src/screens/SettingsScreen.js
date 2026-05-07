import { useEffect, useState, useCallback } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput, ActionSheetIOS, Platform, Share } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

const APP_VERSION = '1.0.0';

const DIVISIONS = [
  'Sunday B East','Sunday B West',
  'Sunday C East','Sunday C West',
  'Sunday C North A','Sunday C North B',
  'Sunday C South A','Sunday C South B','Sunday C South C',
  'NTPRD Chiller Sunday D league',
  'Monday D - East','Monday D - West A','Monday D - West B',
  'Tue NTPRD Chiller B','Tuesday B West A','Tuesday B West B',
  'Wednesday B East','Wednesday B West A','Wednesday B West B',
  "Women's league",'Daytime League',
  'Thur NTPRD Chiller C','Thursday C East','Thursday C West','Thursday C North','Thursday C South',
  'Friday B',
];

const POSITIONS = [
  { key: 'c',  label: 'Center' },
  { key: 'lw', label: 'Left Wing' },
  { key: 'rw', label: 'Right Wing' },
  { key: 'ld', label: 'Left D' },
  { key: 'rd', label: 'Right D' },
  { key: 'g',  label: 'Goalie' },
];

const RSVP_OPTIONS = [
  { key: 'yes',   label: 'IN',    bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
  { key: 'no',    label: 'OUT',   bg: '#fdecea', color: '#c0392b', border: '#ef9a9a' },
  { key: 'maybe', label: 'MAYBE', bg: '#fff3e0', color: '#e67e22', border: '#ffcc80' },
];

function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  const palette = ['#e57373','#f06292','#ba68c8','#7986cb','#4fc3f7','#4db6ac','#aed581','#ff8a65','#a1887f'];
  return palette[h % palette.length];
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch(e) { return dateStr; }
}

function fmtTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function SectionHeader({ label }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Stepper({ value, min, max, onChange }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <Text style={[styles.stepBtnText, value <= min && { color: '#ccc' }]}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Text style={[styles.stepBtnText, value >= max && { color: '#ccc' }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function FieldRow({ label, children }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldRowLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen({ route, navigation }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [firstName] = useState(user?.firstName || '');
  const [lastName] = useState(user?.lastName || '');

  // ── Player data ────────────────────────────────────────────────────────────
  const [linkedPlayer, setLinkedPlayer] = useState(null); // { name, num }
  const [nextGame, setNextGame] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [preferredPosition, setPreferredPosition] = useState(null);
  const [savingPosition, setSavingPosition] = useState(false);

  // ── Team settings (admin only) ──────────────────────────────────────────────
  const [chillerTeamId, setChillerTeamId] = useState('');
  const [chillerInput, setChillerInput] = useState('');
  const [color, setColor] = useState('#c0392b');
  const [division, setDivision] = useState('');
  const [fwdLines, setFwdLines] = useState(3);
  const [defLines, setDefLines] = useState(2);
  const [jerseys, setJerseys] = useState([{ id: 'home', label: 'Black', color: '#1a1a1a' }, { id: 'away', label: 'White', color: '#ffffff' }]);
  const [loadingBrand, setLoadingBrand] = useState(isAdmin);
  const [savingBrand, setSavingBrand] = useState(false);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ── Sync ──────────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);

  const loadAll = useCallback(async () => {
    // Load player data from /me/profile
    api.myProfile().then(async data => {
      const teamData = (data?.teams || []).find(t => t.id === teamId);
      if (teamData) {
        setNextGame(teamData.nextGame || null);
        if (teamData.linkedPlayer) {
          setLinkedPlayer({ name: teamData.linkedPlayer.name, num: teamData.linkedPlayer.num });
          setRsvpStatus(teamData.linkedPlayer.rsvp || null);
          // Load preferred position from player profile
          try {
            const prof = await api.getPlayerProfile(teamId, teamData.linkedPlayer.name);
            setPreferredPosition(prof?.preferredPosition || null);
          } catch(e) {}
        }
      }
    }).catch(() => {});

    if (isAdmin) {
      setLoadingBrand(true);
      api.brand(teamId).then(b => {
        if (b) {
          setChillerTeamId(b.chillerTeamId || '');
          setColor(b.primaryColor || '#c0392b');
          setDivision(b.division || '');
          setFwdLines(b.fwdLines || 3);
          setDefLines(b.defLines || 2);
          setJerseys(b.jerseys || []);
        }
        setLoadingBrand(false);
      }).catch(() => setLoadingBrand(false));
    }
    api.getNotificationPrefs(teamId).then(setPrefs).catch(() => {});
  }, [teamId, isAdmin]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── RSVP ──────────────────────────────────────────────────────────────────
  async function handleRsvp(status) {
    if (!linkedPlayer) return;
    const prev = rsvpStatus;
    const next = status === rsvpStatus ? null : status; // tap same = clear
    setRsvpStatus(next);
    setRsvpSaving(true);
    try {
      await api.setAvailability(teamId, null, next);
    } catch(e) {
      setRsvpStatus(prev);
      Alert.alert('Error', 'Could not update RSVP.');
    } finally {
      setRsvpSaving(false);
    }
  }

  // ── Preferred position ───────────────────────────────────────────────────
  function pickPosition() {
    const options = ['— None —', ...POSITIONS.map(p => p.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Preferred Position', options, cancelButtonIndex: options.length - 1 },
      async i => {
        if (i === options.length - 1) return; // cancel
        const pos = i === 0 ? null : POSITIONS[i - 1].key;
        if (pos === preferredPosition) return;
        setPreferredPosition(pos);
        setSavingPosition(true);
        try {
          await api.savePlayerProfile(teamId, linkedPlayer.name, { preferredPosition: pos });
        } catch(e) {
          setPreferredPosition(preferredPosition);
          Alert.alert('Error', 'Could not save position.');
        } finally {
          setSavingPosition(false);
        }
      }
    );
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  async function updatePref(key, value) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSavingPrefs(true);
    await api.setNotificationPrefs(teamId, {
      lineupSet: updated.lineupSet !== false,
      gameReminder: updated.gameReminder !== false,
      chatMessages: updated.chatMessages !== false,
      mentions: updated.mentions !== false,
    }).catch(() => {});
    setSavingPrefs(false);
  }

  // ── Team settings (admin only) ────────────────────────────────────────────
  function pickDivision() {
    const options = ['— None —', ...DIVISIONS, 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Division', options, cancelButtonIndex: options.length - 1 },
      i => {
        if (i === 0) setDivision('');
        else if (i < options.length - 1) setDivision(DIVISIONS[i - 1]);
      }
    );
  }

  function updateJersey(id, field, value) {
    setJerseys(prev => prev.map(j => j.id === id ? { ...j, [field]: value } : j));
  }

  async function handleSaveBrand() {
    setSavingBrand(true);
    try {
      const payload = { primaryColor: color, fwdLines, defLines, division, jerseys };
      const input = chillerInput.trim();
      if (input) payload.chillerUrl = input;
      const result = await api.saveBrand(teamId, payload);
      await loadAll();
      setChillerInput('');
      Alert.alert('Saved', result.chillerTeamId ? 'Team settings saved.' : 'Saved. Note: ChillerStats is not configured.');
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to save settings.');
    } finally {
      setSavingBrand(false);
    }
  }

  async function handleInvite() {
    try {
      const { url } = await api.generateInvite(teamId);
      await Share.share({ message: `Join our team on Linemate! ${url}`, url });
    } catch(e) {
      if (e.message !== 'The user did not share') {
        Alert.alert('Error', e.message || 'Could not generate invite link.');
      }
    }
  }

  async function handleSync() {
    if (!chillerTeamId) {
      Alert.alert('Not Configured', 'Enter your ChillerStats URL below and save first.');
      return;
    }
    setSyncing(true);
    try {
      await api.sync(teamId);
      Alert.alert('Synced', 'Roster and schedule updated from ChillerStats.');
    } catch(e) {
      Alert.alert('Sync Failed', e.message || 'Could not sync from ChillerStats.');
    } finally {
      setSyncing(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || user?.email || '';
  const initials = displayName.replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const avatarColor = nameColor(displayName || user?.email || '');
  const positionLabel = preferredPosition ? (POSITIONS.find(p => p.key === preferredPosition)?.label || null) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Profile card ── */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileCardMeta}>
          <View style={styles.profileCardNameRow}>
            <Text style={styles.profileCardName}>{displayName || 'Set your name'}</Text>
            {linkedPlayer?.num ? (
              <View style={[styles.jerseyBadge, { backgroundColor: primaryColor + '18', borderColor: primaryColor + '44' }]}>
                <Text style={[styles.jerseyBadgeText, { color: primaryColor }]}>#{linkedPlayer.num}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.profileCardEmail}>{user?.email || ''}</Text>
          {positionLabel ? (
            <Text style={styles.positionLabel}>{positionLabel}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.editProfileBtn, { borderColor: primaryColor }]}
          onPress={() => navigation.navigate('PlayerProfile', { teamId, primaryColor })}
          activeOpacity={0.75}
        >
          <Text style={[styles.editProfileBtnText, { color: primaryColor }]}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ── RSVP widget ── */}
      {nextGame && (
        <>
          <SectionHeader label="Next Game" />
          <View style={styles.card}>
            <View style={styles.rsvpGameRow}>
              <Text style={styles.rsvpOpponent}>{nextGame.isHome === false ? '@ ' : 'vs. '}{nextGame.opponent}</Text>
              <Text style={styles.rsvpGameDate}>{fmtDate(nextGame.date)}{nextGame.time ? '  ·  ' + fmtTime(nextGame.time) : ''}</Text>
              {nextGame.rink ? <Text style={styles.rsvpRink}>{nextGame.rink}</Text> : null}
            </View>
            {linkedPlayer ? (
              <View style={styles.rsvpBtnRow}>
                {RSVP_OPTIONS.map(opt => {
                  const active = rsvpStatus === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.rsvpBtn, active && { backgroundColor: opt.bg, borderColor: opt.border }]}
                      onPress={() => handleRsvp(opt.key)}
                      disabled={rsvpSaving}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.rsvpBtnText, active && { color: opt.color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
                {rsvpSaving && <ActivityIndicator size="small" color={primaryColor} style={{ marginLeft: 8 }} />}
              </View>
            ) : (
              <Text style={styles.hint}>Link your player profile to RSVP</Text>
            )}
          </View>
        </>
      )}

      {/* ── Player settings ── */}
      {linkedPlayer && (
        <>
          <SectionHeader label="Player" />
          <View style={styles.card}>
            <TouchableOpacity onPress={Platform.OS === 'ios' ? pickPosition : undefined} disabled={savingPosition}>
              <FieldRow label="Preferred Position">
                <View style={styles.divisionBtn}>
                  <Text style={[styles.divisionText, !preferredPosition && { color: '#bbb' }]} numberOfLines={1}>
                    {positionLabel || 'Not set'}
                  </Text>
                  {savingPosition
                    ? <ActivityIndicator size="small" color={primaryColor} />
                    : <Text style={styles.chevron}>›</Text>}
                </View>
              </FieldRow>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Team Settings (admin only) ── */}
      {isAdmin && (
        <>
          <SectionHeader label="Team Settings" />
          {loadingBrand ? (
            <View style={[styles.card, { alignItems: 'center' }]}>
              <ActivityIndicator color={primaryColor} />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>ChillerStats</Text>
              {chillerTeamId ? (
                <View style={styles.configuredRow}>
                  <View style={styles.configuredDot} />
                  <Text style={styles.configuredText}>Configured</Text>
                  <Text style={styles.configuredId}>{chillerTeamId.slice(0, 12)}...</Text>
                </View>
              ) : (
                <Text style={styles.hint}>Not configured</Text>
              )}
              <TextInput
                style={styles.urlInput}
                placeholder={chillerTeamId ? 'Paste URL to update ChillerStats ID' : 'Paste chillerstats.com team URL'}
                placeholderTextColor="#bbb"
                value={chillerInput}
                onChangeText={setChillerInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <Divider />
              <FieldRow label="Primary Color">
                <View style={styles.colorRow}>
                  <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                  <TextInput
                    style={styles.colorInput}
                    value={color}
                    onChangeText={setColor}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={7}
                    placeholder="#c0392b"
                    placeholderTextColor="#bbb"
                  />
                </View>
              </FieldRow>

              <Divider />
              <FieldRow label="Division">
                <TouchableOpacity onPress={Platform.OS === 'ios' ? pickDivision : undefined} style={styles.divisionBtn}>
                  <Text style={[styles.divisionText, !division && { color: '#bbb' }]} numberOfLines={1}>
                    {division || 'Select division'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              </FieldRow>

              <Divider />
              <FieldRow label="Forward Lines">
                <Stepper value={fwdLines} min={2} max={4} onChange={setFwdLines} />
              </FieldRow>

              <Divider />
              <FieldRow label="Defense Lines">
                <Stepper value={defLines} min={2} max={3} onChange={setDefLines} />
              </FieldRow>

              <Divider />
              <Text style={[styles.label, { marginBottom: 8 }]}>Jerseys</Text>
              {jerseys.map(j => (
                <View key={j.id} style={styles.jerseyEditRow}>
                  <Text style={styles.jerseyIdLabel}>{j.id.charAt(0).toUpperCase() + j.id.slice(1)}</Text>
                  <View style={[styles.jerseyColorSwatch, { backgroundColor: j.color || '#1a1a1a' }]} />
                  <TextInput
                    style={styles.jerseyColorInput}
                    value={j.color || ''}
                    onChangeText={v => updateJersey(j.id, 'color', v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={7}
                    placeholder="#1a1a1a"
                    placeholderTextColor="#bbb"
                  />
                  <TextInput
                    style={styles.jerseyLabelInput}
                    value={j.label || ''}
                    onChangeText={v => updateJersey(j.id, 'label', v)}
                    placeholder="e.g. Black"
                    placeholderTextColor="#bbb"
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primaryColor }]}
                onPress={handleSaveBrand}
                disabled={savingBrand}
              >
                {savingBrand
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Save Team Settings</Text>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ── Notifications ── */}
      <SectionHeader label={savingPrefs ? 'Notifications  ·  saving...' : 'Notifications'} />
      <View style={styles.card}>
        {prefs ? (
          <>
            <FieldRow label="Lineup set">
              <Switch value={!!prefs.lineupSet} onValueChange={v => updatePref('lineupSet', v)} trackColor={{ true: primaryColor }} />
            </FieldRow>
            <Divider />
            <FieldRow label="Game reminders">
              <Switch value={!!prefs.gameReminder} onValueChange={v => updatePref('gameReminder', v)} trackColor={{ true: primaryColor }} />
            </FieldRow>
            <Divider />
            <FieldRow label="Chat messages">
              <Switch value={!!prefs.chatMessages} onValueChange={v => updatePref('chatMessages', v)} trackColor={{ true: primaryColor }} />
            </FieldRow>
            <Divider />
            <FieldRow label="Mentions">
              <Switch value={!!prefs.mentions} onValueChange={v => updatePref('mentions', v)} trackColor={{ true: primaryColor }} />
            </FieldRow>
          </>
        ) : (
          <ActivityIndicator color={primaryColor} />
        )}
      </View>

      {/* ── Team (admin only) ── */}
      {isAdmin && (
        <>
          <SectionHeader label="Team" />
          <View style={styles.card}>
            <TouchableOpacity onPress={handleInvite}>
              <FieldRow label="Invite Players">
                <Text style={[styles.syncArrow, { color: primaryColor }]}>↗</Text>
              </FieldRow>
            </TouchableOpacity>
            <Text style={styles.hint}>Generate a link players can use to sign up</Text>
            <Divider />
            <TouchableOpacity onPress={handleSync} disabled={syncing}>
              <FieldRow label="Sync from ChillerStats">
                {syncing
                  ? <ActivityIndicator size="small" color={primaryColor} />
                  : <Text style={[styles.syncArrow, { color: primaryColor }]}>↻</Text>}
              </FieldRow>
            </TouchableOpacity>
            <Text style={styles.hint}>Updates roster and schedule</Text>
          </View>
        </>
      )}

      {/* ── Sign Out ── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.6}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Linemate · v{APP_VERSION}</Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { padding: 16, paddingBottom: 48 },

  sectionHeader: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginTop: 20 },
  card: { backgroundColor: '#fff', borderRadius: 4, padding: 14 },
  divider: { height: 1, backgroundColor: '#f0ede8', marginVertical: 2 },

  // Profile card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  profileCardMeta: { flex: 1 },
  profileCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileCardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  jerseyBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  jerseyBadgeText: { fontSize: 11, fontWeight: '700' },
  profileCardEmail: { fontSize: 12, color: '#aaa', marginTop: 2 },
  positionLabel: { fontSize: 11, color: '#888', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  editProfileBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editProfileBtnText: { fontSize: 13, fontWeight: '700' },

  // RSVP
  rsvpGameRow: { marginBottom: 12 },
  rsvpOpponent: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  rsvpGameDate: { fontSize: 12, color: '#888' },
  rsvpRink: { fontSize: 11, color: '#bbb', marginTop: 2 },
  rsvpBtnRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rsvpBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e0ddd8',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  rsvpBtnText: { fontSize: 12, fontWeight: '700', color: '#aaa', letterSpacing: 0.5 },

  // misc
  label: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  hint: { fontSize: 11, color: '#bbb', marginBottom: 6 },

  // Team settings
  configuredRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  configuredDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2e7d32' },
  configuredText: { fontSize: 12, color: '#2e7d32', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  configuredId: { fontSize: 11, color: '#aaa', fontFamily: 'Courier' },
  urlInput: { borderWidth: 1, borderColor: '#e0ddd8', borderRadius: 4, padding: 10, fontSize: 11, color: '#1a1a1a', marginBottom: 4 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  fieldRowLabel: { fontSize: 14, color: '#1a1a1a', flex: 1 },
  chevron: { fontSize: 16, color: '#ccc' },

  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorSwatch: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: '#e0ddd8' },
  colorInput: { borderWidth: 1, borderColor: '#e0ddd8', borderRadius: 4, padding: 6, fontSize: 13, color: '#1a1a1a', width: 90, textAlign: 'center' },

  divisionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 180 },
  divisionText: { fontSize: 13, color: '#1a1a1a', flex: 1, textAlign: 'right' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: '#e0ddd8', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 18, color: '#1a1a1a', lineHeight: 22 },
  stepValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', minWidth: 20, textAlign: 'center' },

  jerseyEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  jerseyIdLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, width: 36 },
  jerseyColorSwatch: { width: 22, height: 22, borderRadius: 3, borderWidth: 1, borderColor: '#e0ddd8', flexShrink: 0 },
  jerseyColorInput: { width: 72, borderWidth: 1, borderColor: '#e0ddd8', borderRadius: 3, padding: 6, fontSize: 12, color: '#1a1a1a', textAlign: 'center' },
  jerseyLabelInput: { flex: 1, borderWidth: 1, borderColor: '#e0ddd8', borderRadius: 3, padding: 6, fontSize: 13, color: '#1a1a1a' },

  saveBtn: { marginTop: 4, borderRadius: 4, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  syncArrow: { fontSize: 22, fontWeight: '700' },

  signOutBtn: { marginTop: 28, paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: '#c0392b', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  versionText: { textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 8, marginBottom: 8 },
});
