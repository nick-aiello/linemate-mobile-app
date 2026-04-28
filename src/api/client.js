import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://linemate-app.com';

async function getToken() {
  return await SecureStore.getItemAsync('session_token');
}

export async function setToken(token) {
  await SecureStore.setItemAsync('session_token', token);
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
  delete: (path, body) => request('DELETE', path, body),

  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/me'),

  teams: () => request('GET', '/teams'),
  roster: (teamId) => request('GET', '/teams/' + teamId + '/roster'),
  schedule: (teamId) => request('GET', '/teams/' + teamId + '/schedule'),
  stats: (teamId) => request('GET', '/teams/' + teamId + '/stats'),
  lineup: (teamId) => request('GET', '/teams/' + teamId + '/lineup'),
  setLineup: (teamId) => request('POST', '/teams/' + teamId + '/lineup/set'),
  sync: (teamId) => request('POST', '/teams/' + teamId + '/sync'),

  chat: (teamId, beforeId) => request('GET', '/teams/' + teamId + '/chat' + (beforeId ? '?before=' + beforeId : '')),
  sendMessage: (teamId, content) => request('POST', '/teams/' + teamId + '/chat', { content }),
  react: (teamId, msgId, emoji) => request('POST', '/teams/' + teamId + '/chat/' + msgId + '/react', { emoji }),

  subs: (teamId) => request('GET', '/teams/' + teamId + '/subs'),
  createSub: (teamId, playerName, message, gameId) => request('POST', '/teams/' + teamId + '/subs', { playerName, message, gameId }),
  fillSub: (teamId, subId) => request('POST', '/teams/' + teamId + '/subs/' + subId + '/fill'),
  cancelSub: (teamId, subId) => request('POST', '/teams/' + teamId + '/subs/' + subId + '/cancel'),

  getNotificationPrefs: (teamId) => request('GET', '/teams/' + teamId + '/notifications'),
  setNotificationPrefs: (teamId, prefs) => request('POST', '/teams/' + teamId + '/notifications', prefs),

  registerPushToken: (token, platform) => request('POST', '/push-token', { token, platform }),
  unregisterPushToken: (token) => request('DELETE', '/push-token', { token }),
};
