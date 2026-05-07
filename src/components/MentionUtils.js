import { Text, View, TouchableOpacity, FlatList, StyleSheet } from 'react-native';

// Detect if the user is currently typing a @mention.
// Returns the partial query (text after @) or null.
export function detectMentionQuery(text) {
  if (!text) return null;
  // Look for @ that's at start of string OR preceded by whitespace
  const match = text.match(/(?:^|\s)@([\w]*)$/);
  return match ? match[1] : null;
}

// Replace the current @partial token with the picked member's name.
export function applyMention(text, member) {
  return text.replace(/(?:^|\s)@([\w]*)$/, (full, _q) => {
    const prefix = full.startsWith('@') ? '' : full[0];
    return prefix + '@' + (member.name || member.firstName + ' ' + member.lastName).trim() + ' ';
  });
}

// Given a list of tracked mentions [{id, name}], return only those whose name still appears in text.
export function activeMentionIds(text, tracked) {
  return tracked
    .filter(m => text.includes('@' + m.name))
    .map(m => m.id);
}

// Render text with @mentions highlighted.
// Pattern: @ + sequence of capitalized words (handles "@John", "@John Smith")
export function renderMessageWithMentions(content, primaryColor) {
  if (!content) return null;
  const regex = /(@[A-Za-z][\w]*(?:\s[A-Za-z][\w]+)?)/g;
  const parts = content.split(regex);
  return parts.map((p, i) =>
    /^@[A-Za-z]/.test(p)
      ? <Text key={i} style={{ color: primaryColor, fontWeight: '600' }}>{p}</Text>
      : <Text key={i}>{p}</Text>
  );
}

export function MentionPicker({ members, query, onPick, primaryColor }) {
  const q = (query || '').toLowerCase();
  const filtered = members
    .filter(m => {
      const name = (m.name || ((m.firstName || '') + ' ' + (m.lastName || '')).trim()).toLowerCase();
      return !q || name.includes(q) || name.split(' ').some(w => w.startsWith(q));
    })
    .slice(0, 6);
  if (!filtered.length) return null;
  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyboardShouldPersistTaps="always"
        keyExtractor={m => String(m.id)}
        renderItem={({ item }) => {
          const name = item.name || ((item.firstName || '') + ' ' + (item.lastName || '')).trim();
          return (
            <TouchableOpacity style={styles.row} onPress={() => onPick(item)}>
              <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
                <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>{name}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0ddd8', maxHeight: 220 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  name: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
});
