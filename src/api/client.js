import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://linemate-app.com';

async function getToken() {
  return await SecureStore.getItemAsync('session_token');
}

export async function setToken(token) {
  if (token == null) throw new Error('No session token returned from server');
  await SecureStore.setItemAsync('session_token', String(token));
}

export async function clearToken() {
  await SecureStore.deleteItemAsync('session_token');
}

async function request(method, path, body) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE_URL + '/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { code: data.code, status: res.status });
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body) => request('DELETE', path, body),

  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/me'),
  updateMe: (data) => request('POST', '/me/update', data),
  changePassword: (currentPassword, newPassword) => request('POST', '/me/password', { currentPassword, newPassword }),
  myProfile: () => request('GET', '/me/profile'),
  linkPlayer: (teamId, playerName) => request('POST', '/me/link', { teamId, playerName }),
  linkChillerUrl: (chillerUrl) => request('POST', '/me/link', { chillerUrl }),
  unlinkPlayer: (teamId) => request('POST', '/me/unlink', { teamId }),

  teams: () => request('GET', '/teams'),
  brand: (teamId) => request('GET', '/teams/' + teamId + '/brand'),
  saveBrand: (teamId, data) => request('POST', '/teams/' + teamId + '/brand', data),
  roster: (teamId) => request('GET', '/teams/' + teamId + '/roster'),
  schedule: (teamId) => request('GET', '/teams/' + teamId + '/schedule'),
  stats: (teamId) => request('GET', '/teams/' + teamId + '/stats'),
  lineup: (teamId) => request('GET', '/teams/' + teamId + '/lineup'),
  setLineup: (teamId) => request('POST', '/teams/' + teamId + '/lineup/set'),
  sync: (teamId) => request('POST', '/teams/' + teamId + '/sync'),

  chat: (teamId, beforeId) => request('GET', '/teams/' + teamId + '/chat' + (beforeId ? '?before=' + beforeId : '')),
  sendMessage: (teamId, content) => request('POST', '/teams/' + teamId + '/chat', { content }),
  react: (teamId, msgId, emoji) => request('POST', '/teams/' + teamId + '/chat/' + msgId + '/react', { emoji }),

  channels: (teamId) => request('GET', '/teams/' + teamId + '/channels'),
  createChannel: (teamId, name) => request('POST', '/teams/' + teamId + '/channels', { name }),
  channelMessages: (channelId, beforeId) => request('GET', '/channels/' + channelId + '/messages' + (beforeId ? '?before=' + beforeId : '')),
  sendChannelMessage: (channelId, content, replyToId) => request('POST', '/channels/' + channelId + '/messages', { content, ...(replyToId ? { replyToId } : {}) }),
  editMessage: (channelId, msgId, content) => request('PATCH', '/channels/' + channelId + '/messages/' + msgId, { content }),
  deleteMessage: (channelId, msgId) => request('DELETE', '/channels/' + channelId + '/messages/' + msgId),
  reactChannelMessage: (channelId, msgId, emoji) => request('POST', '/channels/' + channelId + '/messages/' + msgId + '/react', { emoji }),
  markRead: (channelId) => request('POST', '/channels/' + channelId + '/read'),
  getThread: (channelId, msgId) => request('GET', '/channels/' + channelId + '/thread/' + msgId),
  teamMembers: (teamId) => request('GET', '/teams/' + teamId + '/members'),
  dmOpen: (teamId, targetUserId) => request('POST', '/teams/' + teamId + '/dm/open', { targetUserId }),

  subs: (teamId) => request('GET', '/teams/' + teamId + '/subs'),
  createSub: (teamId, playerName, message, gameId) => request('POST', '/teams/' + teamId + '/subs', { playerName, message, gameId }),
  fillSub: (teamId, subId) => request('POST', '/teams/' + teamId + '/subs/' + subId + '/fill'),
  cancelSub: (teamId, subId) => request('POST', '/teams/' + teamId + '/subs/' + subId + '/cancel'),

  getNotificationPrefs: (teamId) => request('GET', '/teams/' + teamId + '/notifications'),
  setNotificationPrefs: (teamId, prefs) => request('POST', '/teams/' + teamId + '/notifications', prefs),

  toggleLineup: (teamId) => request('POST', '/teams/' + teamId + '/lineup/toggle'),
  applyHistory: (teamId, ts) => request('POST', '/teams/' + teamId + '/history/' + ts + '/apply'),
  deleteHistory: (teamId, ts) => request('POST', '/teams/' + teamId + '/history/' + ts + '/delete'),
  saveRoster: (teamId, players) => request('POST', '/teams/' + teamId + '/roster', players),
  nextGame: (teamId) => request('GET', '/teams/' + teamId + '/next-game'),
  getPlayerProfile: (teamId, name) => request('GET', '/teams/' + teamId + '/roster/profile/' + encodeURIComponent(name)),
  savePlayerProfile: (teamId, name, data) => request('POST', '/teams/' + teamId + '/roster/profile/' + encodeURIComponent(name), data),

  registerPushToken: (token, platform) => request('POST', '/push-token', { token, platform }),
  unregisterPushToken: (token) => request('DELETE', '/push-token', { token }),

  signup: (email, password, firstName, lastName, inviteToken) => request('POST', '/auth/signup', { email, password, firstName, lastName, inviteToken }),
  getInvite: (token) => request('GET', '/invite/' + token),
  generateInvite: (teamId) => request('POST', '/teams/' + teamId + '/invite/generate'),
  uploadAvatar: (imageBase64, mimeType) => request('POST', '/me/avatar', { imageBase64, mimeType }),
  saveBio: (teamId, bio) => request('PATCH', '/me/bio', { teamId, bio }),

  setAvailability: (teamId, playerName, status, gameId) => request('POST', '/teams/' + teamId + '/availability', { playerName, status, ...(gameId ? { gameId } : {}) }),
  getAnnouncements: (teamId) => request('GET', '/teams/' + teamId + '/announcements'),
  postAnnouncement: (teamId, message) => request('POST', '/teams/' + teamId + '/announcements', { message }),
  deleteAnnouncement: (teamId, id) => request('DELETE', '/teams/' + teamId + '/announcements/' + id),

  // Admin
  adminSummary: () => request('GET', '/admin/summary'),
  adminTeams: () => request('GET', '/admin/teams'),
  adminUsers: () => request('GET', '/admin/users'),
  adminCreateTeam: (data) => request('POST', '/admin/teams/create', data),
  adminEditTeam: (slug, data) => request('POST', '/admin/teams/' + slug + '/edit', data),
  adminDeleteTeam: (slug) => request('POST', '/admin/teams/' + slug + '/delete'),
  adminCreateUser: (data) => request('POST', '/admin/users/create', data),
  adminUpdateUser: (id, data) => request('POST', '/admin/users/' + id + '/update', data),
  adminResetPassword: (id, password) => request('POST', '/admin/users/' + id + '/reset-password', { password }),
  adminDeleteUser: (id) => request('POST', '/admin/users/' + id + '/delete'),
};
