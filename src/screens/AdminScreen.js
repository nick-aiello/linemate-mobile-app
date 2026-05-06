import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
  Alert, TextInput, Modal, RefreshControl,
} from 'react-native';
import { api } from '../api/client';

const ROLES = ['superadmin', 'admin', 'team_manager', 'team_member'];
const ROLE_COLORS = { superadmin: '#c0392b', admin: '#e65100', team_manager: '#2e7d32', team_member: '#555' };

function SectionHeader({ label }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── User Modal ────────────────────────────────────────────────────────────────
function UserModal({ user, teams, onSave, onResetPassword, onDelete, onClose }) {
  const isNew = !user.id;
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState(user.role || 'team_member');
  const [teamIds, setTeamIds] = useState(user.teamIds || []);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetPw, setResetPw] = useState(false);
  const [newPw, setNewPw] = useState('');

  function toggleTeam(id) {
    setTeamIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ firstName, lastName, email, role, teamIds, ...(isNew ? { password } : {}) });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPw() {
    if (newPw.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await onResetPassword(newPw);
      setResetPw(false);
      setNewPw('');
      Alert.alert('Done', 'Password reset successfully.');
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet">
      <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{isNew ? 'New User' : 'Edit User'}</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>Done</Text></TouchableOpacity>
        </View>

        <SectionHeader label="Info" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="First Name" placeholderTextColor="#bbb" value={firstName} onChangeText={setFirstName} />
          <Divider />
          <TextInput style={styles.input} placeholder="Last Name" placeholderTextColor="#bbb" value={lastName} onChangeText={setLastName} />
          <Divider />
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#bbb" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {isNew && (
            <>
              <Divider />
              <TextInput style={styles.input} placeholder="Password (min 8 chars)" placeholderTextColor="#bbb" value={password} onChangeText={setPassword} secureTextEntry />
            </>
          )}
        </View>

        <SectionHeader label="Role" />
        <View style={styles.card}>
          {ROLES.map((r, i) => (
            <View key={r}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.roleRow} onPress={() => setRole(r)}>
                <Text style={[styles.roleName, { color: ROLE_COLORS[r] }]}>{r}</Text>
                {role === r && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <SectionHeader label="Teams" />
        <View style={styles.card}>
          {teams.length === 0 ? (
            <Text style={styles.emptyHint}>No teams available</Text>
          ) : teams.map((t, i) => (
            <View key={t.slug}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.roleRow} onPress={() => toggleTeam(t.slug)}>
                <View style={[styles.teamDot, { backgroundColor: t.primaryColor || '#c0392b' }]} />
                <Text style={styles.teamName}>{t.name}</Text>
                {teamIds.includes(t.slug) && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isNew ? 'Create User' : 'Save Changes'}</Text>}
        </TouchableOpacity>

        {!isNew && (
          <>
            <SectionHeader label="Password" />
            <View style={styles.card}>
              {resetPw ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="New password (min 8 chars)"
                    placeholderTextColor="#bbb"
                    value={newPw}
                    onChangeText={setNewPw}
                    secureTextEntry
                  />
                  <TouchableOpacity style={styles.resetBtn} onPress={handleResetPw}>
                    <Text style={styles.resetBtnText}>Set New Password</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setResetPw(true)}>
                  <Text style={styles.linkText}>Reset Password</Text>
                </TouchableOpacity>
              )}
            </View>

            <SectionHeader label="Danger Zone" />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => Alert.alert('Delete User', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ])}
            >
              <Text style={styles.deleteBtnText}>Delete User</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

// ── Team Modal ────────────────────────────────────────────────────────────────
function TeamModal({ team, onSave, onDelete, onClose }) {
  const isNew = !team.slug;
  const [name, setName] = useState(team.name || '');
  const [color, setColor] = useState(team.primaryColor || '#c0392b');
  const [chillerId, setChillerId] = useState(team.chillerTeamId || '');
  const [division, setDivision] = useState(team.division || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Error', 'Team name is required.'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), primaryColor: color, chillerTeamId: chillerId || null, division: division || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet">
      <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{isNew ? 'New Team' : 'Edit Team'}</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>Done</Text></TouchableOpacity>
        </View>

        <SectionHeader label="Team Info" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Team Name" placeholderTextColor="#bbb" value={name} onChangeText={setName} />
          <Divider />
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: color }]} />
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0 }]}
              placeholder="Primary Color (#hex)"
              placeholderTextColor="#bbb"
              value={color}
              onChangeText={setColor}
              autoCapitalize="none"
              maxLength={7}
            />
          </View>
          <Divider />
          <TextInput
            style={styles.input}
            placeholder="Division (optional)"
            placeholderTextColor="#bbb"
            value={division}
            onChangeText={setDivision}
          />
          <Divider />
          <TextInput
            style={styles.input}
            placeholder="ChillerStats Team ID (optional)"
            placeholderTextColor="#bbb"
            value={chillerId}
            onChangeText={setChillerId}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isNew ? 'Create Team' : 'Save Changes'}</Text>}
        </TouchableOpacity>

        {!isNew && (
          <>
            <SectionHeader label="Danger Zone" />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => Alert.alert('Delete Team', 'This will permanently delete all team data. This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ])}
            >
              <Text style={styles.deleteBtnText}>Delete Team</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

// ── Main AdminScreen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
  const [summary, setSummary] = useState(null);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editTeam, setEditTeam] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [s, t, u] = await Promise.all([
        api.adminSummary(),
        api.adminTeams(),
        api.adminUsers(),
      ]);
      setSummary(s);
      setTeams(t);
      setUsers(u);
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // User actions
  async function handleSaveUser(data) {
    try {
      if (!editUser.id) {
        await api.adminCreateUser(data);
        Alert.alert('Created', 'User created successfully.');
      } else {
        await api.adminUpdateUser(editUser.id, data);
        Alert.alert('Saved', 'User updated.');
      }
      setEditUser(null);
      await load();
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to save user.');
    }
  }

  async function handleResetPassword(id, password) {
    await api.adminResetPassword(id, password);
  }

  async function handleDeleteUser(id) {
    try {
      await api.adminDeleteUser(id);
      setEditUser(null);
      await load();
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to delete user.');
    }
  }

  // Team actions
  async function handleSaveTeam(data) {
    try {
      if (!editTeam.slug) {
        await api.adminCreateTeam(data);
        Alert.alert('Created', 'Team created successfully.');
      } else {
        await api.adminEditTeam(editTeam.slug, data);
        Alert.alert('Saved', 'Team updated.');
      }
      setEditTeam(null);
      await load();
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to save team.');
    }
  }

  async function handleDeleteTeam(slug) {
    try {
      await api.adminDeleteTeam(slug);
      setEditTeam(null);
      await load();
    } catch(e) {
      Alert.alert('Error', e.message || 'Failed to delete team.');
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#c0392b" /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#c0392b" />}
    >
      {/* Summary */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{summary.teams}</Text>
            <Text style={styles.summaryLabel}>Teams</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{summary.users}</Text>
            <Text style={styles.summaryLabel}>Users</Text>
          </View>
        </View>
      )}

      {/* Teams */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Teams</Text>
        <TouchableOpacity onPress={() => setEditTeam({})}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        {teams.length === 0 && <Text style={styles.emptyHint}>No teams yet.</Text>}
        {teams.map((t, i) => (
          <View key={t.slug}>
            {i > 0 && <Divider />}
            <TouchableOpacity style={styles.listRow} onPress={() => setEditTeam(t)}>
              <View style={[styles.teamDot, { backgroundColor: t.primaryColor || '#c0392b' }]} />
              <View style={styles.listBody}>
                <Text style={styles.listTitle}>{t.name}</Text>
                {t.division && <Text style={styles.listSub}>{t.division}</Text>}
              </View>
              <Text style={styles.listSlug}>{t.slug}</Text>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Users */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Users</Text>
        <TouchableOpacity onPress={() => setEditUser({ teamIds: [] })}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        {users.length === 0 && <Text style={styles.emptyHint}>No users yet.</Text>}
        {users.map((u, i) => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id;
          return (
            <View key={u.id}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={styles.listRow} onPress={() => setEditUser(u)}>
                <View style={styles.listBody}>
                  <Text style={styles.listTitle}>{name.toUpperCase()}</Text>
                  <Text style={styles.listSub}>{u.email || 'No email'}</Text>
                </View>
                <Text style={[styles.roleBadge, { color: ROLE_COLORS[u.role] || '#555' }]}>{u.role}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Modals */}
      {editUser && (
        <UserModal
          user={editUser}
          teams={teams}
          onSave={handleSaveUser}
          onResetPassword={(pw) => handleResetPassword(editUser.id, pw)}
          onDelete={() => handleDeleteUser(editUser.id)}
          onClose={() => setEditUser(null)}
        />
      )}
      {editTeam && (
        <TeamModal
          team={editTeam}
          onSave={handleSaveTeam}
          onDelete={() => handleDeleteTeam(editTeam.slug)}
          onClose={() => setEditTeam(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 4, padding: 16, alignItems: 'center' },
  summaryNum: { fontSize: 32, fontWeight: '900', color: '#1a1a1a' },
  summaryLabel: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  sectionHeader: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5 },
  addBtn: { fontSize: 13, fontWeight: '700', color: '#c0392b', textTransform: 'uppercase', letterSpacing: 1 },

  card: { backgroundColor: '#fff', borderRadius: 4 },
  divider: { height: 1, backgroundColor: '#f0ede8' },
  emptyHint: { padding: 14, fontSize: 13, color: '#aaa', textAlign: 'center' },

  listRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  listBody: { flex: 1 },
  listTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5 },
  listSub: { fontSize: 11, color: '#888', marginTop: 1 },
  listSlug: { fontSize: 10, color: '#bbb', fontFamily: 'Courier', flexShrink: 0 },
  roleBadge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  arrow: { fontSize: 20, color: '#ccc' },

  teamDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  teamName: { flex: 1, fontSize: 13, color: '#1a1a1a', fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#f5f2ec' },
  modalContent: { padding: 16, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 2 },
  modalClose: { fontSize: 15, fontWeight: '700', color: '#c0392b', textTransform: 'uppercase', letterSpacing: 1 },

  input: { padding: 12, fontSize: 14, color: '#1a1a1a' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12 },
  colorSwatch: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: '#e0ddd8', flexShrink: 0 },

  roleRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  roleName: { flex: 1, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  checkmark: { fontSize: 16, color: '#2e7d32', fontWeight: '700' },

  saveBtn: { marginTop: 14, backgroundColor: '#c0392b', borderRadius: 4, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },

  resetBtn: { backgroundColor: '#1a1a1a', borderRadius: 4, padding: 12, alignItems: 'center' },
  resetBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  linkText: { fontSize: 14, color: '#c0392b', padding: 12, fontWeight: '600' },

  deleteBtn: { marginTop: 8, backgroundColor: '#fff', borderRadius: 4, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fce4ec' },
  deleteBtnText: { color: '#c0392b', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});
