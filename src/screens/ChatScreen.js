import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable, ScrollView, Image, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

const QUICK_EMOJIS = ['👍', '🔥', '😂', '💪', '👏', '🎉', '🏒', '👎'];

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  return Math.floor(diff / 86400000) + 'd';
}

function formatMsgTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDayHeader(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  const palette = ['#e57373','#f06292','#ba68c8','#7986cb','#4fc3f7','#4db6ac','#aed581','#ff8a65','#a1887f'];
  return palette[h % palette.length];
}

function Avatar({ name, color, size = 36, uri }) {
  const initials = (name || '?').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ label, collapsed, onToggle, right }) {
  return (
    <TouchableOpacity style={styles.sectionHeaderRow} onPress={onToggle} activeOpacity={0.6}>
      <Text style={[styles.sectionChevron, collapsed && styles.sectionChevronCollapsed]}>{'›'}</Text>
      <Text style={styles.sectionHeader}>{label}</Text>
      {right || null}
    </TouchableOpacity>
  );
}

// ─── Channel List Row ─────────────────────────────────────────────────────────
function ChannelRow({ channel, onPress }) {
  const isDM = channel.type === 'dm';
  const isGame = channel.type === 'game';
  const hasPreview = !!channel.lastMessage;
  return (
    <TouchableOpacity style={styles.channelRow} onPress={() => onPress(channel)} activeOpacity={0.6}>
      {isDM ? (
        <Avatar name={channel.name} color={nameColor(channel.name)} size={30} />
      ) : (
        <Text style={styles.channelHash}>{isGame ? '🏒' : channel.id === 'league:goalies' ? '🥅' : '#'}</Text>
      )}
      <View style={styles.channelInfo}>
        <View style={styles.channelNameRow}>
          <Text style={[styles.channelName, hasPreview && styles.channelNameBold]} numberOfLines={1}>
            {(channel.name || '').toLowerCase()}
          </Text>
          {channel.type === 'division' && channel.teamCount > 1 && (
            <Text style={styles.channelTeamCount}>{channel.teamCount} teams</Text>
          )}
          {hasPreview && <Text style={styles.channelTime}>{timeAgo(channel.lastMessage.createdAt)}</Text>}
        </View>
        {hasPreview && (
          <Text style={styles.channelPreview} numberOfLines={1}>
            {!isDM && channel.lastMessage.authorName
              ? <Text style={styles.channelPreviewAuthor}>{channel.lastMessage.authorName}: </Text>
              : null}
            {channel.lastMessage.preview}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Slack-style Message ──────────────────────────────────────────────────────
function MessageRow({ msg, isMe, isDivision, primaryColor, onLongPress, onReact }) {
  const avatarColor = isMe ? primaryColor : (msg.primaryColor || nameColor(msg.displayName));
  const avatarUri = msg.avatarUrl || null;
  return (
    <Pressable onLongPress={() => onLongPress(msg)} delayLongPress={350}>
      <View style={styles.msgRow}>
        <Avatar name={msg.displayName} color={avatarColor} size={36} uri={avatarUri} />
        <View style={styles.msgBody}>
          <View style={styles.msgHeader}>
            <Text style={[styles.msgAuthor, isMe && { color: primaryColor }]} numberOfLines={1}>
              {msg.displayName}
            </Text>
            {isDivision && msg.teamName && (
              <View style={[styles.teamTag, { backgroundColor: (msg.primaryColor || '#888') + '22' }]}>
                <Text style={[styles.teamTagText, { color: msg.primaryColor || '#888' }]}>
                  {msg.teamName}
                </Text>
              </View>
            )}
            <Text style={styles.msgTime}>{formatMsgTime(msg.createdAt)}</Text>
          </View>
          <Text style={styles.msgText}>{msg.content}</Text>
          {msg.reactions && msg.reactions.length > 0 && (
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatScreen({ route }) {
  const { teamId, primaryColor = '#c0392b' } = route.params;
  const { user } = useAuth();

  const [channels, setChannels] = useState({ teamChannels: [], divChannel: null, dmChannels: [], leagueChannels: [] });
  const [activeChannel, setActiveChannel] = useState(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [channelsError, setChannelsError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiTarget, setEmojiTarget] = useState(null);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [collapsed, setCollapsed] = useState({ channels: false, games: false, league: false, division: false, dms: false });
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const listRef = useRef();
  const pollRef = useRef();

  const loadChannels = useCallback(async () => {
    try {
      const data = await api.channels(teamId);
      setChannelsError(null);
      setChannels({ teamChannels: data.teamChannels || [], divChannel: data.divChannel || null, dmChannels: data.dmChannels || [], leagueChannels: data.leagueChannels || [] });
    } catch(e) {
      setChannelsError(e?.message || 'Failed to load channels');
    } finally {
      setLoadingChannels(false);
    }
  }, [teamId]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const loadMessages = useCallback(async (channelId) => {
    setLoadingMessages(true);
    try {
      const data = await api.channelMessages(channelId);
      setMessages(data.messages || []);
    } catch(e) {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  function openChannel(channel) {
    setActiveChannel(channel);
    setMessages([]);
    loadMessages(channel.id);
  }

  function closeChannel() {
    clearInterval(pollRef.current);
    setActiveChannel(null);
    setMessages([]);
    loadChannels();
  }

  useEffect(() => {
    if (!activeChannel) return;
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.channelMessages(activeChannel.id);
        setMessages(data.messages || []);
      } catch(e) {}
    }, 8000);
    return () => clearInterval(pollRef.current);
  }, [activeChannel]);

  async function handleSend() {
    const content = text.trim();
    if (!content || sending || !activeChannel) return;
    setSending(true);
    setText('');
    try {
      await api.sendChannelMessage(activeChannel.id, content);
      const data = await api.channelMessages(activeChannel.id);
      setMessages(data.messages || []);
    } catch(e) {
      setText(content);
    } finally {
      setSending(false);
    }
  }

  async function handleReact(msg, emoji) {
    setEmojiTarget(null);
    if (!activeChannel) return;
    await api.reactChannelMessage(activeChannel.id, msg.id, emoji).catch(() => {});
    const data = await api.channelMessages(activeChannel.id);
    setMessages(data.messages || []);
  }

  async function openPeoplePicker() {
    setShowPeoplePicker(true);
    setLoadingMembers(true);
    try {
      const data = await api.teamMembers(teamId);
      setMembers(data || []);
    } catch(e) {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleCreateChannel() {
    const name = newChannelName.trim();
    if (!name || creatingChannel) return;
    setCreatingChannel(true);
    try {
      await api.createChannel(teamId, name);
      setShowNewChannel(false);
      setNewChannelName('');
      await loadChannels();
    } catch(e) {
      Alert.alert('Error', e?.message || 'Could not create channel');
    } finally {
      setCreatingChannel(false);
    }
  }

  async function startDm(member) {
    setShowPeoplePicker(false);
    try {
      const data = await api.dmOpen(teamId, member.id);
      openChannel({ id: data.channelId, type: 'dm', name: data.name });
    } catch(e) {
      Alert.alert('Error', e?.message || 'Could not open DM');
    }
  }

  function buildItems(msgs) {
    const items = [];
    let lastDay = null;
    let lastUserId = null;
    for (const msg of msgs) {
      const day = new Date(msg.createdAt).toDateString();
      if (day !== lastDay) {
        items.push({ type: 'day', key: 'day-' + msg.createdAt, label: formatDayHeader(msg.createdAt) });
        lastDay = day;
        lastUserId = null;
      }
      items.push({ type: 'msg', key: String(msg.id), msg, compact: msg.userId === lastUserId });
      lastUserId = msg.userId;
    }
    return items;
  }

  // ─── Channel List ───────────────────────────────────────────────────────────
  if (!activeChannel) {
    if (loadingChannels) {
      return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;
    }

    return (
      <View style={styles.container}>
        {channelsError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{channelsError}</Text>
            <TouchableOpacity onPress={loadChannels}><Text style={styles.errorBannerRetry}>Retry</Text></TouchableOpacity>
          </View>
        )}
        <ScrollView contentContainerStyle={styles.channelList} keyboardShouldPersistTaps="handled">

          {/* Channels */}
          <SectionHeader
            label="Channels"
            collapsed={collapsed.channels}
            onToggle={() => setCollapsed(v => ({ ...v, channels: !v.channels }))}
            right={
              <TouchableOpacity onPress={() => { setNewChannelName(''); setShowNewChannel(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.sectionAction, { color: primaryColor }]}>+ Add</Text>
              </TouchableOpacity>
            }
          />
          {!collapsed.channels && (
            <>
              {channels.teamChannels.filter(ch => ch.type !== 'game').map(ch => <ChannelRow key={ch.id} channel={ch} onPress={openChannel} />)}
              {channels.teamChannels.filter(ch => ch.type !== 'game').length === 0 && (
                <Text style={styles.sectionEmpty}>No channels yet.</Text>
              )}
            </>
          )}

          {/* Games */}
          {channels.teamChannels.some(ch => ch.type === 'game') && (
            <>
              <SectionHeader
                label="Games"
                collapsed={collapsed.games}
                onToggle={() => setCollapsed(v => ({ ...v, games: !v.games }))}
              />
              {!collapsed.games && channels.teamChannels.filter(ch => ch.type === 'game').map(ch => (
                <ChannelRow key={ch.id} channel={ch} onPress={openChannel} />
              ))}
            </>
          )}

          {/* League */}
          {channels.leagueChannels.length > 0 && (
            <>
              <SectionHeader
                label="League"
                collapsed={collapsed.league}
                onToggle={() => setCollapsed(v => ({ ...v, league: !v.league }))}
              />
              {!collapsed.league && channels.leagueChannels.map(ch => (
                <ChannelRow key={ch.id} channel={ch} onPress={openChannel} />
              ))}
            </>
          )}

          {/* Division */}
          {channels.divChannel && (
            <>
              <SectionHeader
                label="Division"
                collapsed={collapsed.division}
                onToggle={() => setCollapsed(v => ({ ...v, division: !v.division }))}
              />
              {!collapsed.division && (
                <ChannelRow channel={channels.divChannel} onPress={openChannel} />
              )}
            </>
          )}

          {/* Direct Messages */}
          <SectionHeader
            label="Direct Messages"
            collapsed={collapsed.dms}
            onToggle={() => setCollapsed(v => ({ ...v, dms: !v.dms }))}
            right={
              <TouchableOpacity onPress={openPeoplePicker} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.sectionAction, { color: primaryColor }]}>+ New</Text>
              </TouchableOpacity>
            }
          />
          {!collapsed.dms && (
            channels.dmChannels.length === 0 ? (
              <TouchableOpacity style={styles.dmEmptyRow} onPress={openPeoplePicker}>
                <Text style={styles.dmEmptyText}>Start a direct message</Text>
              </TouchableOpacity>
            ) : (
              channels.dmChannels.map(ch => <ChannelRow key={ch.id} channel={ch} onPress={openChannel} />)
            )
          )}

        </ScrollView>

        {/* People picker modal */}
        <Modal visible={showPeoplePicker} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => setShowPeoplePicker(false)}>
            <View style={styles.pickerOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerHandle} />
                  <Text style={styles.pickerTitle}>New Message</Text>
                  {loadingMembers ? (
                    <ActivityIndicator color={primaryColor} style={{ marginTop: 30 }} />
                  ) : members.length === 0 ? (
                    <Text style={styles.pickerEmpty}>No other members with accounts yet.</Text>
                  ) : (
                    <FlatList
                      data={members}
                      keyExtractor={m => m.id}
                      ItemSeparatorComponent={() => <View style={styles.separator} />}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.pickerRow} onPress={() => startDm(item)}>
                          <Avatar name={item.displayName} color={nameColor(item.displayName)} size={38} />
                          <Text style={styles.pickerName}>{item.displayName}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
        {/* New channel modal */}
        <Modal visible={showNewChannel} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => setShowNewChannel(false)}>
            <View style={styles.pickerOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerHandle} />
                  <Text style={styles.pickerTitle}>New Channel</Text>
                  <View style={styles.newChannelInputWrap}>
                    <Text style={styles.newChannelHash}>#</Text>
                    <TextInput
                      style={styles.newChannelInput}
                      placeholder="channel-name"
                      placeholderTextColor="#bbb"
                      value={newChannelName}
                      onChangeText={v => setNewChannelName(v.toLowerCase().replace(/\s/g, '-'))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={40}
                      returnKeyType="done"
                      onSubmitEditing={handleCreateChannel}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.newChannelBtn, { backgroundColor: newChannelName.trim() ? primaryColor : '#e0e0e0' }]}
                    onPress={handleCreateChannel}
                    disabled={!newChannelName.trim() || creatingChannel}
                  >
                    {creatingChannel
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.newChannelBtnText}>Create Channel</Text>}
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </View>
    );
  }

  // ─── Thread View ────────────────────────────────────────────────────────────
  const isDivision = activeChannel.type === 'division';
  const isDM = activeChannel.type === 'dm';
  const items = buildItems(messages);
  const subtitle = isDM ? 'Direct message'
    : isDivision && activeChannel.teamCount > 1 ? activeChannel.teamCount + ' teams'
    : activeChannel.type === 'game' ? 'Game channel'
    : 'Team channel';

  return (
    <View style={styles.container}>
      {/* Thread header */}
      <View style={styles.threadHeader}>
        <TouchableOpacity onPress={closeChannel} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.backArrow, { color: primaryColor }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.threadTitleWrap}>
          <View style={styles.threadTitleLine}>
            {isDM ? (
              <Avatar name={activeChannel.name} color={nameColor(activeChannel.name)} size={24} />
            ) : (
              <Text style={[styles.threadHash, { color: primaryColor }]}>#</Text>
            )}
            <Text style={styles.threadTitle} numberOfLines={1}>{activeChannel.name}</Text>
          </View>
          <Text style={styles.threadSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loadingMessages ? (
          <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyThread}>
                {isDM ? (
                  <>
                    <Avatar name={activeChannel.name} color={nameColor(activeChannel.name)} size={56} />
                    <Text style={styles.emptyDmName}>{activeChannel.name}</Text>
                    <Text style={styles.emptyThreadText}>This is the start of your{'\n'}conversation.</Text>
                  </>
                ) : (
                  <Text style={styles.emptyThreadText}>No messages yet.{'\n'}Be the first to say something!</Text>
                )}
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === 'day') {
                return (
                  <View style={styles.dayRow}>
                    <View style={styles.dayLine} />
                    <Text style={styles.dayLabel}>{item.label}</Text>
                    <View style={styles.dayLine} />
                  </View>
                );
              }
              const { msg, compact } = item;
              const isMe = msg.userId === user?.id;

              if (compact) {
                return (
                  <Pressable onLongPress={() => setEmojiTarget(msg)} delayLongPress={350}>
                    <View style={styles.msgCompact}>
                      <Text style={styles.msgText}>{msg.content}</Text>
                      {msg.reactions && msg.reactions.length > 0 && (
                        <View style={styles.reactions}>
                          {msg.reactions.map(r => (
                            <TouchableOpacity
                              key={r.emoji}
                              style={[styles.reactionPill, r.mine && { borderColor: primaryColor, backgroundColor: primaryColor + '18' }]}
                              onPress={() => handleReact(msg, r.emoji)}
                            >
                              <Text style={styles.reactionText}>{r.emoji} {r.count}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              }

              return (
                <MessageRow
                  msg={msg}
                  isMe={isMe}
                  isDivision={isDivision}
                  primaryColor={primaryColor}
                  onLongPress={setEmojiTarget}
                  onReact={handleReact}
                />
              );
            }}
          />
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.plusBtn}>
            <Text style={styles.plusText}>+</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={isDM ? 'Message ' + activeChannel.name : 'Message #' + activeChannel.name}
            placeholderTextColor="#aaa"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? primaryColor : '#e0e0e0' }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendText}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Emoji picker */}
      <Modal visible={!!emojiTarget} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setEmojiTarget(null)}>
          <View style={styles.emojiOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.emojiSheet}>
                <View style={styles.emojiSheetHandle} />
                <Text style={styles.emojiSheetLabel}>Add Reaction</Text>
                <View style={styles.emojiRow}>
                  {QUICK_EMOJIS.map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.emojiBtn}
                      onPress={() => emojiTarget && handleReact(emojiTarget, emoji)}
                    >
                      <Text style={styles.emojiBtnText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const AVATAR_SIZE = 36;
const MSG_INDENT = AVATAR_SIZE + 10;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  errorBanner: { backgroundColor: '#fef2f2', borderBottomWidth: 1, borderBottomColor: '#fecaca', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBannerText: { flex: 1, fontSize: 13, color: '#dc2626' },
  errorBannerRetry: { fontSize: 13, color: '#dc2626', fontWeight: '700' },

  // ── Channel list ────────────────────────────────────────────────────────────
  channelList: { paddingTop: 4, paddingBottom: 40 },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 4,
    gap: 4,
  },
  sectionChevron: {
    fontSize: 16,
    color: '#666',
    width: 18,
    transform: [{ rotate: '90deg' }],
  },
  sectionChevronCollapsed: {
    transform: [{ rotate: '0deg' }],
  },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  sectionAction: { fontSize: 14, fontWeight: '600' },
  sectionEmpty: { fontSize: 14, color: '#bbb', paddingHorizontal: 46, paddingVertical: 6, fontStyle: 'italic' },

  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 11,
  },
  channelHash: { fontSize: 17, color: '#888', width: 30, textAlign: 'center' },
  channelInfo: { flex: 1, minWidth: 0 },
  channelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  channelName: { fontSize: 15, fontWeight: '400', color: '#444', flex: 1 },
  channelNameBold: { fontWeight: '600', color: '#1a1a1a' },
  channelTeamCount: { fontSize: 11, color: '#bbb' },
  channelTime: { fontSize: 12, color: '#bbb', flexShrink: 0 },
  channelPreview: { fontSize: 13, color: '#aaa', lineHeight: 17, marginTop: 1 },
  channelPreviewAuthor: { fontWeight: '600', color: '#777' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#f0f0f0', marginLeft: 56 },

  dmEmptyRow: { paddingHorizontal: 46, paddingVertical: 8 },
  dmEmptyText: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },

  // ── Thread header ───────────────────────────────────────────────────────────
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: { paddingRight: 4 },
  backArrow: { fontSize: 28, fontWeight: '300', lineHeight: 32 },
  threadTitleWrap: { flex: 1, minWidth: 0 },
  threadTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  threadHash: { fontSize: 17, fontWeight: '700' },
  threadTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  threadSubtitle: { fontSize: 12, color: '#aaa', marginTop: 1 },

  // ── Messages ────────────────────────────────────────────────────────────────
  messageList: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 8 },
  emptyThread: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyDmName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 6 },
  emptyThreadText: { color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  dayRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e0e0e0' },
  dayLabel: { fontSize: 12, color: '#aaa', fontWeight: '600' },

  msgRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10 },

  avatar: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  avatarText: { color: '#fff', fontWeight: '700' },

  msgBody: { flex: 1, minWidth: 0 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  msgAuthor: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  teamTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  teamTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  msgTime: { fontSize: 11, color: '#bbb', marginLeft: 2 },
  msgText: { fontSize: 15, color: '#1a1a1a', lineHeight: 21 },

  msgCompact: { marginBottom: 4, paddingLeft: MSG_INDENT },

  reactions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, gap: 4 },
  reactionPill: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  reactionText: { fontSize: 13 },

  // ── Input bar ───────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
    gap: 8,
  },
  plusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 3,
  },
  plusText: { fontSize: 20, color: '#888', lineHeight: 24 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 120,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sendBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginBottom: 2 },
  sendText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // ── People picker ────────────────────────────────────────────────────────────
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, paddingBottom: 40, maxHeight: '70%' },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 16 },
  pickerEmpty: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 20, paddingHorizontal: 24, lineHeight: 22 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  pickerName: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },

  newChannelInputWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  newChannelHash: { fontSize: 17, color: '#888' },
  newChannelInput: { flex: 1, fontSize: 16, color: '#1a1a1a' },
  newChannelBtn: { marginHorizontal: 20, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  newChannelBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Emoji picker ─────────────────────────────────────────────────────────────
  emojiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  emojiSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 44, alignItems: 'center' },
  emojiSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 16 },
  emojiSheetLabel: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  emojiBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f5f5f5' },
  emojiBtnText: { fontSize: 26 },
});
