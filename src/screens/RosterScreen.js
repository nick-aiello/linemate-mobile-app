import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';

// ─── Sub Requests ────────────────────────────────────────────────────────────

function SubRequestCard({ sub, onFill, onCancel, currentUserId }) {
  const isOwner = sub.userId === currentUserId || sub.createdBy === currentUserId;
  return (
    <View style={styles.subCard}>
      <View style={styles.subInfo}>
        <Text style={styles.subPlayer}>{sub.playerName}</Text>
        {sub.game && <Text style={styles.subGame}>{sub.game.date} vs {sub.game.opponent}</Text>}
        {sub.message && <Text style={styles.subMessage}>{sub.message}</Text>}
        <Text style={styles.subMeta}>Posted by {sub.createdBy || 'Unknown'}</Text>
      </View>
      <View style={styles.subActions}>
        <TouchableOpacity style={styles.fillButton} onPress={() => onFill(sub.id)}>
          <Text style={styles.fillText}>I'll sub</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => onCancel(sub.id)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  const palette = ['#e57373','#f06292','#ba68c8','#7986cb','#4fc3f7','#4db6ac','#aed581','#ff8a65','#a1887f'];
  return palette[h % palette.length];
}

// ─── Player Profile Modal ─────────────────────────────────────────────────────

function ProfileModal({ player, teamId, primaryColor, onClose, availabilityMap }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hasAccount, setHasAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getPlayerProfile(teamId, player.name).then(p => {
      setEmail(p.email || '');
      setPhone(p.phone || '');
      setHasAccount(!!p.hasAccount);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.savePlayerProfile(teamId, player.name, { email, phone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  const stats = player.stats;
  const avStatus = availabilityMap?.[player.name];
  const avConfig = { yes: { label: 'IN', bg: '#e8f5e9', color: '#2e7d32' }, no: { label: 'OUT', bg: '#fdecea', color: '#c0392b' }, maybe: { label: 'MAYBE', bg: '#fff3e0', color: '#e67e22' } }[avStatus];

  const initials = player.name.split(' ').slice(0, 2).map(w => w[0]).join('');
  const avatarColor = nameColor(player.name);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.profileContainer}>
          {/* Header */}
          <View style={styles.profileHeader}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose}><Text style={[styles.profileDone, { color: primaryColor }]}>Done</Text></TouchableOpacity>
          </View>

          {/* Avatar + name hero */}
          <View style={styles.profileHero}>
            <View style={[styles.profileAvatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.profileAvatarText}>{initials}</Text>
            </View>
            <View style={styles.profileHeroInfo}>
              <Text style={styles.profileName}>{player.name}</Text>
              {player.num ? <Text style={[styles.profileNum, { color: primaryColor }]}>#{player.num}</Text> : null}
            </View>
            <View style={styles.profileHeroBadges}>
              {avConfig && (
                <View style={[styles.profileAvBadge, { backgroundColor: avConfig.bg }]}>
                  <Text style={[styles.profileAvBadgeText, { color: avConfig.color }]}>{avConfig.label}</Text>
                </View>
              )}
              {player.isSub && (
                <View style={styles.profileSubBadge}>
                  <Text style={styles.profileSubBadgeText}>SUB</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats */}
          {stats && stats.gp > 0 && (
            <View style={styles.profileStats}>
              {[['GP', stats.gp], ['G', stats.g], ['A', stats.a], ['PTS', stats.pts], ['PIM', stats.pim]].map(([lbl, val]) => (
                <View key={lbl} style={styles.profileStat}>
                  <Text style={styles.profileStatVal}>{val || 0}</Text>
                  <Text style={styles.profileStatLbl}>{lbl}</Text>
                </View>
              ))}
            </View>
          )}

          {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 24 }} /> : (
            <ScrollView contentContainerStyle={styles.profileBody}>
              {/* Account status */}
              <View style={[styles.accountStatusRow, { backgroundColor: hasAccount ? '#e8f5e9' : '#f5f5f5' }]}>
                <View style={[styles.accountStatusDot, { backgroundColor: hasAccount ? '#2e7d32' : '#ccc' }]} />
                <Text style={[styles.accountStatusText, { color: hasAccount ? '#2e7d32' : '#999' }]}>
                  {hasAccount ? 'Has a Linemate account' : 'No Linemate account yet'}
                </Text>
              </View>

              {saved && <View style={styles.savedBadge}><Text style={styles.savedText}>✓ Saved</Text></View>}

              <Text style={styles.profileFieldLabel}>Email</Text>
              <TextInput
                style={styles.profileInput}
                value={email}
                onChangeText={setEmail}
                placeholder="player@email.com"
                placeholderTextColor="#bbb"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.profileFieldLabel, { marginTop: 12 }]}>Phone</Text>
              <TextInput
                style={styles.profileInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="(614) 555-0100"
                placeholderTextColor="#bbb"
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={[styles.profileSaveBtn, { backgroundColor: primaryColor }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.profileSaveBtnText}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Editable Player Row ──────────────────────────────────────────────────────

function EditRow({ player, index, onChange, onRemove, primaryColor }) {
  return (
    <View style={styles.editRow}>
      <TextInput
        style={[styles.numInput, { borderColor: primaryColor + '44' }]}
        value={player.num || ''}
        onChangeText={v => onChange(index, 'num', v)}
        placeholder="#"
        placeholderTextColor="#ccc"
        maxLength={3}
        keyboardType="number-pad"
      />
      <TextInput
        style={styles.nameInput}
        value={player.name || ''}
        onChangeText={v => onChange(index, 'name', v.toUpperCase())}
        placeholder="PLAYER NAME"
        placeholderTextColor="#ccc"
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[styles.subToggle, player.isSub && { backgroundColor: '#e3f2fd' }]}
        onPress={() => onChange(index, 'isSub', !player.isSub)}
      >
        <Text style={[styles.subToggleText, player.isSub && { color: '#1565c0' }]}>SUB</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(index)}>
        <Text style={styles.removeBtnText}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function RosterScreen({ route, navigation }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const { user } = useAuth();

  const [roster, setRoster] = useState([]);
  const [editRoster, setEditRoster] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subMessage, setSubMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [rosterData, subsData, statsData, configData] = await Promise.all([
        api.roster(teamId),
        api.subs(teamId).catch(() => []),
        api.stats(teamId).catch(() => ({})),
        api.get('/teams/' + teamId + '/config').catch(() => ({})),
      ]);
      const players = rosterData.filter(p => p.name || (Array.isArray(p) && p[1]))
        .map(p => Array.isArray(p) ? { num: p[0], name: p[1] } : p)
        .filter(p => p.name);
      setRoster(players);
      setSubs(subsData);
      const sm = {};
      (statsData.playerStats || []).forEach(s => { sm[s.name] = s; });
      setStatsMap(sm);
      const am = {};
      (configData.availability || []).forEach(a => { am[a.name] = a.status; });
      setAvailabilityMap(am);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    setEditRoster(roster.map(p => ({ ...p })));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditRoster([]);
  }

  function handleChange(index, field, value) {
    setEditRoster(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }

  function handleRemove(index) {
    setEditRoster(prev => prev.filter((_, i) => i !== index));
  }

  function handleAdd() {
    setEditRoster(prev => [...prev, { num: '', name: '', isSub: false }]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const players = editRoster.filter(p => p.name.trim());
      await api.saveRoster(teamId, players);
      await load();
      setEditing(false);
    } catch(e) {
      Alert.alert('Error', 'Failed to save roster.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFill(subId) {
    await api.fillSub(teamId, subId).catch(() => {});
    await load();
  }

  async function handleCancel(subId) {
    await api.cancelSub(teamId, subId).catch(() => {});
    await load();
  }

  async function handlePostSub() {
    if (!user) return;
    setSubmitting(true);
    const displayName = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unknown';
    await api.createSub(teamId, displayName.toUpperCase(), subMessage.trim() || null, null).catch(() => {});
    setShowSubModal(false);
    setSubMessage('');
    setSubmitting(false);
    await load();
  }

  if (loading) return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="ROSTER" primaryColor={primaryColor} onBack={() => navigation.goBack()} />
      <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>
    </View>
  );

  const regulars = roster.filter(p => !p.isSub);
  const subs2 = roster.filter(p => p.isSub);

  return (
    <View style={styles.container}>
      <ScreenHeader title="ROSTER" primaryColor={primaryColor} onBack={() => navigation.goBack()} />
      {/* Edit mode */}
      {editing ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={cancelEdit}>
              <Text style={styles.editHeaderCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Edit Roster</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={primaryColor} /> : (
                <Text style={[styles.editHeaderSave, { color: primaryColor }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <FlatList
            data={editRoster}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.editList}
            renderItem={({ item, index }) => (
              <EditRow
                player={item}
                index={index}
                onChange={handleChange}
                onRemove={handleRemove}
                primaryColor={primaryColor}
              />
            )}
            ListFooterComponent={
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
                <Text style={[styles.addBtnText, { color: primaryColor }]}>+ Add Player</Text>
              </TouchableOpacity>
            }
          />
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={[
            ...(subs.length > 0 ? [{ type: 'subs-header', key: 'subs-h' }, ...subs.map(s => ({ type: 'sub', key: 'sub-' + s.id, sub: s }))] : []),
            { type: 'need-sub', key: 'need-sub' },
            ...(regulars.length > 0 ? [{ type: 'section', key: 'sec-regulars', label: 'Regulars' }] : []),
            ...regulars.map((p, i) => ({ type: 'player', key: 'reg-' + i, player: p })),
            ...(subs2.length > 0 ? [{ type: 'section', key: 'sec-subs', label: 'Subs' }] : []),
            ...subs2.map((p, i) => ({ type: 'player', key: 'sub-p-' + i, player: p })),
            ...(roster.length === 0 ? [{ type: 'empty', key: 'empty' }] : []),
          ]}
          keyExtractor={item => item.key}
          style={styles.container}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Roster</Text>
              <TouchableOpacity onPress={startEdit}>
                <Text style={[styles.editLink, { color: primaryColor }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'subs-header') {
              return <Text style={styles.sectionHeader}>Open Sub Requests</Text>;
            }
            if (item.type === 'sub') {
              return <SubRequestCard sub={item.sub} onFill={handleFill} onCancel={handleCancel} currentUserId={user?.id} />;
            }
            if (item.type === 'need-sub') {
              return (
                <TouchableOpacity style={[styles.needSubButton, { borderColor: primaryColor }]} onPress={() => setShowSubModal(true)}>
                  <Text style={[styles.needSubText, { color: primaryColor }]}>+ I need a sub</Text>
                </TouchableOpacity>
              );
            }
            if (item.type === 'section') {
              return <Text style={styles.sectionDivider}>{item.label}</Text>;
            }
            if (item.type === 'empty') {
              return <Text style={styles.emptyText}>No roster loaded yet.{'\n'}Sync from ChillerStats in Settings.</Text>;
            }
            const { player } = item;
            const stat = statsMap[player.name];
            const isHot = stat && stat.gp >= 3 && stat.pts >= stat.gp;
            const avStatus = availabilityMap[player.name];
            const avConfig = { yes: { label: 'IN', bg: '#e8f5e9', color: '#2e7d32' }, no: { label: 'OUT', bg: '#fdecea', color: '#c0392b' }, maybe: { label: 'MAYBE', bg: '#fff3e0', color: '#e67e22' } }[avStatus];
            return (
              <TouchableOpacity style={styles.playerRow} onPress={() => setProfilePlayer({ ...player, stats: stat })}>
                {player.num ? <Text style={[styles.playerNum, { color: primaryColor }]}>{player.num}</Text> : <View style={styles.playerNumSpacer} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{player.name}{isHot ? ' 🔥' : ''}</Text>
                  {stat && stat.gp > 0 && (
                    <Text style={styles.playerStats}>{stat.g}-{stat.a}-{stat.pts} ({stat.gp} GP)</Text>
                  )}
                </View>
                {player.isSub && <View style={styles.subBadge}><Text style={styles.subBadgeText}>SUB</Text></View>}
                {avConfig && <View style={[styles.avBadge, { backgroundColor: avConfig.bg }]}><Text style={[styles.avBadgeText, { color: avConfig.color }]}>{avConfig.label}</Text></View>}
                <Text style={styles.profileArrow}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Sub Request Modal */}
      <Modal visible={showSubModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Need a Sub?</Text>
          <Text style={styles.modalLabel}>Message (optional)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Can't make Thursday's game"
            placeholderTextColor="#999"
            value={subMessage}
            onChangeText={setSubMessage}
            multiline
          />
          <TouchableOpacity style={[styles.modalSubmit, { backgroundColor: primaryColor }]} onPress={handlePostSub} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Post Request</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSubModal(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Player Profile Modal */}
      {profilePlayer && (
        <ProfileModal
          player={profilePlayer}
          teamId={teamId}
          primaryColor={primaryColor}
          availabilityMap={availabilityMap}
          onClose={() => setProfilePlayer(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 32 },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listHeaderTitle: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5 },
  editLink: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sectionDivider: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },

  subCard: { backgroundColor: '#fff3cd', borderRadius: 8, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  subInfo: { flex: 1 },
  subPlayer: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  subGame: { fontSize: 12, color: '#666', marginTop: 1 },
  subMessage: { fontSize: 13, color: '#444', marginTop: 2 },
  subMeta: { fontSize: 11, color: '#999', marginTop: 2 },
  subActions: { flexDirection: 'column', gap: 4 },
  fillButton: { backgroundColor: '#2e7d32', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  fillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cancelButton: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#ccc' },
  cancelText: { color: '#666', fontSize: 12 },

  needSubButton: { marginBottom: 16, borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 1.5, backgroundColor: '#fff' },
  needSubText: { fontSize: 14, fontWeight: '600' },

  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, padding: 12, marginBottom: 4 },
  playerNum: { fontSize: 22, fontWeight: '700', width: 44 },
  playerNumSpacer: { width: 44 },
  playerName: { fontSize: 13, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  playerStats: { fontSize: 10, color: '#aaa', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  subBadge: { backgroundColor: '#e3f2fd', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 },
  subBadgeText: { fontSize: 10, fontWeight: '700', color: '#1565c0' },
  profileArrow: { fontSize: 18, color: '#ddd', paddingLeft: 4 },
  avBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 },
  avBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  emptyText: { color: '#999', fontSize: 13, textAlign: 'center', padding: 24, lineHeight: 20 },

  // Edit mode
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0ddd8', padding: 14 },
  editHeaderCancel: { fontSize: 15, color: '#888' },
  editHeaderTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: '#1a1a1a' },
  editHeaderSave: { fontSize: 15, fontWeight: '700' },
  editList: { padding: 16, paddingBottom: 40 },
  editRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 4, padding: 10, marginBottom: 6, gap: 8 },
  numInput: { width: 44, borderWidth: 1, borderRadius: 3, padding: 8, fontSize: 13, textAlign: 'center', color: '#1a1a1a' },
  nameInput: { flex: 1, borderWidth: 1, borderColor: '#e0ddd8', borderRadius: 3, padding: 8, fontSize: 13, color: '#1a1a1a' },
  subToggle: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: '#e0ddd8' },
  subToggleText: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#f5f2ec' },
  removeBtnText: { fontSize: 20, color: '#c0392b', lineHeight: 22 },
  addBtn: { marginTop: 8, borderRadius: 4, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#e0ddd8', borderStyle: 'dashed', backgroundColor: '#fff' },
  addBtnText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  // Profile modal
  profileContainer: { flex: 1, backgroundColor: '#f5f2ec' },
  profileHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  profileDone: { fontSize: 15, fontWeight: '700' },

  profileHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: '#e0ddd8' },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileAvatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileHeroInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: '#1a1a1a' },
  profileNum: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  profileHeroBadges: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  profileAvBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  profileAvBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  profileSubBadge: { backgroundColor: '#e3f2fd', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  profileSubBadgeText: { fontSize: 11, fontWeight: '700', color: '#1565c0' },

  profileStats: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0ddd8', paddingVertical: 12 },
  profileStat: { flex: 1, alignItems: 'center' },
  profileStatVal: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  profileStatLbl: { fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },

  profileBody: { padding: 20 },
  accountStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, padding: 10, marginBottom: 16 },
  accountStatusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  accountStatusText: { fontSize: 13, fontWeight: '600' },

  savedBadge: { backgroundColor: '#e8f5e9', borderRadius: 4, padding: 10, marginBottom: 16 },
  savedText: { fontSize: 12, color: '#2e7d32', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  profileFieldLabel: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  profileInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e0ddd8', borderRadius: 4, padding: 10, fontSize: 14, color: '#1a1a1a' },
  profileSaveBtn: { borderRadius: 4, padding: 12, alignItems: 'center', marginTop: 20 },
  profileSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  // Sub modal
  modal: { flex: 1, padding: 24, backgroundColor: '#f5f2ec' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 24 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  modalInput: { backgroundColor: '#fff', borderRadius: 8, padding: 14, fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#ddd', minHeight: 80, marginBottom: 16 },
  modalSubmit: { borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10 },
  modalSubmitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalCancel: { padding: 14, alignItems: 'center' },
  modalCancelText: { color: '#666', fontSize: 15 },
});
