import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal,
  TouchableWithoutFeedback, FlatList, Image,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

const AVATAR_PALETTE = [
  '#e57373', '#f06292', '#ba68c8', '#7986cb',
  '#4fc3f7', '#4db6ac', '#81c784', '#ff8a65', '#a1887f',
];

const RSVP = {
  yes:   { label: 'IN',    bg: '#e8f5e9', color: '#2e7d32' },
  no:    { label: 'OUT',   bg: '#fdecea', color: '#c0392b' },
  maybe: { label: 'MAYBE', bg: '#fff3e0', color: '#e67e22' },
};

const POSITION_LABELS = {
  lw: 'Left Wing', c: 'Center', rw: 'Right Wing',
  ld: 'Left D', rd: 'Right D', g: 'Goalie',
};

function slotLabel(slot) {
  if (!slot) return null;
  const m = slot.match(/^([a-z]+)(\d+)$/);
  if (!m || !POSITION_LABELS[m[1]]) return null;
  if (m[1] === 'g') return 'Goalie';
  const lineType = (m[1] === 'ld' || m[1] === 'rd') ? 'Pair' : 'Line';
  return `${lineType} ${parseInt(m[2])} · ${POSITION_LABELS[m[1]]}`;
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

function nameColorDefault(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export default function ProfileScreen({ route, navigation }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const { refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [chosenColor, setChosenColor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bioByTeam, setBioByTeam] = useState({});

  // Change password
  const [showPwd, setShowPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  // Link flow
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTeamId, setLinkTeamId] = useState(null);
  const [rosterForLink, setRosterForLink] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [chillerUrl, setChillerUrl] = useState('');
  const [linking, setLinking] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.myProfile();
      setProfile(data);
      setFirstName(data.firstName || '');
      setLastName(data.lastName || '');
      setChosenColor(data.avatarColor || null);
      setAvatarUrl(data.avatarUrl || null);
      // Bio by team (returned in profile response)
      const bios = {};
      data.teams.forEach(t => { if (t.linkedPlayer) bios[t.id] = t.bio || ''; });
      setBioByTeam(bios);
      // Load phone from first linked player profile
      const linked = data.teams.find(t => t.linkedPlayer);
      if (linked?.linkedPlayer) {
        const p = await api.getPlayerProfile(linked.id, linked.linkedPlayer.name).catch(() => ({}));
        setPhone(p.phone || '');
      }
    } catch(e) {
      Alert.alert('Error', 'Could not load profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarColor: chosenColor,
      });
      // Save phone + bio to all linked player profiles
      if (profile) {
        await Promise.all(
          profile.teams
            .filter(t => t.linkedPlayer)
            .map(t => Promise.all([
              api.savePlayerProfile(t.id, t.linkedPlayer.name, { phone: phone.trim() }).catch(() => {}),
              api.saveBio(t.id, bioByTeam[t.id] || '').catch(() => {}),
            ]))
        );
      }
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePickAvatar() {
    // Requires native rebuild — dynamically load to avoid crash on JS-only builds
    try {
      const ImagePicker = await import('expo-image-picker');
      const ImageManipulator = await import('expo-image-manipulator');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      setUploadingAvatar(true);
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const { avatarUrl: url } = await api.uploadAvatar(compressed.base64, 'image/jpeg');
      setAvatarUrl(url);
      await refreshUser();
    } catch(e) {
      if (e.message?.includes('native module')) {
        Alert.alert('Coming soon', 'Profile photos require an app update. Check back soon!');
      } else {
        Alert.alert('Error', 'Could not upload photo.');
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPwd || !newPwd) return Alert.alert('Missing fields', 'Fill in all password fields.');
    if (newPwd !== confirmPwd) return Alert.alert('Mismatch', 'New passwords do not match.');
    if (newPwd.length < 8) return Alert.alert('Too short', 'Password must be at least 8 characters.');
    setSavingPwd(true);
    try {
      await api.changePassword(currentPwd, newPwd);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setShowPwd(false);
      Alert.alert('Done', 'Password updated.');
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to change password.');
    } finally {
      setSavingPwd(false);
    }
  }

  async function openLinkModal(tid) {
    setLinkTeamId(tid);
    setRosterSearch('');
    setChillerUrl('');
    setShowUrlInput(false);
    setShowLinkModal(true);
    setLoadingRoster(true);
    try {
      const data = await api.roster(tid);
      const players = (data || []).filter(p => p.name || (Array.isArray(p) && p[1]))
        .map(p => Array.isArray(p) ? { num: p[0], name: p[1] } : p)
        .filter(p => p.name);
      setRosterForLink(players);
    } catch(e) {
      setRosterForLink([]);
    } finally {
      setLoadingRoster(false);
    }
  }

  async function handleLinkPlayer(playerName) {
    setLinking(true);
    try {
      await api.linkPlayer(linkTeamId, playerName);
      setShowLinkModal(false);
      await load();
    } catch(e) {
      Alert.alert('Error', e.message || 'Could not link player.');
    } finally {
      setLinking(false);
    }
  }

  async function handleLinkChillerUrl() {
    if (!chillerUrl.trim()) return;
    setLinking(true);
    try {
      await api.linkChillerUrl(chillerUrl.trim());
      setShowLinkModal(false);
      await load();
    } catch(e) {
      Alert.alert('Error', e.message || 'Could not find a PlayerID in that URL.');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(tid) {
    Alert.alert('Unlink', 'Remove your link to this roster player?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: async () => {
        await api.unlinkPlayer(tid).catch(() => {});
        await load();
      }},
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={primaryColor} size="large" /></View>;
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || profile?.email || '';
  const initials = displayName.replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const avatarColor = chosenColor || nameColorDefault(displayName);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
    >
      {/* ── Hero — neutral, player-centric ── */}
      <View style={styles.hero}>
        <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.heroAvatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={[styles.heroAvatar, { backgroundColor: avatarColor }]} />
          ) : (
            <View style={[styles.heroAvatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.heroAvatarText}>{initials}</Text>
            </View>
          )}
          {uploadingAvatar
            ? <View style={styles.avatarOverlay}><ActivityIndicator color="#fff" /></View>
            : <View style={styles.avatarEditBadge}><Text style={styles.avatarEditIcon}>✎</Text></View>}
        </TouchableOpacity>
        <Text style={styles.heroName}>{displayName || 'Tap avatar to add photo'}</Text>
        {profile?.email ? <Text style={styles.heroEmail}>{profile.email}</Text> : null}
        <Text style={styles.heroTeamCount}>
          {profile?.teams.length === 1 ? '1 team' : `${profile?.teams.length || 0} teams`}
        </Text>
      </View>

      {/* ── Per-team cards ── */}
      {profile?.teams.map(team => {
        const lp = team.linkedPlayer;
        const color = team.primaryColor || '#c0392b';
        return (
          <View key={team.id} style={[styles.teamCard, { borderLeftColor: color }]}>
            {/* Team header */}
            <View style={styles.teamCardHeader}>
              <View style={[styles.teamColorBar, { backgroundColor: color }]} />
              <View style={styles.teamCardTitles}>
                <Text style={styles.teamCardName}>{team.name}</Text>
                {team.division ? <Text style={styles.teamCardDiv}>{team.division}</Text> : null}
              </View>
              {lp?.num ? <Text style={[styles.teamJersey, { color }]}>#{lp.num}</Text> : null}
            </View>

            {/* Stats */}
            {lp?.stats && lp.stats.gp > 0 && (
              <>
                <View style={styles.statsRow}>
                  {[['GP', lp.stats.gp], ['G', lp.stats.g], ['A', lp.stats.a], ['PTS', lp.stats.pts], ['PIM', lp.stats.pim]].map(([lbl, val]) => (
                    <View key={lbl} style={styles.statBox}>
                      <Text style={[styles.statVal, { color }]}>{val || 0}</Text>
                      <Text style={styles.statLbl}>{lbl}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.statsMeta}>
                  {lp.ppg != null && (
                    <View style={[styles.statMetaPill, { backgroundColor: color + '18' }]}>
                      <Text style={[styles.statMetaText, { color }]}>{lp.ppg} PPG</Text>
                    </View>
                  )}
                  {lp.teamRank != null && (
                    <View style={[styles.statMetaPill, { backgroundColor: color + '18' }]}>
                      <Text style={[styles.statMetaText, { color }]}>#{lp.teamRank} of {lp.teamRankOf} on team</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Lineup */}
            {lp && (
              <View style={styles.teamCardRow}>
                <Text style={styles.teamCardRowLabel}>Lineup</Text>
                {lp.lineupIsSet && lp.lineupSlot ? (
                  <Text style={[styles.teamCardRowValue, { color }]}>{slotLabel(lp.lineupSlot)}</Text>
                ) : (
                  <Text style={styles.teamCardRowMuted}>{lp.lineupIsSet ? 'Not in lineup' : 'Not set yet'}</Text>
                )}
              </View>
            )}

            {/* Next game */}
            {team.nextGame && (
              <View style={styles.teamCardRow}>
                <Text style={styles.teamCardRowLabel}>Next Game</Text>
                <View style={styles.teamCardRowRight}>
                  <Text style={styles.teamCardRowValue}>vs {team.nextGame.opponent || 'TBD'}</Text>
                  <Text style={styles.teamCardRowMuted}>
                    {fmtDate(team.nextGame.date)}{team.nextGame.time ? '  ·  ' + fmtTime(team.nextGame.time) : ''}
                  </Text>
                  {lp?.rsvp && RSVP[lp.rsvp] && (
                    <View style={[styles.rsvpPill, { backgroundColor: RSVP[lp.rsvp].bg, marginTop: 4 }]}>
                      <Text style={[styles.rsvpPillText, { color: RSVP[lp.rsvp].color }]}>{RSVP[lp.rsvp].label}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Recent games */}
            {lp?.recentGames?.length > 0 && (
              <View style={[styles.teamCardRow, { alignItems: 'flex-start' }]}>
                <Text style={styles.teamCardRowLabel}>Recent</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  {lp.recentGames.map((g, i) => (
                    <View key={i} style={styles.recentGameRow}>
                      <Text style={styles.recentGameDate}>{fmtDate(g.date)}</Text>
                      <Text style={styles.recentGameOpp}>vs {g.opponent || 'TBD'}</Text>
                      {g.score ? <Text style={styles.recentGameScore}>{g.score}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Team adoption count */}
            {team.teamOnApp > 0 && (
              <View style={styles.teamCardRow}>
                <Text style={styles.teamCardRowLabel}>On App</Text>
                <Text style={styles.teamCardRowMuted}>{team.teamOnApp} teammate{team.teamOnApp !== 1 ? 's' : ''} using Linemate</Text>
              </View>
            )}

            {/* Link / unlink row */}
            <View style={styles.teamCardDivider} />
            {!lp ? (
              <TouchableOpacity style={styles.teamLinkRow} onPress={() => openLinkModal(team.id)} activeOpacity={0.7}>
                <Text style={styles.teamLinkPrompt}>Link your roster spot</Text>
                <Text style={[styles.teamLinkAction, { color }]}>Link me →</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.teamLinkRow}>
                <Text style={styles.teamLinkedAs}>Linked as {lp.name}</Text>
                <TouchableOpacity onPress={() => handleUnlink(team.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.unlinkBtn}>Unlink</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* ── Edit profile ── */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Edit Profile</Text>

        {/* Avatar color picker */}
        <Text style={styles.fieldLabel}>Avatar Color</Text>
        <View style={styles.palette}>
          {AVATAR_PALETTE.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.paletteSwatch, { backgroundColor: c }, chosenColor === c && styles.paletteSwatchSelected]}
              onPress={() => setChosenColor(c)}
            />
          ))}
          {/* Option to reset to name-derived */}
          <TouchableOpacity
            style={[styles.paletteSwatch, styles.paletteSwatchAuto, !chosenColor && styles.paletteSwatchSelected]}
            onPress={() => setChosenColor(null)}
          >
            <Text style={styles.paletteAutoText}>Auto</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>First Name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First"
          placeholderTextColor="#bbb"
          autoCorrect={false}
        />

        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Last Name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last"
          placeholderTextColor="#bbb"
          autoCorrect={false}
        />

        {profile?.teams.some(t => t.linkedPlayer) && (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(614) 555-0100"
              placeholderTextColor="#bbb"
              keyboardType="phone-pad"
            />
            {profile.teams.filter(t => t.linkedPlayer).map(t => (
              <View key={t.id}>
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
                  Bio{profile.teams.filter(t2 => t2.linkedPlayer).length > 1 ? ` · ${t.name}` : ''}
                </Text>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={bioByTeam[t.id] || ''}
                  onChangeText={val => setBioByTeam(prev => ({ ...prev, [t.id]: val }))}
                  placeholder="A little about yourself as a player..."
                  placeholderTextColor="#bbb"
                  multiline
                  maxLength={500}
                />
                <Text style={styles.bioCount}>{(bioByTeam[t.id] || '').length}/500</Text>
              </View>
            ))}
          </>
        )}

        {/* Change password */}
        <TouchableOpacity
          style={styles.pwdToggleRow}
          onPress={() => setShowPwd(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.pwdToggleText}>Change Password</Text>
          <Text style={styles.pwdToggleChevron}>{showPwd ? '∧' : '›'}</Text>
        </TouchableOpacity>
        {showPwd && (
          <View style={styles.pwdSection}>
            <TextInput style={styles.input} value={currentPwd} onChangeText={setCurrentPwd} placeholder="Current password" placeholderTextColor="#bbb" secureTextEntry />
            <TextInput style={[styles.input, { marginTop: 8 }]} value={newPwd} onChangeText={setNewPwd} placeholder="New password (8+ chars)" placeholderTextColor="#bbb" secureTextEntry />
            <TextInput style={[styles.input, { marginTop: 8 }]} value={confirmPwd} onChangeText={setConfirmPwd} placeholder="Confirm new password" placeholderTextColor="#bbb" secureTextEntry />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#555', marginTop: 10 }]}
              onPress={handleChangePassword}
              disabled={savingPwd}
            >
              {savingPwd
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        )}

        {saved && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: primaryColor }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Link Modal ── */}
      <Modal visible={showLinkModal} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => !linking && setShowLinkModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Which player are you?</Text>
                <Text style={styles.modalSub}>
                  Find your name on the roster below, or paste your ChillerStats profile URL.
                </Text>

                {/* Search */}
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search players..."
                    placeholderTextColor="#bbb"
                    value={rosterSearch}
                    onChangeText={setRosterSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {loadingRoster ? (
                  <ActivityIndicator color={primaryColor} style={{ marginTop: 20 }} />
                ) : (
                  <FlatList
                    data={rosterForLink.filter(p =>
                      !rosterSearch || p.name.toLowerCase().includes(rosterSearch.toLowerCase())
                    )}
                    keyExtractor={p => p.name}
                    style={styles.rosterList}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <Text style={styles.rosterEmpty}>No players match your search.</Text>
                    }
                    ItemSeparatorComponent={() => <View style={styles.rosterSep} />}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.rosterRow}
                        onPress={() => handleLinkPlayer(item.name)}
                        disabled={linking}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.rosterNum, { backgroundColor: (profile?.teams.find(t => t.id === linkTeamId)?.primaryColor || primaryColor) + '18' }]}>
                          <Text style={[styles.rosterNumText, { color: profile?.teams.find(t => t.id === linkTeamId)?.primaryColor || primaryColor }]}>
                            {item.num || '—'}
                          </Text>
                        </View>
                        <Text style={styles.rosterName}>{item.name}</Text>
                        <Text style={styles.rosterArrow}>›</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}

                {/* ChillerStats URL alternative */}
                <TouchableOpacity
                  style={styles.urlToggle}
                  onPress={() => setShowUrlInput(v => !v)}
                >
                  <Text style={[styles.urlToggleText, { color: primaryColor }]}>
                    {showUrlInput ? 'Hide URL input' : "Can't find yourself? Paste your ChillerStats URL"}
                  </Text>
                </TouchableOpacity>

                {showUrlInput && (
                  <View style={styles.urlSection}>
                    <TextInput
                      style={styles.urlInput}
                      placeholder="https://chillerstats.com/team/player_history.cfm?..."
                      placeholderTextColor="#bbb"
                      value={chillerUrl}
                      onChangeText={setChillerUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <TouchableOpacity
                      style={[styles.urlBtn, { backgroundColor: primaryColor }]}
                      onPress={handleLinkChillerUrl}
                      disabled={linking || !chillerUrl.trim()}
                    >
                      {linking
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.urlBtnText}>Link by ChillerStats ID</Text>}
                    </TouchableOpacity>
                    <Text style={styles.urlHint}>
                      Go to chillerstats.com, find your player page or player history page, and copy the URL from your browser. Works with both player.cfm and player_history.cfm links.
                    </Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero — neutral
  hero: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: '#1a1a1a',
    gap: 4,
  },
  heroAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroAvatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  heroAvatarWrap: { position: 'relative', marginBottom: 10 },
  avatarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: { color: '#fff', fontSize: 12 },
  heroName: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  heroEmail: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  heroTeamCount: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, letterSpacing: 0.5 },

  // Generic card (edit section)
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 10, padding: 16 },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 14 },

  // Per-team card
  teamCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  teamColorBar: { width: 4, height: 28, borderRadius: 2, flexShrink: 0 },
  teamCardTitles: { flex: 1 },
  teamCardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  teamCardDiv: { fontSize: 12, color: '#aaa', marginTop: 1 },
  teamJersey: { fontSize: 18, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 },
  statBox: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 22, fontWeight: '700' },
  statLbl: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },

  // Team card rows (lineup, next game)
  teamCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f2ec',
  },
  teamCardRowLabel: { fontSize: 10, fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, width: 70, marginTop: 2 },
  teamCardRowRight: { flex: 1 },
  teamCardRowValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  teamCardRowMuted: { fontSize: 13, color: '#aaa', flex: 1 },

  // RSVP pill
  rsvpPill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  rsvpPillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Team card link row
  teamCardDivider: { height: 1, backgroundColor: '#f5f2ec', marginTop: 4 },
  teamLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  teamLinkPrompt: { fontSize: 13, color: '#aaa' },
  teamLinkAction: { fontSize: 13, fontWeight: '700' },
  teamLinkedAs: { fontSize: 13, color: '#888', fontWeight: '500' },

  // Edit section
  fieldLabel: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: '#f8f7f5',
    borderWidth: 1,
    borderColor: '#e0ddd8',
    borderRadius: 6,
    padding: 11,
    fontSize: 15,
    color: '#1a1a1a',
  },
  savedBadge: { backgroundColor: '#e8f5e9', borderRadius: 6, padding: 8, marginTop: 12, alignItems: 'center' },
  savedText: { fontSize: 12, color: '#2e7d32', fontWeight: '700', letterSpacing: 0.5 },
  saveBtn: { borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Palette
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  paletteSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  paletteSwatchSelected: {
    borderColor: '#1a1a1a',
  },
  paletteSwatchAuto: {
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteAutoText: { fontSize: 9, color: '#888', fontWeight: '700' },

  unlinkBtn: { fontSize: 13, color: '#e57373', fontWeight: '600' },

  // Stats meta (PPG, rank)
  statsMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  statMetaPill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statMetaText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  // Recent games
  recentGameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  recentGameDate: { fontSize: 12, color: '#aaa', width: 80 },
  recentGameOpp: { fontSize: 13, color: '#1a1a1a', flex: 1 },
  recentGameScore: { fontSize: 12, fontWeight: '600', color: '#555' },

  // Bio
  bioInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  bioCount: { fontSize: 11, color: '#ccc', textAlign: 'right', marginTop: 4 },

  // Change password
  pwdToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginTop: 6, borderTopWidth: 1, borderTopColor: '#f0ede8' },
  pwdToggleText: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  pwdToggleChevron: { fontSize: 16, color: '#ccc' },
  pwdSection: { paddingTop: 4, gap: 0 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0ddd8',
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#888', lineHeight: 19, marginBottom: 14 },

  // Search
  searchRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f2ec',
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  searchInput: { flex: 1, height: 40, fontSize: 14, color: '#1a1a1a' },

  // Roster list
  rosterList: { maxHeight: 280 },
  rosterEmpty: { textAlign: 'center', color: '#bbb', fontSize: 13, paddingVertical: 20 },
  rosterSep: { height: 1, backgroundColor: '#f0ede8' },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  rosterNum: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rosterNumText: { fontSize: 13, fontWeight: '700' },
  rosterName: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  rosterArrow: { fontSize: 20, color: '#ccc' },

  // ChillerStats URL input
  urlToggle: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  urlToggleText: { fontSize: 13, fontWeight: '600' },
  urlSection: { marginTop: 8, gap: 10 },
  urlInput: {
    backgroundColor: '#f5f2ec',
    borderWidth: 1,
    borderColor: '#e0ddd8',
    borderRadius: 8,
    padding: 11,
    fontSize: 13,
    color: '#1a1a1a',
  },
  urlBtn: { borderRadius: 8, padding: 12, alignItems: 'center' },
  urlBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  urlHint: { fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: 16 },
});
