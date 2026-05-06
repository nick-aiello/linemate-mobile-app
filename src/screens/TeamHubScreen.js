import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SECTIONS = [
  { name: 'TeamHistory',  label: 'Lineup History',  sub: 'Past lineups with results',      icon: 'time-outline' },
  { name: 'TeamRoster',   label: 'Roster',           sub: 'Manage players and subs',         icon: 'people-outline' },
  { name: 'TeamSchedule', label: 'Schedule',         sub: 'Upcoming and past games',         icon: 'calendar-outline' },
  { name: 'TeamStats',    label: 'Stats',            sub: 'Player and team statistics',      icon: 'stats-chart-outline' },
];

export default function TeamHubScreen({ route, navigation }) {
  const { teamId, teamName, primaryColor = '#c0392b' } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{(teamName || 'Team').toUpperCase()}</Text>
      {SECTIONS.map((section, i) => (
        <TouchableOpacity
          key={section.name}
          style={[styles.card, i === 0 && styles.cardFirst]}
          onPress={() => navigation.navigate(section.name, { teamId, primaryColor, teamName })}
        >
          <View style={[styles.iconWrap, { backgroundColor: primaryColor }]}>
            <Ionicons name={section.icon} size={20} color="#fff" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardLabel}>{section.label.toUpperCase()}</Text>
            <Text style={styles.cardSub}>{section.sub}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f2ec' },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 2, marginBottom: 12, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 4, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 14 },
  cardFirst: {},
  iconWrap: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', letterSpacing: 1 },
  cardSub: { fontSize: 11, color: '#888', marginTop: 2 },
  arrow: { fontSize: 22, color: '#ccc' },
});
