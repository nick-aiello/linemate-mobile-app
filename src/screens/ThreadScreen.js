import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Alert, Pressable, ActionSheetIOS, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';

const QUICK_EMOJIS = ['👍', '🔥', '😂', '💪', '👏', '🎉', '🏒', '👎'];

function nameColor(name) {
  if (!name) return '#888';
  const colors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#2c3e50', '#e67e22'];
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function formatMsgTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Avatar({ name, color, size = 32, uri }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#eee' }} />;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>{initial}</Text>
    </View>
  );
}

function ThreadMessage({ msg, isMe, isParent, primaryColor, onLongPress, onReact }) {
  const avatarColor = isMe ? primaryColor : nameColor(msg.displayName);
  const isDeleted = msg.deleted;
  return (
    <Pressable onLongPress={() => !isDeleted && onLongPress(msg)} delayLongPress={350}>
      <View style={[styles.msgRow, isParent && styles.parentMsg]}>
        <Avatar name={msg.displayName} color={avatarColor} size={32} uri={msg.avatarUrl} />
        <View style={styles.msgBody}>
          <View style={styles.msgHeader}>
            <Text style={[styles.msgAuthor, isMe && { color: primaryColor }]} numberOfLines={1}>
              {msg.displayName}
            </Text>
            <Text style={styles.msgTime}>{formatMsgTime(msg.createdAt)}</Text>
          </View>
          {isDeleted ? (
            <Text style={styles.deletedText}>Message deleted</Text>
          ) : (
            <Text style={styles.msgText}>
              {msg.content}
              {msg.edited ? <Text style={styles.editedLabel}> (edited)</Text> : null}
            </Text>
          )}
          {!isDeleted && msg.reactions?.length > 0 && (
            <View style={styles.reactions}>
              {msg.reactions.map(r => (
                <TouchableOpacity
                  key={r.emoji}
                  style={[styles.reactionPill, r.mine && { borderColor: primaryColor, backgroundColor: primaryColor + '18' }]}
                  onPress={() => onReact(msg, r.emoji)}
                >
                  <Text style={styles.reactionText}>{r.emoji} {r.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function ThreadScreen({ route, navigation }) {
  const { channelId, messageId, primaryColor = '#c0392b' } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingMsg, setEditingMsg] = useState(null);
  const [emojiTarget, setEmojiTarget] = useState(null);
  const inputRef = useRef();
  const listRef = useRef();

  const load = useCallback(async () => {
    try {
      const data = await api.getThread(channelId, messageId);
      setMessages(data.messages || []);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [channelId, messageId]);

  useEffect(() => { load(); }, [load]);

  // Poll for new replies
  useEffect(() => {
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  async function handleSend() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const currentEdit = editingMsg;
    setEditingMsg(null);
    try {
      if (currentEdit) {
        await api.editMessage(channelId, currentEdit.id, content);
      } else {
        await api.sendChannelMessage(channelId, content, messageId);
      }
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setText(content);
      if (currentEdit) setEditingMsg(currentEdit);
      Alert.alert('Error', e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function handleReact(msg, emoji) {
    setEmojiTarget(null);
    await api.reactChannelMessage(channelId, msg.id, emoji).catch(() => {});
    load();
  }

  async function handleDelete(msgId) {
    try {
      await api.deleteMessage(channelId, msgId);
      await load();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to delete');
    }
  }

  function handleLongPress(msg) {
    const isMe = msg.userId === user?.id;
    const options = ['Add Reaction', ...(isMe ? ['Edit', 'Delete'] : []), 'Cancel'];
    const cancelIndex = options.length - 1;
    const destructiveIndex = isMe ? options.indexOf('Delete') : -1;
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined },
      (idx) => {
        const action = options[idx];
        if (action === 'Add Reaction') setEmojiTarget(msg);
        else if (action === 'Edit') {
          setEditingMsg(msg);
          setText(msg.content || '');
          setTimeout(() => inputRef.current?.focus(), 100);
        } else if (action === 'Delete') {
          Alert.alert('Delete message?', '', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => handleDelete(msg.id) },
          ]);
        }
      }
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="THREAD" primaryColor={primaryColor} onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <ScreenHeader title="THREAD" primaryColor={primaryColor} onBack={() => navigation.goBack()} />
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <>
              <ThreadMessage
                msg={item}
                isMe={item.userId === user?.id}
                isParent={index === 0}
                primaryColor={primaryColor}
                onLongPress={handleLongPress}
                onReact={handleReact}
              />
              {index === 0 && messages.length > 1 && (
                <View style={styles.replyDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{messages.length - 1} {messages.length - 1 === 1 ? 'reply' : 'replies'}</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}
            </>
          )}
        />

        {emojiTarget && (
          <View style={styles.emojiBar}>
            {QUICK_EMOJIS.map(e => (
              <TouchableOpacity key={e} onPress={() => handleReact(emojiTarget, e)} style={styles.emojiBtn}>
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setEmojiTarget(null)} style={styles.emojiCancel}>
              <Ionicons name="close" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        )}

        {editingMsg && (
          <View style={styles.editingBar}>
            <Text style={styles.editingText}>Editing message</Text>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setText(''); }}>
              <Ionicons name="close" size={16} color="#888" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Reply…"
            placeholderTextColor="#aaa"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? primaryColor : '#ccc' }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 8 },

  msgRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  parentMsg: { backgroundColor: '#fafaf7', padding: 10, borderRadius: 6, marginBottom: 4 },
  msgBody: { flex: 1 },
  msgHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  msgAuthor: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  msgTime: { fontSize: 11, color: '#aaa' },
  msgText: { fontSize: 14, color: '#1a1a1a', lineHeight: 19 },
  deletedText: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  editedLabel: { fontSize: 11, color: '#aaa', fontStyle: 'italic' },

  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionPill: { borderWidth: 1, borderColor: '#e0ddd8', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  reactionText: { fontSize: 12 },

  replyDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e0ddd8' },
  dividerText: { fontSize: 11, color: '#888', fontWeight: '600', letterSpacing: 0.5 },

  emojiBar: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#fafaf7', borderTopWidth: 1, borderTopColor: '#e0ddd8' },
  emojiBtn: { padding: 4 },
  emojiText: { fontSize: 22 },
  emojiCancel: { marginLeft: 'auto', padding: 4 },

  editingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff8e1', borderTopWidth: 1, borderTopColor: '#e0ddd8' },
  editingText: { fontSize: 12, color: '#888', fontStyle: 'italic' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0ddd8' },
  input: { flex: 1, minHeight: 36, maxHeight: 100, fontSize: 15, color: '#1a1a1a', backgroundColor: '#f5f2ec', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
