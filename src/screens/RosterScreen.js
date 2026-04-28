import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

function SubRequestCard({ sub, onFill, onCancel, currentUserId }) {
  const isOwner = sub.createdBy && sub.userId === currentUserId;
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

export default function RosterScreen({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const { user } = useAuth();
  const [roster, setRoster] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subMessage, setSubMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [rosterData, subsData] = await Promise.all([api.roster(teamId), api.subs(teamId)]);
      setRoster(rosterData.filter((p) => p.name || (Array.isArray(p) && p[1])));
      setSubs(subsData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

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

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;

  const players = roster.map((p) => (Array.isArray(p) ? { num: p[0], name: p[1] } : p)).filter((p) => p.name);

  return (
    <View style={styles.container}>
      {subs.length > 0 && (
        <View style={styles.subsSection}>
          <Text style={styles.sectionHeader}>Open Sub Requests</Text>
          {subs.map((s) => (
            <SubRequestCard key={s.id} sub={s} onFill={handleFill} onCancel={handleCancel} currentUserId={user?.id} />
          ))}
        </View>
      )}

      <TouchableOpacity style={[styles.needSubButton, { borderColor: primaryColor }]} onPress={() => setShowSubModal(true)}>
        <Text style={[styles.needSubText, { color: primaryColor }]}>+ I need a sub</Text>
      </TouchableOpacity>

      <FlatList
        data={players}
        keyExtractor={(p, i) => p.name + i}
        renderItem={({ item }) => (
          <View style={styles.playerRow}>
            {item.num ? <Text style={[styles.playerNum, { color: primaryColor }]}>{item.num}</Text> : null}
            <Text style={styles.playerName}>{item.name}</Text>
            {item.isSub && <View style={styles.subBadge}><Text style={styles.subBadgeText}>SUB</Text></View>}
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={primaryColor} />}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  subsSection: { padding: 16, paddingBottom: 0 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  subCard: { backgroundColor: '#fff3cd', borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
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
  needSubButton: { margin: 16, marginBottom: 8, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1.5 },
  needSubText: { fontSize: 15, fontWeight: '600' },
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 6 },
  playerNum: { fontSize: 14, fontWeight: '700', width: 32 },
  playerName: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  subBadge: { backgroundColor: '#e3f2fd', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  subBadgeText: { fontSize: 10, fontWeight: '700', color: '#1565c0' },
  modal: { flex: 1, padding: 24, backgroundColor: '#f5f2ec' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 24 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  modalInput: { backgroundColor: '#fff', borderRadius: 8, padding: 14, fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#ddd', minHeight: 80, marginBottom: 16 },
  modalSubmit: { borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10 },
  modalSubmitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalCancel: { padding: 14, alignItems: 'center' },
  modalCancelText: { color: '#666', fontSize: 15 },
});
