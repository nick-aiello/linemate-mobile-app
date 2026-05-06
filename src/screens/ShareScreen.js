import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Share, Linking, Alert } from 'react-native';
import { api, BASE_URL } from '../api/client';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function buildLineupText(lineup, teamName, config) {
  const lines = [];
  const fwdCount = config?.fwdLines || 3;
  const defCount = config?.defLines || 2;

  const opponent = lineup.opponent ? ((lineup.homeaway === 'away' ? '@ ' : 'vs ') + lineup.opponent) : null;
  const dateStr = formatDate(lineup.gamedate);
  const time = lineup.gametime || null;
  const rink = lineup.rink || null;

  lines.push('LINEUP — ' + (teamName || 'Team').toUpperCase());
  if (opponent) lines.push(opponent.toUpperCase());
  const meta = [dateStr, time, rink].filter(Boolean).join(' · ');
  if (meta) lines.push(meta);
  lines.push('');

  const fwdLineNums = Array.from({ length: fwdCount }, (_, i) => i + 1);
  const hasFwds = fwdLineNums.some(n => lineup['lw'+n] || lineup['c'+n] || lineup['rw'+n]);
  if (hasFwds) {
    lines.push('FORWARDS');
    fwdLineNums.forEach(n => {
      const lw = lineup['lw'+n] || '—';
      const c = lineup['c'+n] || '—';
      const rw = lineup['rw'+n] || '—';
      if (lw !== '—' || c !== '—' || rw !== '—') {
        lines.push('Line ' + n + ': ' + lw + ' | ' + c + ' | ' + rw);
      }
    });
    lines.push('');
  }

  const defLineNums = Array.from({ length: defCount }, (_, i) => i + 1);
  const hasDef = defLineNums.some(n => lineup['ld'+n] || lineup['rd'+n]);
  if (hasDef) {
    lines.push('DEFENSE');
    defLineNums.forEach(n => {
      const ld = lineup['ld'+n] || '—';
      const rd = lineup['rd'+n] || '—';
      if (ld !== '—' || rd !== '—') {
        lines.push('Pair ' + n + ': ' + ld + ' | ' + rd);
      }
    });
    lines.push('');
  }

  const goalies = [1,2].map(n => lineup['g'+n]).filter(Boolean);
  if (goalies.length) {
    lines.push('GOALIE');
    goalies.forEach(g => lines.push(g));
    lines.push('');
  }

  if (lineup.notes) {
    lines.push('Notes: ' + lineup.notes);
    lines.push('');
  }

  lines.push('Powered by Linemate · ' + BASE_URL + '/' + teamId);

  return lines.join('\n');
}

export default function ShareScreen({ route }) {
  const { teamId, teamName, primaryColor = '#c0392b' } = route.params;
  const [lineup, setLineup] = useState(null);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [l, c] = await Promise.all([
        api.lineup(teamId),
        api.get('/teams/' + teamId + '/config').catch(() => ({})),
      ]);
      setLineup(l);
      setConfig(c);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const shareUrl = BASE_URL + '/' + teamId;

  function getLineupText() {
    if (!lineup) return '';
    const fwdCount = config?.fwdLines || 3;
    const defCount = config?.defLines || 2;
    const lines = [];
    const opponent = lineup.opponent ? ((lineup.homeaway === 'away' ? '@ ' : 'vs ') + lineup.opponent) : null;
    const dateStr = formatDate(lineup.gamedate);
    const time = lineup.gametime || null;
    const rink = lineup.rink || null;

    lines.push('LINEUP — ' + (teamName || 'Team').toUpperCase());
    if (opponent) lines.push(opponent.toUpperCase());
    const meta = [dateStr, time, rink].filter(Boolean).join(' · ');
    if (meta) lines.push(meta);
    lines.push('');

    const fwdLineNums = Array.from({ length: fwdCount }, (_, i) => i + 1);
    const hasFwds = fwdLineNums.some(n => lineup['lw'+n] || lineup['c'+n] || lineup['rw'+n]);
    if (hasFwds) {
      lines.push('FORWARDS');
      fwdLineNums.forEach(n => {
        const lw = lineup['lw'+n] || '—';
        const c = lineup['c'+n] || '—';
        const rw = lineup['rw'+n] || '—';
        if (lw !== '—' || c !== '—' || rw !== '—') {
          lines.push('Line ' + n + ': ' + lw + ' | ' + c + ' | ' + rw);
        }
      });
      lines.push('');
    }

    const defLineNums = Array.from({ length: defCount }, (_, i) => i + 1);
    const hasDef = defLineNums.some(n => lineup['ld'+n] || lineup['rd'+n]);
    if (hasDef) {
      lines.push('DEFENSE');
      defLineNums.forEach(n => {
        const ld = lineup['ld'+n] || '—';
        const rd = lineup['rd'+n] || '—';
        if (ld !== '—' || rd !== '—') {
          lines.push('Pair ' + n + ': ' + ld + ' | ' + rd);
        }
      });
      lines.push('');
    }

    const goalies = [1,2].map(n => lineup['g'+n]).filter(Boolean);
    if (goalies.length) {
      lines.push('GOALIE');
      goalies.forEach(g => lines.push(g));
      lines.push('');
    }

    if (lineup.notes) {
      lines.push('Notes: ' + lineup.notes);
      lines.push('');
    }

    lines.push('View full lineup: ' + shareUrl);
    return lines.join('\n');
  }

  async function handleShareLink() {
    try {
      await Share.share({ url: shareUrl, message: shareUrl });
    } catch(e) {}
  }

  async function handleEmailLineup() {
    const subject = lineup?.opponent
      ? 'Lineup — ' + (lineup.homeaway === 'away' ? '@ ' : 'vs ') + lineup.opponent
      : 'Lineup — ' + (teamName || 'Team');
    const body = getLineupText();
    const url = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Mail Not Available', 'No mail app is configured on this device.');
    }
  }

  async function handleOpenBrowser() {
    await Linking.openURL(shareUrl);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={primaryColor} /></View>;

  const opponent = lineup?.opponent ? ((lineup.homeaway === 'away' ? '@ ' : 'vs ') + lineup.opponent) : null;
  const dateStr = formatDate(lineup?.gamedate);
  const fwdCount = config?.fwdLines || 3;
  const defCount = config?.defLines || 2;
  const fwdLineNums = Array.from({ length: fwdCount }, (_, i) => i + 1);
  const defLineNums = Array.from({ length: defCount }, (_, i) => i + 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Lineup Preview Card */}
      <View style={styles.previewCard}>
        <View style={[styles.previewHeader, { backgroundColor: primaryColor }]}>
          <Text style={styles.previewTeam}>{(teamName || teamId).toUpperCase()}</Text>
          {opponent && <Text style={styles.previewOpponent}>{opponent.toUpperCase()}</Text>}
          {dateStr && <Text style={styles.previewMeta}>{[dateStr, lineup?.gametime, lineup?.rink].filter(Boolean).join(' · ')}</Text>}
        </View>

        <View style={styles.previewBody}>
          {/* Forwards */}
          {fwdLineNums.filter(n => lineup?.['lw'+n] || lineup?.['c'+n] || lineup?.['rw'+n]).map(n => (
            <View key={'fwd'+n} style={styles.previewLine}>
              <Text style={[styles.previewLineLabel, { color: primaryColor }]}>Line {n}</Text>
              <View style={styles.previewSlots}>
                {['lw','c','rw'].map(pos => (
                  <View key={pos} style={styles.previewSlot}>
                    <Text style={styles.previewPos}>{pos.toUpperCase()}</Text>
                    <Text style={styles.previewPlayer} numberOfLines={1}>{lineup?.[(pos+n)] || '—'}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Defense */}
          {defLineNums.filter(n => lineup?.['ld'+n] || lineup?.['rd'+n]).length > 0 && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionLabel, { color: primaryColor }]}>Defense</Text>
              {defLineNums.filter(n => lineup?.['ld'+n] || lineup?.['rd'+n]).map(n => (
                <View key={'def'+n} style={styles.previewLine}>
                  <Text style={[styles.previewLineLabel, { color: primaryColor }]}>Pair {n}</Text>
                  <View style={styles.previewSlots}>
                    {['ld','rd'].map(pos => (
                      <View key={pos} style={[styles.previewSlot, { flex: 1 }]}>
                        <Text style={styles.previewPos}>{pos.toUpperCase()}</Text>
                        <Text style={styles.previewPlayer} numberOfLines={1}>{lineup?.[(pos+n)] || '—'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Goalies */}
          {([1,2].some(n => lineup?.['g'+n])) && (
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionLabel, { color: primaryColor }]}>Goalie</Text>
              <View style={styles.previewSlots}>
                {[1,2].filter(n => lineup?.['g'+n]).map(n => (
                  <View key={'g'+n} style={styles.previewSlot}>
                    <Text style={styles.previewPos}>G</Text>
                    <Text style={styles.previewPlayer} numberOfLines={1}>{lineup?.['g'+n]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {lineup?.notes && (
            <View style={styles.previewNotes}>
              <Text style={styles.previewNotesLabel}>Notes</Text>
              <Text style={styles.previewNotesText}>{lineup.notes}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Share Actions */}
      <Text style={styles.sectionLabel}>Share</Text>

      <View style={styles.actionCard}>
        <TouchableOpacity style={styles.actionRow} onPress={handleShareLink}>
          <View style={[styles.actionIcon, { backgroundColor: primaryColor }]}>
            <Text style={styles.actionIconText}>↑</Text>
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Share Link</Text>
            <Text style={styles.actionSub}>Send lineup URL via any app</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity style={styles.actionRow} onPress={handleEmailLineup}>
          <View style={[styles.actionIcon, { backgroundColor: '#555' }]}>
            <Text style={styles.actionIconText}>✉</Text>
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Email Lineup</Text>
            <Text style={styles.actionSub}>Open mail app with formatted lineup</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity style={styles.actionRow} onPress={handleOpenBrowser}>
          <View style={[styles.actionIcon, { backgroundColor: '#888' }]}>
            <Text style={styles.actionIconText}>⊕</Text>
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Open in Browser</Text>
            <Text style={styles.actionSub}>View &amp; print the full lineup card</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.urlHint}>{shareUrl}</Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  previewCard: { backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
  previewHeader: { padding: 14 },
  previewTeam: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  previewOpponent: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2, letterSpacing: 1, fontWeight: '600' },
  previewMeta: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.5 },
  previewBody: { padding: 12 },

  previewSection: { marginTop: 10 },
  previewSectionLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  previewLine: { marginBottom: 6 },
  previewLineLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  previewSlots: { flexDirection: 'row', gap: 4 },
  previewSlot: { flex: 1, backgroundColor: '#f5f2ec', borderRadius: 3, padding: 6, alignItems: 'center' },
  previewPos: { fontSize: 7, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  previewPlayer: { fontSize: 9, fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },

  previewNotes: { marginTop: 10, backgroundColor: '#f5f2ec', borderRadius: 3, padding: 8 },
  previewNotesLabel: { fontSize: 8, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3 },
  previewNotesText: { fontSize: 11, color: '#444', lineHeight: 16 },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },

  actionCard: { backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  actionIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionIconText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  actionSub: { fontSize: 11, color: '#888', marginTop: 1 },
  actionArrow: { fontSize: 20, color: '#ccc' },
  actionDivider: { height: 1, backgroundColor: '#f0ede8', marginLeft: 62 },

  urlHint: { fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 4 },
});
