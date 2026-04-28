import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

function Message({ msg, onReact, currentUserId, primaryColor }) {
  const isMe = msg.userId === currentUserId;
  return (
    <View style={[styles.msgContainer, isMe && styles.msgContainerMe]}>
      {!isMe && <Text style={styles.msgAuthor}>{msg.displayName}</Text>}
      <View style={[styles.bubble, isMe ? [styles.bubbleMe, { backgroundColor: primaryColor }] : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.content}</Text>
      </View>
      {msg.reactions.length > 0 && (
        <View style={[styles.reactions, isMe && styles.reactionsMe]}>
          {msg.reactions.map((r) => (
            <TouchableOpacity key={r.emoji} onPress={() => onReact(msg.id, r.emoji)} style={[styles.reaction, r.mine && styles.reactionMine]}>
              <Text style={styles.reactionText}>{r.emoji} {r.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ChatScreen({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef();

  const load = useCallback(async () => {
    try {
      const data = await api.chat(teamId);
      setMessages(data.messages);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      await api.sendMessage(teamId, content);
      await load();
    } finally {
      setSending(false);
    }
  }

  async function handleReact(msgId, emoji) {
    await api.react(teamId, msgId, emoji).catch(() => {});
    await load();
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => (
          <Message msg={item} onReact={handleReact} currentUserId={user?.id} primaryColor={primaryColor} />
        )}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: primaryColor }]} onPress={handleSend} disabled={!text.trim() || sending}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendText}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 4 },
  msgContainer: { marginBottom: 10, maxWidth: '80%' },
  msgContainerMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgAuthor: { fontSize: 11, color: '#999', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleThem: { backgroundColor: '#fff' },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, color: '#1a1a1a' },
  bubbleTextMe: { color: '#fff' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  reactionsMe: { justifyContent: 'flex-end' },
  reaction: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginRight: 4, marginBottom: 4, borderWidth: 1, borderColor: '#e0ddd8' },
  reactionMine: { borderColor: '#c0392b' },
  reactionText: { fontSize: 13 },
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0ddd8', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#f5f2ec', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, maxHeight: 100, color: '#1a1a1a', marginRight: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
