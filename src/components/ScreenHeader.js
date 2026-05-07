import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScreenHeader({ title, primaryColor = '#c0392b', onBack, right }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: primaryColor, paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Ionicons name="chevron-back" size={26} color="#fff" onPress={onBack} style={styles.back} />
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.right}>{right ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: { height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  back: { width: 40 },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 2 },
  right: { width: 40, alignItems: 'flex-end' },
});
